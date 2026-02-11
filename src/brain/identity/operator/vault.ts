/**
 * Operator Identity Vault
 * Phase: 6
 *
 * Manages the persistent operator identity substrate.
 * Backed by Supabase (operator_vault table) with in-memory fallback.
 * This is separate from the memory banks — it's the identity layer,
 * not the transactional memory layer.
 */

import type {
  VaultCategory,
  VaultEntry,
  VaultEntryCreate,
  VaultSource,
  VoiceProfile,
  InteractionPreferences,
  OperatorIdentitySynthesis,
  ReferenceDocument,
} from "./types.js";
import { createSubsystemLogger } from "../../../logging/subsystem.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../../shared/database/client.js";
import {
  DEFAULT_VOICE_PROFILE,
  DEFAULT_INTERACTION_PREFS,
  EMPTY_IDENTITY_SYNTHESIS,
} from "./types.js";

const log = createSubsystemLogger("identity/vault");

// ─── In-Memory Fallback ────────────────────────────────────────

const _inMemory = new Map<string, VaultEntry>();

function memKey(category: VaultCategory, key: string): string {
  return `${category}::${key}`;
}

// ─── Vault Operations ──────────────────────────────────────────

/**
 * Upsert a vault entry (insert or update by category+key).
 */
export async function upsertVaultEntry(entry: VaultEntryCreate): Promise<VaultEntry> {
  const now = new Date().toISOString();
  const mk = memKey(entry.category, entry.key);

  // Build full entry with generated fields
  const existing = _inMemory.get(mk);
  const full: VaultEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    ...entry,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  _inMemory.set(mk, full);

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { error } = await client.from("operator_vault").upsert(
        {
          id: full.id,
          category: full.category,
          key: full.key,
          content: full.content,
          source: full.source,
          confidence: full.confidence,
          created_at: full.createdAt,
          updated_at: full.updatedAt,
        },
        { onConflict: "category,key" },
      );
      if (error) {
        log.warn(`Vault upsert failed (Supabase): ${error.message}`);
      }
    } catch (err) {
      log.warn(`Vault upsert error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return full;
}

/**
 * Get a single vault entry by category+key.
 */
export async function getVaultEntry(
  category: VaultCategory,
  key: string,
): Promise<VaultEntry | undefined> {
  const mk = memKey(category, key);

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("operator_vault")
        .select("*")
        .eq("category", category)
        .eq("key", key)
        .single();

      if (!error && data) {
        const entry = mapRow(data);
        _inMemory.set(mk, entry);
        return entry;
      }
    } catch {
      // Fall through to in-memory
    }
  }

  return _inMemory.get(mk);
}

/**
 * Get all vault entries for a category.
 */
export async function getVaultEntriesByCategory(category: VaultCategory): Promise<VaultEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("operator_vault")
        .select("*")
        .eq("category", category)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        const entries = data.map(mapRow);
        for (const e of entries) {
          _inMemory.set(memKey(e.category, e.key), e);
        }
        return entries;
      }
    } catch {
      // Fall through to in-memory
    }
  }

  return Array.from(_inMemory.values()).filter((e) => e.category === category);
}

/**
 * Delete a vault entry by category+key.
 */
export async function deleteVaultEntry(category: VaultCategory, key: string): Promise<boolean> {
  const mk = memKey(category, key);
  _inMemory.delete(mk);

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from("operator_vault")
        .delete()
        .eq("category", category)
        .eq("key", key);

      if (error) {
        log.warn(`Vault delete failed: ${error.message}`);
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Delete a vault entry by its ID.
 */
export async function deleteVaultEntryById(id: string): Promise<boolean> {
  // Remove from in-memory by scanning
  for (const [mk, entry] of _inMemory) {
    if (entry.id === id) {
      _inMemory.delete(mk);
      break;
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      const { error } = await client.from("operator_vault").delete().eq("id", id);
      if (error) {
        log.warn(`Vault delete by ID failed: ${error.message}`);
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

// ─── Typed Accessors ───────────────────────────────────────────

/**
 * Get the current voice profile, or the default if not yet established.
 */
export async function getVoiceProfile(): Promise<VoiceProfile> {
  const entry = await getVaultEntry("voice_pattern", "profile");
  if (entry) {
    // Vault entries store content as Record<string, unknown>; cast to domain type at retrieval boundary.
    return entry.content as unknown as VoiceProfile;
  }
  return { ...DEFAULT_VOICE_PROFILE };
}

/**
 * Update the voice profile (merge with existing).
 */
export async function updateVoiceProfile(
  patch: Partial<VoiceProfile>,
  source: VaultSource = "conversation_analysis",
): Promise<VoiceProfile> {
  const current = await getVoiceProfile();
  const updated: VoiceProfile = { ...current, ...patch };

  await upsertVaultEntry({
    category: "voice_pattern",
    key: "profile",
    // Domain types are serialized to Record<string, unknown> for vault storage.
    content: updated as unknown as Record<string, unknown>,
    source,
    confidence: Math.min(0.9, 0.3 + updated.conversationsAnalyzed * 0.005),
  });

  return updated;
}

/**
 * Get learned interaction preferences.
 */
export async function getInteractionPreferences(): Promise<InteractionPreferences> {
  const entry = await getVaultEntry("interaction_pref", "learned");
  if (entry) {
    // Vault entries store content as Record<string, unknown>; cast to domain type at retrieval boundary.
    return entry.content as unknown as InteractionPreferences;
  }
  return { ...DEFAULT_INTERACTION_PREFS };
}

/**
 * Update interaction preferences (merge).
 */
export async function updateInteractionPreferences(
  patch: Partial<InteractionPreferences>,
  source: VaultSource = "conversation_analysis",
): Promise<InteractionPreferences> {
  const current = await getInteractionPreferences();
  const updated: InteractionPreferences = { ...current, ...patch };

  await upsertVaultEntry({
    category: "interaction_pref",
    key: "learned",
    // Domain types are serialized to Record<string, unknown> for vault storage.
    content: updated as unknown as Record<string, unknown>,
    source,
    confidence: 0.5,
  });

  return updated;
}

/**
 * Get the current identity synthesis.
 */
export async function getIdentitySynthesis(): Promise<OperatorIdentitySynthesis> {
  const entry = await getVaultEntry("synthesis", "current");
  if (entry) {
    // Vault entries store content as Record<string, unknown>; cast to domain type at retrieval boundary.
    return entry.content as unknown as OperatorIdentitySynthesis;
  }
  return { ...EMPTY_IDENTITY_SYNTHESIS };
}

/**
 * Store a new identity synthesis.
 */
export async function storeIdentitySynthesis(synthesis: OperatorIdentitySynthesis): Promise<void> {
  await upsertVaultEntry({
    category: "synthesis",
    key: "current",
    // Domain types are serialized to Record<string, unknown> for vault storage.
    content: synthesis as unknown as Record<string, unknown>,
    source: "system_observation",
    confidence: 0.7,
  });
}

/**
 * Get all reference documents metadata (not full content).
 */
export async function getReferenceDocuments(): Promise<ReferenceDocument[]> {
  const entries = await getVaultEntriesByCategory("reference_doc");
  // Vault entries store content as Record<string, unknown>; cast to domain type at retrieval boundary.
  return entries.map((e) => e.content as unknown as ReferenceDocument);
}

/**
 * Store a reference document record.
 */
export async function storeReferenceDocument(doc: ReferenceDocument): Promise<void> {
  await upsertVaultEntry({
    category: "reference_doc",
    key: doc.id,
    // Domain types are serialized to Record<string, unknown> for vault storage.
    content: doc as unknown as Record<string, unknown>,
    source: "uploaded_document",
    confidence: 1.0,
  });
}

/**
 * Delete a reference document by ID.
 */
export async function deleteReferenceDocument(docId: string): Promise<boolean> {
  return deleteVaultEntry("reference_doc", docId);
}

/**
 * Get all manual notes.
 */
export async function getManualNotes(): Promise<VaultEntry[]> {
  return getVaultEntriesByCategory("note");
}

/**
 * Add/update a manual identity note from the operator.
 */
export async function upsertManualNote(key: string, text: string): Promise<void> {
  await upsertVaultEntry({
    category: "note",
    key,
    content: { text, addedAt: new Date().toISOString() },
    source: "manual_note",
    confidence: 1.0,
  });
}

// ─── Reset (testing) ───────────────────────────────────────────

/**
 * Clear the in-memory vault (for testing).
 */
export function resetVault(): void {
  _inMemory.clear();
}

// ─── Helpers ───────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): VaultEntry {
  return {
    id: row.id as string,
    category: row.category as VaultCategory,
    key: row.key as string,
    content: row.content as Record<string, unknown>,
    source: (row.source as VaultSource) ?? "system_observation",
    confidence: (row.confidence as number) ?? 0.5,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}
