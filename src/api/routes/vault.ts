/**
 * Dashboard API — Vault Routes
 * Phase: 6
 *
 * POST   /api/vault/upload            — Upload reference document
 * GET    /api/vault/references         — List uploaded documents
 * DELETE /api/vault/references/:id     — Remove a reference document
 * GET    /api/vault/voice-profile      — Current voice analysis
 * GET    /api/vault/synthesis          — Current identity synthesis
 * POST   /api/vault/synthesis/regenerate — Trigger regeneration
 * GET    /api/vault/preferences        — Learned interaction preferences
 * PUT    /api/vault/notes              — Manual identity notes from operator
 * GET    /api/vault/notes              — Get all manual notes
 */

import { Router, type Request, type Response } from "express";
import { generateOperatorSynthesis } from "../../brain/identity/operator/identity-synthesis.js";
import { ingestDocument } from "../../brain/identity/operator/reference-ingester.js";
import {
  getVoiceProfile,
  getInteractionPreferences,
  getIdentitySynthesis,
  getReferenceDocuments,
  deleteReferenceDocument,
  getManualNotes,
  upsertManualNote,
} from "../../brain/identity/operator/vault.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("dashboard-api/vault");

export const vaultRouter: Router = Router();

// ─── Reference Documents ───────────────────────────────────────

/**
 * POST /api/vault/upload
 * Upload a reference document for operator identity modeling.
 * Body: { filename: string, content: string, contentType?: string }
 */
vaultRouter.post("/upload", async (req: Request, res: Response) => {
  try {
    const { filename, content, contentType } = req.body as {
      filename?: string;
      content?: string;
      contentType?: string;
    };

    if (!filename || typeof filename !== "string") {
      res.status(400).json({ error: "filename is required" });
      return;
    }

    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const result = await ingestDocument(filename, content, contentType ?? "text/plain");

    if (result.error) {
      res.status(400).json({ error: result.error, document: result.document });
      return;
    }

    res.json({
      document: result.document,
      observations: result.observations,
    });
  } catch (err) {
    log.error(`Vault upload failed: ${err}`);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

/**
 * GET /api/vault/references
 * List all uploaded reference documents.
 */
vaultRouter.get("/references", async (_req: Request, res: Response) => {
  try {
    const docs = await getReferenceDocuments();
    res.json({ documents: docs });
  } catch (err) {
    log.error(`Failed to list references: ${err}`);
    res.status(500).json({ error: "Failed to list references" });
  }
});

/**
 * DELETE /api/vault/references/:id
 * Remove a reference document.
 */
vaultRouter.delete("/references/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await deleteReferenceDocument(id);

    if (!deleted) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.json({ deleted: true, id });
  } catch (err) {
    log.error(`Failed to delete reference: ${err}`);
    res.status(500).json({ error: "Failed to delete reference" });
  }
});

// ─── Voice Profile ─────────────────────────────────────────────

/**
 * GET /api/vault/voice-profile
 * Current voice analysis / operator voice profile.
 */
vaultRouter.get("/voice-profile", async (_req: Request, res: Response) => {
  try {
    const profile = await getVoiceProfile();
    res.json({ profile });
  } catch (err) {
    log.error(`Failed to get voice profile: ${err}`);
    res.status(500).json({ error: "Failed to get voice profile" });
  }
});

// ─── Identity Synthesis ────────────────────────────────────────

/**
 * GET /api/vault/synthesis
 * Current operator identity synthesis.
 */
vaultRouter.get("/synthesis", async (_req: Request, res: Response) => {
  try {
    const synthesis = await getIdentitySynthesis();
    res.json({ synthesis });
  } catch (err) {
    log.error(`Failed to get synthesis: ${err}`);
    res.status(500).json({ error: "Failed to get synthesis" });
  }
});

/**
 * POST /api/vault/synthesis/regenerate
 * Trigger regeneration of the operator identity synthesis.
 */
vaultRouter.post("/synthesis/regenerate", async (_req: Request, res: Response) => {
  try {
    const synthesis = await generateOperatorSynthesis();
    res.json({ synthesis, regenerated: true });
  } catch (err) {
    log.error(`Failed to regenerate synthesis: ${err}`);
    res.status(500).json({ error: "Failed to regenerate synthesis" });
  }
});

// ─── Interaction Preferences ───────────────────────────────────

/**
 * GET /api/vault/preferences
 * Learned interaction preferences.
 */
vaultRouter.get("/preferences", async (_req: Request, res: Response) => {
  try {
    const preferences = await getInteractionPreferences();
    res.json({ preferences });
  } catch (err) {
    log.error(`Failed to get preferences: ${err}`);
    res.status(500).json({ error: "Failed to get preferences" });
  }
});

// ─── Manual Notes ──────────────────────────────────────────────

/**
 * GET /api/vault/notes
 * Get all manual identity notes.
 */
vaultRouter.get("/notes", async (_req: Request, res: Response) => {
  try {
    const notes = await getManualNotes();
    res.json({
      notes: notes.map((n) => ({
        key: n.key,
        text: n.content.text,
        addedAt: n.content.addedAt,
        updatedAt: n.updatedAt,
      })),
    });
  } catch (err) {
    log.error(`Failed to get notes: ${err}`);
    res.status(500).json({ error: "Failed to get notes" });
  }
});

/**
 * PUT /api/vault/notes
 * Add or update a manual identity note.
 * Body: { key: string, text: string }
 */
vaultRouter.put("/notes", async (req: Request, res: Response) => {
  try {
    const { key, text } = req.body as { key?: string; text?: string };

    if (!key || typeof key !== "string") {
      res.status(400).json({ error: "key is required" });
      return;
    }

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text is required" });
      return;
    }

    await upsertManualNote(key, text);
    res.json({ success: true, key });
  } catch (err) {
    log.error(`Failed to update note: ${err}`);
    res.status(500).json({ error: "Failed to update note" });
  }
});
