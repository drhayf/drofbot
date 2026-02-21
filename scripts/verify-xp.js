import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DROFBOT_SUPABASE_URL || process.env.OPENCLAW_SUPABASE_URL;
const key = process.env.DROFBOT_SUPABASE_SERVICE_KEY || process.env.OPENCLAW_SUPABASE_SERVICE_KEY || process.env.DROFBOT_SUPABASE_ANON_KEY || process.env.OPENCLAW_SUPABASE_ANON_KEY;

const client = createClient(url, key);

async function check() {
  console.log("Checking player_stats...");
  const { data: oldStats, error: oldErr } = await client.from("player_stats").select("*").order("updated_at", { ascending: false }).limit(5);
  if (oldErr) console.error("Error old:", oldErr.message);
  else console.log("Old Stats:", oldStats);

  console.log("Checking operator_vault progression...");
  const { data: vaultStats, error: vaultErr } = await client.from("operator_vault").select("key, content").eq("category", "progression");
  if (vaultErr) console.error("Error vault:", vaultErr.message);
  else console.log("Vault Stats:", vaultStats);
}

check().catch(console.error);
