/**
 * Cross-device flow test (trainer device A → client device B).
 * Run: node scripts/test-supabase-flow.mjs
 * Requires .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (!existsSync(".env")) return {};
  const env = {};
  const raw = readFileSync(".env", "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

async function main() {
  console.log("1. Device A (trainer): create trainer + client...");
  const { data: trainer, error: tErr } = await supabase.from("trainers").insert({ name: "Test Trainer" }).select("id").single();
  if (tErr) throw tErr;

  const code = genCode();
  const { error: cErr } = await supabase.from("clients").insert({ code, name: "Test Client", trainer_id: trainer.id });
  if (cErr) throw cErr;
  const { error: pErr } = await supabase.from("programs").insert({
    client_code: code,
    days: { "Понедельник": [{ name: "Жим лёжа", target: "3×10" }] },
  });
  if (pErr) throw pErr;
  console.log("   Client code:", code);

  console.log("2. Device B (client): validate code...");
  const { data: found } = await supabase.from("clients").select("code").eq("code", code).maybeSingle();
  if (!found) throw new Error("Code not found on device B");

  const { data: prog } = await supabase.from("programs").select("days").eq("client_code", code).single();
  if (!prog?.days?.["Понедельник"]) throw new Error("Program not visible on device B");
  console.log("   Program loaded:", Object.keys(prog.days));

  console.log("3. Device B: save workout log...");
  const today = new Date().toISOString().slice(0, 10);
  const { error: logErr } = await supabase.from("workout_logs").upsert({
    client_code: code,
    log_date: today,
    day_key: "Понедельник",
    exercises: [{ name: "Жим лёжа", sets: [{ weight: "80", reps: "10" }] }],
    notes: "cross-device test",
  }, { onConflict: "client_code,log_date,day_key" });
  if (logErr) throw logErr;

  console.log("4. Device A (trainer): read client progress...");
  const { data: logs } = await supabase.from("workout_logs").select("*").eq("client_code", code);
  if (!logs?.length) throw new Error("Trainer cannot see client logs");
  console.log("   Logs count:", logs.length);

  console.log("\n✅ Cross-device flow OK");
  console.log("Cleaning up test data...");
  await supabase.from("clients").delete().eq("code", code);
  await supabase.from("trainers").delete().eq("id", trainer.id);
  console.log("Done.");
}

main().catch((e) => {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
});
