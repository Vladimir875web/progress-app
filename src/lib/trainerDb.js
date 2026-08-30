import { supabase, isSupabaseConfigured } from "./supabase";

const TRAINER_ID_KEY = "trainer-id";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function cloudEnabled() {
  return isSupabaseConfigured() && supabase;
}

function requireSupabase() {
  if (!cloudEnabled()) throw new Error("Supabase не настроен. Добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.");
}

function genCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

async function uniqueCode() {
  for (let i = 0; i < 8; i++) {
    const code = genCode();
    const { data } = await supabase.from("clients").select("code").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Не удалось сгенерировать уникальный код клиента.");
}

export async function ensureTrainer(name = null) {
  requireSupabase();
  const storedId = localStorage.getItem(TRAINER_ID_KEY);
  if (storedId) {
    const { data } = await supabase.from("trainers").select("id").eq("id", storedId).maybeSingle();
    if (data?.id) return data.id;
  }
  const { data, error } = await supabase.from("trainers").insert({ name }).select("id").single();
  if (error) throw error;
  localStorage.setItem(TRAINER_ID_KEY, data.id);
  return data.id;
}

export function getTrainerId() {
  return localStorage.getItem(TRAINER_ID_KEY);
}

export async function fetchClients(trainerId) {
  requireSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("code, name")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createClient(trainerId, name) {
  requireSupabase();
  const code = await uniqueCode();
  const { error: clientErr } = await supabase.from("clients").insert({ code, name, trainer_id: trainerId });
  if (clientErr) throw clientErr;
  const { error: progErr } = await supabase.from("programs").insert({ client_code: code, days: {} });
  if (progErr) throw progErr;
  return { code, name };
}

export async function deleteClient(code) {
  requireSupabase();
  const { error } = await supabase.from("clients").delete().eq("code", code);
  if (error) throw error;
}

export async function linkClientCode(code) {
  requireSupabase();
  const normalized = String(code).trim().toUpperCase();
  const exists = await clientExists(normalized);
  if (!exists) throw new Error("Код не найден. Проверь, что тренер его передал верно.");
  localStorage.setItem("client-code", normalized);
  return normalized;
}

export async function fetchClientTrainerNotes(clientCode) {
  requireSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("trainer_notes")
    .eq("code", clientCode)
    .maybeSingle();
  if (error) throw error;
  return data?.trainer_notes ?? "";
}

export async function saveClientTrainerNotes(clientCode, notes) {
  requireSupabase();
  const { error } = await supabase
    .from("clients")
    .update({ trainer_notes: notes })
    .eq("code", clientCode);
  if (error) throw error;
}

const EMPTY_CLIENT_PROFILE = {
  name: "", weight: "", height: "", birthYear: "", goal: "", targetWeight: "", notes: "",
};

export async function fetchClientProfile(clientCode) {
  requireSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("profile")
    .eq("code", clientCode)
    .maybeSingle();
  if (error) throw error;
  return { ...EMPTY_CLIENT_PROFILE, ...(data?.profile || {}) };
}

export async function saveClientProfile(clientCode, profile) {
  requireSupabase();
  const { data, error: fetchError } = await supabase
    .from("clients")
    .select("profile")
    .eq("code", clientCode)
    .maybeSingle();
  if (fetchError) throw fetchError;
  const merged = { ...(data?.profile || {}), ...profile };
  const { error } = await supabase
    .from("clients")
    .update({ profile: merged })
    .eq("code", clientCode);
  if (error) throw error;
}

const EMPTY_MEMBERSHIP = { remainingSessions: 0, payments: [] };

function normalizeMembership(raw) {
  const m = raw && typeof raw === "object" ? raw : {};
  return {
    remainingSessions: Math.max(0, Number(m.remainingSessions) || 0),
    payments: Array.isArray(m.payments)
      ? m.payments.map((p) => ({
        id: p.id || `p_${Date.now()}`,
        date: p.date || todayISO(),
        amount: Number(p.amount) || 0,
        sessions: Math.max(0, Number(p.sessions) || 0),
        method: p.method || "cash",
        note: p.note || "",
      }))
      : [],
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchClientMembership(clientCode) {
  requireSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("membership")
    .eq("code", clientCode)
    .maybeSingle();
  if (error) throw error;
  return normalizeMembership(data?.membership);
}

export async function saveClientMembership(clientCode, membership) {
  requireSupabase();
  const { error } = await supabase
    .from("clients")
    .update({ membership: normalizeMembership(membership) })
    .eq("code", clientCode);
  if (error) throw error;
}

const EMPTY_SCHEDULE = { sessions: [] };

function normalizeSchedule(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const sessions = Array.isArray(s.sessions)
    ? s.sessions.map((item) => ({
      id: item.id || `sch_${Date.now()}`,
      date: item.date || todayISO(),
      time: String(item.time || "18:00").slice(0, 5),
      note: item.note || "",
    }))
    : [];
  sessions.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return { sessions };
}

export async function fetchClientSchedule(clientCode) {
  const profile = await fetchClientProfile(clientCode);
  return normalizeSchedule(profile.schedule);
}

export async function saveClientSchedule(clientCode, schedule) {
  await saveClientProfile(clientCode, { schedule: normalizeSchedule(schedule) });
}

export async function clientExists(code) {
  requireSupabase();
  const normalized = String(code).trim().toUpperCase();
  const { data, error } = await supabase.from("clients").select("code").eq("code", normalized).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function fetchProgram(clientCode) {
  requireSupabase();
  const { data, error } = await supabase.from("programs").select("days").eq("client_code", clientCode).maybeSingle();
  if (error) throw error;
  return { days: data?.days || {} };
}

export async function saveProgramDays(clientCode, days) {
  requireSupabase();
  const { error } = await supabase.from("programs").upsert(
    { client_code: clientCode, days, updated_at: new Date().toISOString() },
    { onConflict: "client_code" }
  );
  if (error) throw error;
}

function rowToLog(row) {
  return {
    date: row.log_date,
    day: row.day_key,
    exercises: row.exercises || [],
    notes: row.notes || "",
  };
}

export async function fetchWorkoutLogsMap(clientCode) {
  requireSupabase();
  const { data, error } = await supabase.from("workout_logs").select("*").eq("client_code", clientCode);
  if (error) throw error;
  const map = {};
  for (const row of data || []) {
    map[`${row.log_date}_${row.day_key}`] = rowToLog(row);
  }
  return map;
}

export async function saveWorkoutLog(clientCode, entry) {
  requireSupabase();
  const { error } = await supabase.from("workout_logs").upsert(
    {
      client_code: clientCode,
      log_date: entry.date,
      day_key: entry.day,
      exercises: entry.exercises,
      notes: entry.notes || "",
    },
    { onConflict: "client_code,log_date,day_key" }
  );
  if (error) throw error;
}

function numStr(v) {
  return v != null && v !== "" ? String(v) : "";
}

function rowToMetric(row) {
  return {
    date: row.metric_date,
    weight: numStr(row.weight),
    waist: numStr(row.waist),
    chest: numStr(row.chest),
    pulse: numStr(row.pulse),
    sleep: numStr(row.sleep),
    custom: row.custom || {},
  };
}

export async function fetchBodyMetricsMap(clientCode) {
  requireSupabase();
  const { data, error } = await supabase.from("body_metrics").select("*").eq("client_code", clientCode);
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.metric_date] = rowToMetric(row);
  return map;
}

export async function saveBodyMetric(clientCode, entry) {
  requireSupabase();
  const toNum = (v) => (v === "" || v == null ? null : parseFloat(v));
  const { error } = await supabase.from("body_metrics").upsert(
    {
      client_code: clientCode,
      metric_date: entry.date,
      weight: toNum(entry.weight),
      waist: toNum(entry.waist),
      chest: toNum(entry.chest),
      pulse: toNum(entry.pulse),
      sleep: toNum(entry.sleep),
      custom: entry.custom || {},
    },
    { onConflict: "client_code,metric_date" }
  );
  if (error) throw error;
}
