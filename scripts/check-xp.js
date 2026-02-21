import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DROFBOT_SUPABASE_URL || process.env.OPENCLAW_SUPABASE_URL;
const key = process.env.DROFBOT_SUPABASE_SERVICE_KEY || process.env.OPENCLAW_SUPABASE_SERVICE_KEY || process.env.DROFBOT_SUPABASE_ANON_KEY || process.env.OPENCLAW_SUPABASE_ANON_KEY;

const client = createClient(url, key);

async function check() {
  const { data: tables, error } = await client.from("pg_catalog.pg_tables").select('tablename').eq('schemaname', 'public');
  if (error) {
     console.error(error);
  } else {
     for (const {tablename} of tables) {
        console.log("TABLE:", tablename);
        const { data, error } = await client.from(tablename).select('*').limit(3);
        if (data) {
           console.log(data);
        } else {
           console.log("ERROR:", error.message);
        }
     }
  }
}

check().catch(console.error);
