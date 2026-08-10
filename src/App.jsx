import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  Dumbbell, Activity, Plus, ChevronDown, ChevronUp, Save, TrendingUp, Ruler, Scale,
  Calendar, Check, Download, Upload, StickyNote, Users, User, Trash2, LogOut,
  ChevronRight, Link2, AlertCircle
} from "lucide-react";
import {
  cloudEnabled, ensureTrainer, fetchClients, createClient, deleteClient,
  linkClientCode, fetchProgram, saveProgramDays,
  fetchWorkoutLogsMap, fetchBodyMetricsMap, fetchClientTrainerNotes, saveClientTrainerNotes
} from "./lib/trainerDb";
import {
  getTelegramStartDebugInfo, waitForTelegramStartCode, buildInviteLink
} from "./lib/telegram";
import { buildExerciseSets, findLastExerciseSets, parseNumSets as parseNumSetsUtil } from "./lib/workoutUtils";
import { LinkedWorkoutTab, LinkedMetricsTab } from "./linkedClientTabs";
import { RoleSwitchLink, StickySaveBar } from "./ui/shared";
import { ConnectToTrainerPrompt, StartParamDebugBanner } from "./ui/clientPrompts";

/* ───────── defaults & utils ───────── */

const DEFAULT_PROGRAM = {
  "Пн": { title: "Свежие плечи + База", exercises: [
    { name: "Махи гантелями в стороны", target: "3×12–15" },
    { name: "Жим ногами в тренажере", target: "3×10–12" },
    { name: "Жим гантелей лежа (гориз.)", target: "3×8–10" },
    { name: "Тяга верхнего блока к груди", target: "3×10–12" },
    { name: "Разгибания на блоке (канат)", target: "3×10–12" },
  ]},
  "Ср": { title: "3D-плечи + Брахиалис + Спина", exercises: [
    { name: "Жим гантелей на накл. (30°)", target: "3×8–10" },
    { name: "Махи в наклоне / Бабочка", target: "3×12–15" },
    { name: "Тяга блока к поясу (сидя)", target: "3×10–12" },
    { name: "«Хаммеры» с гантелями", target: "3×10–12" },
    { name: "Сгибания ног в тренажере", target: "3×10–12" },
  ]},
  "Пт": { title: "Плечи + Суперобъём на руки", exercises: [
    { name: "Приседания (Смит / Гоблет)", target: "3×10–12" },
    { name: "Жим гантелей сидя (плечи)", target: "3×10–12" },
    { name: "Тяга гантели 1 рукой в упоре", target: "3×10–12" },
    { name: "Кроссовер / Бабочка (грудь)", target: "3×12–15" },
    { name: "Сгибания на бицепс", target: "3×10–12" },
    { name: "Фр. жим из-за головы (триц)", target: "3×10–12" },
  ]},
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
const parseNumSets = parseNumSetsUtil;
const setVolume = (sets) => sets.reduce((sum, s) => { const w = parseFloat(s.weight); const r = parseFloat(s.reps); return sum + (isNaN(w) || isNaN(r) ? 0 : w * r); }, 0);
const fmtVol = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}т` : `${Math.round(v)}кг`);

const TG_THEME_BG = "#0e111a";

function getTelegramWebApp() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

function getTelegramFirstName() {
  return getTelegramWebApp()?.initDataUnsafe?.user?.first_name || "";
}

function initTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
  if (typeof tg.setHeaderColor === "function") tg.setHeaderColor(TG_THEME_BG);
  if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor(TG_THEME_BG);
}

function storageGet(key) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); }
}

function useStorage(key, fallback) {
  const [data, setData] = useState(fallback);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const stored = storageGet(key);
    if (stored !== null) setData(stored);
    setLoaded(true);
  }, [key]);
  const persist = useCallback((next) => { setData(next); storageSet(key, next); }, [key]);
  return [data, persist, loaded];
}

function useProgram() {
  const [program, persist, loaded] = useStorage("workout-program", DEFAULT_PROGRAM);
  useEffect(() => {
    if (loaded && localStorage.getItem("workout-program") === null) {
      storageSet("workout-program", DEFAULT_PROGRAM);
    }
  }, [loaded]);
  return [program, persist, loaded];
}

const inputStyle = {
  background: "#1b212f", border: "1px solid #303a50", color: "#e8ecf5",
  borderRadius: 8, padding: "8px 10px", fontSize: 15, width: "100%", fontFamily: "'Inter', sans-serif"
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  .display { font-family: 'Bebas Neue', 'Inter', sans-serif; letter-spacing: 0.02em; }
  input[type="number"], input[type="date"], input[type="text"], textarea, select {
    background: #1b212f; border: 1px solid #303a50; color: #e8ecf5;
    border-radius: 8px; padding: 8px 10px; font-size: 15px; width: 100%;
    font-family: 'Inter', sans-serif; transition: border-color .15s, box-shadow .15s;
  }
  input:focus, textarea:focus, select:focus {
    outline: none; border-color: #c98f2f;
    box-shadow: 0 0 0 2px rgba(224, 169, 64, 0.18);
  }
  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7) hue-rotate(180deg); }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: #303a50; border-radius: 3px; }
  button { font-family: 'Inter', sans-serif; cursor: pointer; transition: opacity .15s; }
  button:active { opacity: 0.85; }
`;

/* ───────── root app ───────── */

export default function App() {
  const [role, setRole] = useState(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [startLink, setStartLink] = useState({ loading: false, error: null, success: null, status: null });

  useEffect(() => {
    let cancelled = false;

    initTelegramWebApp();

    (async () => {
      const debug = getTelegramStartDebugInfo();
      console.log("[PROGRESS] Telegram start debug:", debug);

      const startCode = await waitForTelegramStartCode();

      if (cancelled) return;

      if (!startCode && debug.rawParam) {
        console.warn("[PROGRESS] start_param получен, но не похож на код клиента:", debug.rawParam);
      }

      if (startCode) {
        setRole("client");
        storageSet("app-role", "client");
        setStartLink({ loading: true, error: null, success: null, status: "linking", debug });
        try {
          await linkClientCode(startCode);
          if (!cancelled) {
            setStartLink({
              loading: false, error: null, success: startCode,
              status: "linked", debug: getTelegramStartDebugInfo(),
            });
          }
        } catch (e) {
          if (!cancelled) {
            setStartLink({
              loading: false, error: e.message, success: null,
              status: "error", debug: getTelegramStartDebugInfo(),
            });
          }
        }
      } else {
        const saved = storageGet("app-role");
        if (saved) setRole(saved);
        setStartLink({
          loading: false, error: null, success: null,
          status: debug.rawParam ? "invalid_param" : "no_param",
          debug,
        });
      }

      if (!cancelled) setRoleLoaded(true);
    })();

    return () => { cancelled = true; };
  }, []);

  const chooseRole = (r) => { setRole(r); storageSet("app-role", r); };
  const resetRole = () => {
    setRole(null);
    localStorage.removeItem("app-role");
    setStartLink({ loading: false, error: null, success: null, status: null });
  };

  if (!roleLoaded) return null;
  if (startLink.loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e111a", color: "#808a9e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", padding: 16 }}>
        <style>{globalStyles}</style>
        Подключение к тренеру…
        <div style={{ width: "100%", maxWidth: 640, marginTop: 12 }}>
          <StartParamDebugBanner extra={`status: ${startLink.status ?? "linking"}`} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0e111a", color: "#e8ecf5", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{globalStyles}</style>
      <StartParamDebugBanner extra={startLink.status ? `status: ${startLink.status}` : null} />
      {!role ? (
        <RoleChooser onChoose={chooseRole} />
      ) : role === "trainer" ? (
        <TrainerApp onResetRole={resetRole} />
      ) : (
        <ClientApp
          onResetRole={resetRole}
          startLinkError={startLink.error}
          startLinkSuccess={startLink.success}
        />
      )}
    </div>
  );
}

/* ───────── role chooser ───────── */

function RoleChooser({ onChoose }) {
  return (
    <div>
      <div style={{ borderBottom: "1px solid #2b344a" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="display" style={{ fontSize: 34, color: "#e0a940", lineHeight: 1 }}>PROGRESS</span>
            <span style={{ fontSize: 13, color: "#808a9e", fontWeight: 500 }}>тренер + клиент</span>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 60px" }}>
        <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 14, color: "#808a9e", marginBottom: 6 }}>Кто вы?</div>
          <ChoiceCard icon={<Users size={22} color="#e0a940" />} title="Я тренер"
            desc="Составляю программы клиентам и слежу за их прогрессом"
            onClick={() => onChoose("trainer")} />
          <ChoiceCard icon={<User size={22} color="#e0a940" />} title="Я клиент"
            desc="Веду журнал тренировок и показателей тела"
            onClick={() => onChoose("client")} />
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", background: "#171c29", border: "1px solid #2b344a", borderRadius: 12,
      padding: 18, display: "flex", gap: 14, alignItems: "flex-start", width: "100%"
    }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#808a9e" }}>{desc}</div>
      </div>
      <ChevronRight size={18} color="#5a6378" style={{ marginLeft: "auto", flexShrink: 0 }} />
    </button>
  );
}

/* ───────── CLIENT APP (tracker) ───────── */

function getClientCode() {
  try { return localStorage.getItem("client-code") || null; } catch { return null; }
}

function ClientApp({ onResetRole, startLinkError, startLinkSuccess }) {
  const [tab, setTab] = useState("workout");
  const [reloadKey, setReloadKey] = useState(0);
  const [clientCode, setClientCode] = useState(() => startLinkSuccess || getClientCode());
  const reload = () => setReloadKey((k) => k + 1);
  const handleLinked = (code) => { setClientCode(code); setTab("workout"); };
  const handleUnlink = () => { setClientCode(null); setTab("workout"); };

  useEffect(() => {
    if (startLinkSuccess) setClientCode(startLinkSuccess);
  }, [startLinkSuccess]);

  useEffect(() => {
    if (startLinkSuccess && tab !== "workout") setTab("workout");
  }, [startLinkSuccess]); // eslint-disable-line

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      workoutProgram: storageGet("workout-program") || DEFAULT_PROGRAM,
      workoutLogs: storageGet("workout-logs") || {},
      bodyMetrics: storageGet("body-metrics") || {},
      bodyMetricsFields: storageGet("body-metrics-fields") || [],
      profile: storageGet("user-profile") || {},
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zhurnal-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.workoutProgram) storageSet("workout-program", data.workoutProgram);
        if (data.workoutLogs) storageSet("workout-logs", data.workoutLogs);
        if (data.bodyMetrics) storageSet("body-metrics", data.bodyMetrics);
        if (data.bodyMetricsFields) storageSet("body-metrics-fields", data.bodyMetricsFields);
        if (data.profile) storageSet("user-profile", data.profile);
        reload();
      } catch { alert("Не удалось прочитать файл. Проверь формат JSON."); }
    };
    input.click();
  };

  return (
    <>
      <div style={{ borderBottom: "1px solid #2b344a", position: "sticky", top: 0, background: "#0e111a", zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="display" style={{ fontSize: 34, color: "#e0a940", lineHeight: 1 }}>ЖУРНАЛ</span>
              <span style={{ fontSize: 13, color: "#808a9e", fontWeight: 500 }}>тренировок</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <IconBtn onClick={exportData} title="Скачать резервную копию"><Download size={16} /></IconBtn>
              <IconBtn onClick={importData} title="Загрузить резервную копию"><Upload size={16} /></IconBtn>
            </div>
          </div>
          {startLinkError && (
            <div style={{ fontSize: 12.5, color: "#e2795a", marginBottom: 8, padding: "8px 10px", background: "#2a1a1a", borderRadius: 8 }}>
              {startLinkError}
            </div>
          )}
          {startLinkSuccess && (
            <div style={{ fontSize: 12.5, color: "#4caf50", marginBottom: 8, padding: "8px 10px", background: "#1a2a1a", borderRadius: 8 }}>
              Подключено к тренеру · код {startLinkSuccess}
            </div>
          )}
          <div style={{ display: "flex", gap: 4, marginTop: 4, overflowX: "auto" }}>
            <TabButton active={tab === "workout"} onClick={() => setTab("workout")} icon={<Dumbbell size={16} />} label="Тренировки" />
            <TabButton active={tab === "metrics"} onClick={() => setTab("metrics")} icon={<Activity size={16} />} label="Показатели" />
            <TabButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<Scale size={16} />} label="Профиль" />
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 60px" }}>
        {tab === "workout" && (clientCode
          ? <LinkedWorkoutTab key={clientCode + reloadKey} clientCode={clientCode} />
          : <ConnectToTrainerPrompt onGoProfile={() => setTab("profile")} />)}
        {tab === "metrics" && (clientCode
          ? <LinkedMetricsTab key={clientCode + reloadKey} clientCode={clientCode} />
          : <MetricsTab key={reloadKey} />)}
        {tab === "profile" && (
          <ProfileTab key={reloadKey} clientCode={clientCode}
            onLinked={handleLinked} onUnlink={handleUnlink} onResetRole={onResetRole} />
        )}
      </div>
    </>
  );
}

function IconBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "#1b212f", border: "1px solid #303a50", borderRadius: 6,
      color: "#808a9e", padding: "6px 8px", display: "flex", alignItems: "center"
    }}>{children}</button>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", whiteSpace: "nowrap",
      background: "transparent", border: "none", borderBottom: active ? "2px solid #e0a940" : "2px solid transparent",
      color: active ? "#e0a940" : "#808a9e", fontWeight: 600, fontSize: 14.5, transition: "color .15s"
    }}>{icon}{label}</button>
  );
}

function SubTab({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 8, border: "1px solid " + (active ? "#e0a940" : "#303a50"),
      background: active ? "#e0a940" : "none", color: active ? "#120f08" : "#808a9e", fontWeight: 600, fontSize: 13
    }}>{label}</button>
  );
}

/* ───────── PROGRAM TAB (editable) ───────── */

function ProgramTab({ program, persistProgram }) {
  const [draft, setDraft] = useState(program);
  const [saved, setSaved] = useState(false);
  const [newDayKey, setNewDayKey] = useState("");
  const [newDayTitle, setNewDayTitle] = useState("");
  const [addingDay, setAddingDay] = useState(false);

  useEffect(() => { setDraft(program); }, [program]);

  const dayKeys = Object.keys(draft);

  const save = () => {
    persistProgram(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const addDay = () => {
    const key = newDayKey.trim();
    const title = newDayTitle.trim() || key;
    if (!key || draft[key]) return;
    setDraft({ ...draft, [key]: { title, exercises: [] } });
    setNewDayKey(""); setNewDayTitle(""); setAddingDay(false);
  };

  const removeDay = (key) => {
    const next = { ...draft };
    delete next[key];
    setDraft(next);
  };

  const updateDayTitle = (key, title) => {
    setDraft({ ...draft, [key]: { ...draft[key], title } });
  };

  const addExercise = (dayKey) => {
    setDraft({
      ...draft,
      [dayKey]: {
        ...draft[dayKey],
        exercises: [...draft[dayKey].exercises, { name: "Новое упражнение", target: "3×10–12" }],
      },
    });
  };

  const updateExercise = (dayKey, idx, field, value) => {
    const exs = [...draft[dayKey].exercises];
    exs[idx] = { ...exs[idx], [field]: value };
    setDraft({ ...draft, [dayKey]: { ...draft[dayKey], exercises: exs } });
  };

  const removeExercise = (dayKey, idx) => {
    const exs = [...draft[dayKey].exercises];
    exs.splice(idx, 1);
    setDraft({ ...draft, [dayKey]: { ...draft[dayKey], exercises: exs } });
  };

  const moveExercise = (dayKey, idx, dir) => {
    const exs = [...draft[dayKey].exercises];
    const target = idx + dir;
    if (target < 0 || target >= exs.length) return;
    [exs[idx], exs[target]] = [exs[target], exs[idx]];
    setDraft({ ...draft, [dayKey]: { ...draft[dayKey], exercises: exs } });
  };

  return (
    <div>
      <div style={{ margin: "18px 0 14px", fontSize: 13, color: "#808a9e" }}>
        Редактируй дни и упражнения. Изменения применятся во вкладке «Тренировки» после сохранения.
      </div>

      {dayKeys.length === 0 && (
        <div style={{ fontSize: 13.5, color: "#808a9e", textAlign: "center", padding: "20px 0" }}>
          Добавь первый день программы
        </div>
      )}

      {dayKeys.map((key) => (
        <div key={key} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 4 }}>Кнопка дня: <span style={{ color: "#e0a940", fontWeight: 700 }}>{key}</span></div>
              <input type="text" value={draft[key].title} onChange={(e) => updateDayTitle(key, e.target.value)}
                placeholder="Название (напр. Понедельник — Спина)" style={inputStyle} />
            </div>
            <button onClick={() => removeDay(key)} style={{ background: "none", border: "none", padding: 6, flexShrink: 0 }}>
              <Trash2 size={16} color="#c45a4a" />
            </button>
          </div>

          {draft[key].exercises.map((ex, i) => (
            <div key={i} style={{
              display: "flex", gap: 8, alignItems: "center", padding: "8px 0",
              borderTop: i > 0 ? "1px solid #2b344a" : "none"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => moveExercise(key, i, -1)} disabled={i === 0} style={{
                  background: "none", border: "none", padding: 0, color: i === 0 ? "#303a50" : "#808a9e"
                }}><ChevronUp size={14} /></button>
                <button onClick={() => moveExercise(key, i, 1)} disabled={i === draft[key].exercises.length - 1} style={{
                  background: "none", border: "none", padding: 0, color: i === draft[key].exercises.length - 1 ? "#303a50" : "#808a9e"
                }}><ChevronDown size={14} /></button>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <input type="text" value={ex.name} onChange={(e) => updateExercise(key, i, "name", e.target.value)} placeholder="Название упражнения" />
                <input type="text" value={ex.target} onChange={(e) => updateExercise(key, i, "target", e.target.value)} placeholder="3×10–12" style={{ fontSize: 13 }} />
              </div>
              <button onClick={() => removeExercise(key, i)} style={{ background: "none", border: "none", padding: 4 }}>
                <Trash2 size={14} color="#5a6378" />
              </button>
            </div>
          ))}

          <button onClick={() => addExercise(key)} style={{
            display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
            color: "#e0a940", fontSize: 12.5, fontWeight: 600, marginTop: 8, padding: 0
          }}><Plus size={13} /> упражнение</button>
        </div>
      ))}

      {addingDay ? (
        <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 6 }}>Новый день</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="text" value={newDayKey} onChange={(e) => setNewDayKey(e.target.value)} placeholder="Короткое имя (напр. Пн, Вт)" />
            <input type="text" value={newDayTitle} onChange={(e) => setNewDayTitle(e.target.value)} placeholder="Полное название (напр. Понедельник — Спина)" />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={addDay} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}>Добавить</button>
            <button onClick={() => setAddingDay(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}>Отмена</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingDay(true)} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "1px dashed #303a50",
          background: "none", color: "#e0a940", fontWeight: 700, fontSize: 13.5, marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6
        }}><Plus size={15} /> Добавить день</button>
      )}

      <button onClick={save} style={{
        width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#120f08", fontWeight: 800, fontSize: 15,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>{saved ? <><Check size={17} /> Сохранено</> : <><Save size={17} /> Сохранить программу</>}</button>
    </div>
  );
}

/* ───────── WORKOUT TAB ───────── */

function WorkoutTab({ program }) {
  const [logs, persist, loaded] = useStorage("workout-logs", {});
  const dayKeys = Object.keys(program);
  const [day, setDay] = useState(dayKeys[0] || "");
  const [date, setDate] = useState(todayISO());
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (dayKeys.length && !dayKeys.includes(day)) setDay(dayKeys[0]);
  }, [program, day, dayKeys]);

  const entryKey = `${date}_${day}`;
  const existing = logs[entryKey];
  const [sets, setSets] = useState([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!day || !program[day]) return;
    const entry = logs[`${date}_${day}`];
    setSets(initSets(program, day, entry, logs, date));
    setNotes(entry?.notes ?? "");
  }, [day, date, loaded, program]); // eslint-disable-line

  if (!dayKeys.length) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#808a9e", fontSize: 14 }}>
        Программа пуста — добавь дни во вкладке «Программа»
      </div>
    );
  }

  function initSets(prog, d, existingEntry, allLogs, currentDate) {
    const exs = prog[d]?.exercises || [];
    return exs.map((ex) => {
      const prev = existingEntry?.exercises?.find((e) => e.name === ex.name);
      const numSets = parseNumSets(ex.target);
      const savedSets = prev?.sets;
      const lastSets = savedSets?.length ? null : findLastExerciseSets(allLogs, d, currentDate, ex.name);
      return {
        name: ex.name, target: ex.target,
        sets: buildExerciseSets({ numSets, savedSets, lastSets }),
      };
    });
  }

  const updateSet = (exIdx, setIdx, field, value) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets] };
      next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], [field]: value };
      return next;
    });
  };

  const addSet = (exIdx) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], sets: [...next[exIdx].sets, { weight: "", reps: "" }] };
      return next;
    });
  };

  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    persist({ ...logs, [entryKey]: { date, day, exercises: sets, notes } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const totalVolume = sets.reduce((sum, ex) => sum + setVolume(ex.sets), 0);

  const lastTimeFor = (exName) => {
    const candidates = Object.values(logs).filter((l) => l.day === day && l.date !== date).sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const c of candidates) {
      const ex = c.exercises.find((e) => e.name === exName);
      const done = ex?.sets?.filter((s) => s.weight && s.reps);
      if (done?.length) return { date: c.date, sets: done };
    }
    return null;
  };

  return (
    <div style={{ paddingBottom: 88 }}>
      <div style={{ display: "flex", gap: 8, margin: "18px 0 14px", flexWrap: "wrap" }}>
        {dayKeys.map((d) => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: dayKeys.length <= 4 ? 1 : "none", padding: "10px 14px", borderRadius: 8, fontWeight: 700, fontSize: 14,
            background: day === d ? "#e0a940" : "#1b212f", color: day === d ? "#120f08" : "#808a9e",
            border: "1px solid " + (day === d ? "#e0a940" : "#303a50"),
          }}>{d}</button>
        ))}
      </div>

      <div className="display" style={{ fontSize: 22, color: "#e8ecf5", marginBottom: 4 }}>{program[day]?.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Calendar size={15} color="#808a9e" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
      </div>

      {sets.map((ex, exIdx) => {
        const last = lastTimeFor(ex.name);
        const vol = setVolume(ex.sets);
        return (
          <div key={ex.name + exIdx} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                {vol > 0 && <div style={{ fontSize: 12, color: "#e0a940", fontWeight: 600 }}>{fmtVol(vol)}</div>}
                <div style={{ fontSize: 12, color: "#808a9e" }}>{ex.target}</div>
              </div>
            </div>
            {last && (
              <div style={{ fontSize: 12, color: "#7a8fa8", marginBottom: 10 }}>
                Прошлый раз ({fmtDate(last.date)}): {last.sets.map((s) => `${s.weight}кг×${s.reps}`).join(", ")}
              </div>
            )}
            {ex.sets.map((s, setIdx) => (
              <div key={setIdx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#808a9e", width: 18 }}>{setIdx + 1}</span>
                <input type="number" placeholder="кг" value={s.weight} onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)} />
                <span style={{ color: "#5a6378" }}>×</span>
                <input type="number" placeholder="повт" value={s.reps} onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)} />
              </div>
            ))}
            <button onClick={() => addSet(exIdx)} style={{
              display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
              color: "#e0a940", fontSize: 12.5, fontWeight: 600, padding: "4px 0", marginTop: 4
            }}><Plus size={13} /> подход</button>
          </div>
        );
      })}

      {totalVolume > 0 && (
        <div style={{
          background: "#1b212f", border: "1px solid #303a50", borderRadius: 8,
          padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#808a9e",
          display: "flex", justifyContent: "space-between"
        }}>
          <span>Общий тоннаж тренировки</span>
          <span style={{ color: "#e0a940", fontWeight: 700 }}>{fmtVol(totalVolume)}</span>
        </div>
      )}

      <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12.5, color: "#808a9e", fontWeight: 600 }}>
          <StickyNote size={15} color="#e0a940" /> Заметки
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Самочувствие, боль, что улучшить..."
          style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} />
      </div>

      <StickySaveBar onSave={handleSave} saved={saved} saving={false} />

      <button onClick={() => setShowHistory((v) => !v)} style={{
        width: "100%", background: "none", border: "none", color: "#808a9e", fontSize: 13,
        padding: "16px 0 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5
      }}>
        <TrendingUp size={14} /> Прогресс по упражнению {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {showHistory && <ExerciseProgress logs={logs} program={program} />}
    </div>
  );
}

function ExerciseProgress({ logs, program }) {
  const allExercises = useMemo(() => {
    const set = new Set();
    Object.values(program).forEach((d) => d.exercises.forEach((e) => set.add(e.name)));
    return Array.from(set);
  }, [program]);
  const [selected, setSelected] = useState(allExercises[0] || "");

  useEffect(() => {
    if (allExercises.length && !allExercises.includes(selected)) setSelected(allExercises[0]);
  }, [allExercises, selected]);

  const data = useMemo(() => Object.values(logs)
    .filter((l) => l.exercises.some((e) => e.name === selected))
    .map((l) => {
      const ex = l.exercises.find((e) => e.name === selected);
      const weights = ex.sets.map((s) => parseFloat(s.weight)).filter((w) => !isNaN(w));
      const maxW = weights.length ? Math.max(...weights) : null;
      return { date: l.date, label: fmtDate(l.date), maxW };
    })
    .filter((d) => d.maxW !== null)
    .sort((a, b) => (a.date > b.date ? 1 : -1)), [logs, selected]);

  if (!allExercises.length) return null;

  return (
    <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginTop: 8 }}>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ marginBottom: 12 }}>
        {allExercises.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
      {data.length < 2 ? (
        <div style={{ fontSize: 13, color: "#808a9e", padding: "20px 0", textAlign: "center" }}>
          Недостаточно данных — записывай тренировки, чтобы видеть прогресс
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid stroke="#2b344a" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "#808a9e", fontSize: 11 }} axisLine={{ stroke: "#303a50" }} />
            <YAxis tick={{ fill: "#808a9e", fontSize: 11 }} axisLine={{ stroke: "#303a50" }} unit="кг" width={44} />
            <Tooltip contentStyle={{ background: "#1b212f", border: "1px solid #303a50", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="maxW" stroke="#e0a940" strokeWidth={2.5} dot={{ fill: "#e0a940", r: 3.5 }} name="Макс. вес, кг" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ───────── METRICS TAB ───────── */

const EMPTY_METRICS_FORM = {
  weight: "", waist: "", chest: "", pulse: "", sleep: "",
  custom: {},
};

function buildMetricsForm(entry, customFields) {
  const form = { ...EMPTY_METRICS_FORM, custom: { ...(entry?.custom || {}) } };
  form.weight = entry?.weight ?? "";
  form.waist = entry?.waist ?? "";
  form.chest = entry?.chest ?? "";
  form.pulse = entry?.pulse ?? "";
  form.sleep = entry?.sleep ?? "";
  customFields.forEach((f) => {
    if (form.custom[f.id] === undefined) form.custom[f.id] = entry?.custom?.[f.id] ?? "";
  });
  return form;
}

function MetricsTab() {
  const [metrics, persistMetrics, loaded] = useStorage("body-metrics", {});
  const [customFields, persistCustomFields, fieldsLoaded] = useStorage("body-metrics-fields", []);
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState(EMPTY_METRICS_FORM);
  const [addingField, setAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldUnit, setNewFieldUnit] = useState("см");

  useEffect(() => {
    if (!loaded || !fieldsLoaded) return;
    setForm(buildMetricsForm(metrics[date], customFields));
  }, [date, loaded, fieldsLoaded]); // eslint-disable-line

  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    persistMetrics({
      ...metrics,
      [date]: {
        date,
        weight: form.weight,
        waist: form.waist,
        chest: form.chest,
        pulse: form.pulse,
        sleep: form.sleep,
        custom: form.custom,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const setCustomValue = (id, value) => {
    setForm((prev) => ({ ...prev, custom: { ...prev.custom, [id]: value } }));
  };

  const addCustomField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const id = `c_${Date.now()}`;
    const unit = newFieldUnit.trim();
    persistCustomFields([...customFields, { id, label, unit }]);
    setForm((prev) => ({ ...prev, custom: { ...prev.custom, [id]: "" } }));
    setNewFieldLabel("");
    setNewFieldUnit("см");
    setAddingField(false);
  };

  const removeCustomField = (id) => {
    persistCustomFields(customFields.filter((f) => f.id !== id));
    setForm((prev) => {
      const nextCustom = { ...prev.custom };
      delete nextCustom[id];
      return { ...prev, custom: nextCustom };
    });
  };

  const sorted = useMemo(() => Object.values(metrics).sort((a, b) => (a.date > b.date ? 1 : -1)), [metrics]);
  const chartData = sorted.map((m) => ({
    label: fmtDate(m.date),
    weight: m.weight ? parseFloat(m.weight) : null,
    waist: m.waist ? parseFloat(m.waist) : null,
    pulse: m.pulse ? parseFloat(m.pulse) : null,
    ...Object.fromEntries(customFields.map((f) => [
      f.id,
      m.custom?.[f.id] ? parseFloat(m.custom[f.id]) : null,
    ])),
  }));

  const customChartColors = ["#e0a940", "#7a8fa8", "#6b9eb8", "#8a9ec4", "#e2795a"];

  if (!loaded || !fieldsLoaded) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 16px" }}>
        <Calendar size={15} color="#808a9e" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
      </div>
      <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <FieldRow icon={<Scale size={15} color="#e0a940" />} label="Вес, кг"><input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></FieldRow>
        <FieldRow icon={<Ruler size={15} color="#e0a940" />} label="Талия, см"><input type="number" step="0.5" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} /></FieldRow>
        <FieldRow icon={<Ruler size={15} color="#6b9eb8" />} label="Грудь, см (опц.)"><input type="number" step="0.5" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} /></FieldRow>
        <FieldRow icon={<Activity size={15} color="#e0a940" />} label="Пульс утро, уд/мин"><input type="number" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} /></FieldRow>
        <FieldRow icon={<StickyNote size={15} color="#7a8fa8" />} label="Сон, ч (опц.)"><input type="number" step="0.5" placeholder="7.5" value={form.sleep} onChange={(e) => setForm({ ...form, sleep: e.target.value })} /></FieldRow>

        {customFields.length > 0 && (
          <div style={{ borderTop: "1px solid #2b344a", marginTop: 6, paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: "#808a9e", fontWeight: 600, marginBottom: 10 }}>СВОИ ПАРАМЕТРЫ</div>
            {customFields.map((field) => (
              <FieldRow key={field.id} icon={<Ruler size={15} color="#e0a940" />} label={field.unit ? `${field.label}, ${field.unit}` : field.label}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="number" step="0.1" value={form.custom[field.id] ?? ""} onChange={(e) => setCustomValue(field.id, e.target.value)} style={{ flex: 1 }} />
                  <button onClick={() => removeCustomField(field.id)} title="Удалить параметр" style={{ background: "none", border: "none", padding: 4, flexShrink: 0 }}>
                    <Trash2 size={14} color="#5a6378" />
                  </button>
                </div>
              </FieldRow>
            ))}
          </div>
        )}

        {addingField ? (
          <div style={{ borderTop: "1px solid #2b344a", marginTop: 10, paddingTop: 14 }}>
            <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 8 }}>Новый параметр</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="text" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="Например, Бицеп" />
              <input type="text" value={newFieldUnit} onChange={(e) => setNewFieldUnit(e.target.value)} placeholder="Единица: см, %, кг..." />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={addCustomField} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}>Добавить</button>
              <button onClick={() => { setAddingField(false); setNewFieldLabel(""); setNewFieldUnit("см"); }} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}>Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingField(true)} style={{
            width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 8, border: "1px dashed #303a50",
            background: "none", color: "#e0a940", fontWeight: 600, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6
          }}><Plus size={14} /> Добавить свой параметр</button>
        )}

      </div>
      <button onClick={handleSave} style={{
        width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#120f08", fontWeight: 800, fontSize: 15,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>{saved ? <><Check size={17} /> Сохранено</> : <><Save size={17} /> Сохранить показатели</>}</button>
      {chartData.length >= 2 && (
        <>
          <ChartBlock title="Вес, кг" data={chartData} dataKey="weight" color="#e0a940" />
          <ChartBlock title="Талия, см" data={chartData} dataKey="waist" color="#6b9eb8" />
          <ChartBlock title="Пульс, уд/мин" data={chartData} dataKey="pulse" color="#7a8fa8" refLine={90} />
          {customFields.map((field, i) => {
            const hasData = chartData.filter((d) => d[field.id] !== null).length >= 2;
            if (!hasData) return null;
            const title = field.unit ? `${field.label}, ${field.unit}` : field.label;
            return <ChartBlock key={field.id} title={title} data={chartData} dataKey={field.id} color={customChartColors[i % customChartColors.length]} />;
          })}
        </>
      )}
      {sorted.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12.5, color: "#808a9e", marginBottom: 8, fontWeight: 600 }}>ИСТОРИЯ</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sorted.slice().reverse().slice(0, 10).map((m) => (
              <div key={m.date} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 6, padding: "8px 10px", color: "#808a9e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: customFields.length ? 4 : 0 }}>
                  <span style={{ color: "#e8ecf5", fontWeight: 600 }}>{fmtDate(m.date)}</span>
                  <span>{m.weight ? `${m.weight}кг` : "—"}</span>
                  <span>{m.waist ? `${m.waist}см` : "—"}</span>
                  <span>{m.pulse ? `${m.pulse}уд` : "—"}</span>
                </div>
                {customFields.some((f) => m.custom?.[f.id]) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 11.5, marginTop: 4 }}>
                    {customFields.map((f) => m.custom?.[f.id] ? (
                      <span key={f.id}>{f.label}: {m.custom[f.id]}{f.unit ? ` ${f.unit}` : ""}</span>
                    ) : null)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── PROFILE TAB ───────── */

function ProfileTab({ clientCode, onLinked, onUnlink, onResetRole }) {
  const [profile, persist, loaded] = useStorage("user-profile", { name: "", weight: "", height: "", birthYear: "", goal: "", targetWeight: "", notes: "" });
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (loaded) setForm(profile); }, [loaded, profile]);

  const handleSave = () => { persist(form); setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const latestWeight = useMemo(() => {
    const metrics = storageGet("body-metrics") || {};
    const sorted = Object.values(metrics).sort((a, b) => (a.date > b.date ? 1 : -1));
    const last = sorted.filter((m) => m.weight).pop();
    return last ? parseFloat(last.weight) : null;
  }, [saved, loaded]);

  const weightForBmi = latestWeight ?? (form.weight ? parseFloat(form.weight) : null);
  const computedBmi = weightForBmi && form.height ? (weightForBmi / Math.pow(parseFloat(form.height) / 100, 2)).toFixed(1) : null;
  const weightDelta = latestWeight && form.weight ? (latestWeight - parseFloat(form.weight)).toFixed(1) : null;
  const workoutCount = useMemo(() => Object.keys(storageGet("workout-logs") || {}).length, [saved, loaded]);

  return (
    <div>
      <div style={{ margin: "18px 0 14px", fontSize: 13, color: "#808a9e" }}>Базовые параметры — заполни один раз, обновляй по необходимости.</div>
      <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <FieldRow icon={<Scale size={15} color="#e0a940" />} label="Имя (опц.)"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Как к тебе обращаться" style={inputStyle} /></FieldRow>
        <FieldRow icon={<Scale size={15} color="#e0a940" />} label="Начальный вес, кг">
          <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
            placeholder="Вес, когда начал программу" style={inputStyle} />
        </FieldRow>
        <FieldRow icon={<Ruler size={15} color="#e0a940" />} label="Рост, см"><input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} style={inputStyle} /></FieldRow>
        <FieldRow icon={<Calendar size={15} color="#e0a940" />} label="Год рождения (опц.)"><input type="number" value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} style={inputStyle} /></FieldRow>
        <FieldRow icon={<TrendingUp size={15} color="#e0a940" />} label="Цель"><input type="text" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Набрать массу / сбросить жир / сила..." style={inputStyle} /></FieldRow>
        <FieldRow icon={<Scale size={15} color="#6b9eb8" />} label="Целевой вес, кг"><input type="number" step="0.1" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: e.target.value })} style={inputStyle} /></FieldRow>
        <FieldRow icon={<StickyNote size={15} color="#7a8fa8" />} label="Заметки"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Травмы, ограничения, добавки..." style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} /></FieldRow>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <StatCard label="Тренировок" value={workoutCount || "—"} />
        <StatCard label="BMI" value={computedBmi || "—"} hint={computedBmi ? bmiLabel(computedBmi) : "нужен рост + вес"} />
        <StatCard label="Старт" value={form.weight ? `${form.weight}кг` : "—"} hint={weightDelta !== null ? `${weightDelta > 0 ? "+" : ""}${weightDelta}кг от старта` : undefined} />
      </div>
      <button onClick={handleSave} style={{
        width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#120f08", fontWeight: 800, fontSize: 15,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8
      }}>{saved ? <><Check size={17} /> Сохранено</> : <><Save size={17} /> Сохранить профиль</>}</button>
      <TrainerLinkSection clientCode={clientCode} onLinked={onLinked} onUnlink={onUnlink} />
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <RoleSwitchLink onResetRole={onResetRole} />
      </div>
    </div>
  );
}

function TrainerLinkSection({ clientCode, onLinked, onUnlink, autoConnectCode }) {
  const [code, setCode] = useState(clientCode || getClientCode());
  const [input, setInput] = useState(autoConnectCode || "");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => { setCode(clientCode || getClientCode()); }, [clientCode]);

  const linkWithCode = async (raw) => {
    const c = String(raw).trim().toUpperCase();
    if (!c) return;
    if (!cloudEnabled()) { setError("Облако не настроено. Администратор должен добавить Supabase в переменные окружения."); return; }
    setChecking(true);
    setError("");
    try {
      await linkClientCode(c);
      setCode(c);
      setInput(c);
      onLinked?.(c);
    } catch (e) {
      setError(e.message || "Ошибка подключения к Supabase");
    } finally {
      setChecking(false);
    }
  };

  const link = () => linkWithCode(input);

  useEffect(() => {
    if (autoConnectCode && !code && !checking) linkWithCode(autoConnectCode);
  }, [autoConnectCode]); // eslint-disable-line

  const unlink = () => {
    localStorage.removeItem("client-code");
    setCode(null);
    setInput("");
    onUnlink?.();
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12.5, color: "#808a9e", marginBottom: 10, fontWeight: 600 }}>ПОДКЛЮЧЕНИЕ К ТРЕНЕРУ (ОПЦ.)</div>
      <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14 }}>
        {code ? (
          <>
            <div style={{ fontSize: 13, color: "#808a9e", marginBottom: 8 }}>Подключён. Код: <span style={{ fontFamily: "monospace", color: "#e0a940" }}>{code}</span></div>
            <button onClick={unlink} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#808a9e", fontSize: 12, padding: 0 }}>
              <LogOut size={13} /> Отключиться
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13, color: "#808a9e" }}>
              <Link2 size={15} color="#e0a940" /> Введи код от тренера
            </div>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="K7X29Q" style={{ letterSpacing: 2, fontFamily: "monospace", textAlign: "center" }} />
            {error && <div style={{ color: "#e2795a", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
            <button onClick={link} disabled={checking} style={{
              width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 8, border: "none",
              background: "#e0a940", color: "#120f08", fontWeight: 700, fontSize: 13.5
            }}>{checking ? "Проверка…" : "Подключиться"}</button>
          </>
        )}
      </div>
    </div>
  );
}

function ProgramPreview({ program }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12.5, color: "#808a9e", marginBottom: 10, fontWeight: 600 }}>ТВОЯ ПРОГРАММА</div>
      {Object.entries(program).map(([day, info]) => (
        <div key={day} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div className="display" style={{ fontSize: 18, color: "#e0a940", marginBottom: 4 }}>{day} — {info.title}</div>
          {info.exercises.map((ex, i) => (
            <div key={i} style={{ fontSize: 12.5, color: "#808a9e", padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
              <span>{i + 1}. {ex.name}</span>
              <span style={{ color: "#808a9e" }}>{ex.target}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 8, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#e0a940" }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: "#5a6378", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function bmiLabel(bmi) {
  const v = parseFloat(bmi);
  if (v < 18.5) return "недовес";
  if (v < 25) return "норма";
  if (v < 30) return "избыток";
  return "ожирение";
}

function FieldRow({ icon, label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12.5, color: "#808a9e", fontWeight: 600 }}>{icon}{label}</div>
      {children}
    </div>
  );
}

function ChartBlock({ title, data, dataKey, secondKey, color, secondColor, refLine, refLine2 }) {
  return (
    <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginTop: 10 }}>
      <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid stroke="#2b344a" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "#808a9e", fontSize: 10.5 }} axisLine={{ stroke: "#303a50" }} />
          <YAxis tick={{ fill: "#808a9e", fontSize: 10.5 }} axisLine={{ stroke: "#303a50" }} width={38} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#1b212f", border: "1px solid #303a50", borderRadius: 8, fontSize: 12 }} />
          {refLine && <ReferenceLine y={refLine} stroke="#3a4558" strokeDasharray="4 4" />}
          {refLine2 && <ReferenceLine y={refLine2} stroke="#3a4558" strokeDasharray="4 4" />}
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          {secondKey && <Line type="monotone" dataKey={secondKey} stroke={secondColor} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────── TRAINER APP ───────── */

function TrainerApp({ onResetRole }) {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cloudEnabled()) {
        if (!cancelled) { setCloudError("Supabase не настроен. Добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env и Vercel."); setLoaded(true); }
        return;
      }
      try {
        const trainerId = await ensureTrainer();
        const list = await fetchClients(trainerId);
        if (!cancelled) setClients(list);
      } catch (e) {
        if (!cancelled) setCloudError(e.message);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const addClient = async (name) => {
    setBusy(true);
    try {
      const trainerId = await ensureTrainer();
      const client = await createClient(trainerId, name);
      setClients((prev) => [...prev, client]);
      setSelected(client.code);
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
    setBusy(false);
  };

  const removeClient = async (code) => {
    if (!confirm("Удалить клиента и все его данные?")) return;
    setBusy(true);
    try {
      await deleteClient(code);
      setClients((prev) => prev.filter((c) => c.code !== code));
      if (selected === code) setSelected(null);
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
    setBusy(false);
  };

  if (!loaded) return null;

  return (
    <>
      <div style={{ borderBottom: "1px solid #2b344a", position: "sticky", top: 0, background: "#0e111a", zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <span className="display" style={{ fontSize: 34, color: "#e0a940", lineHeight: 1 }}>PROGRESS</span>
            <span style={{ fontSize: 13, color: "#808a9e", fontWeight: 500 }}>тренер</span>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 60px" }}>
        {cloudError && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10, background: "#2a1a1a", border: "1px solid #5a3030",
            borderRadius: 10, padding: 14, marginTop: 14, fontSize: 13, color: "#e2795a"
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>{cloudError}</div>
          </div>
        )}
        {selected ? (
          <ClientDetail client={clients.find((c) => c.code === selected)} onBack={() => setSelected(null)} cloudDisabled={!!cloudError} />
        ) : (
          <div style={{ paddingTop: 18 }}>
            <AddClient onAdd={addClient} disabled={!!cloudError || busy} />
            <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, margin: "20px 0 8px" }}>КЛИЕНТЫ ({clients.length})</div>
            {clients.length === 0 && <div style={{ fontSize: 13.5, color: "#808a9e", textAlign: "center", padding: "30px 0" }}>Добавь первого клиента, чтобы составить ему программу</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {clients.map((c) => (
                <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 10, background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: "12px 14px" }}>
                  <div onClick={() => setSelected(c.code)} style={{ flex: 1, cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#808a9e", fontFamily: "monospace", letterSpacing: 1 }}>код: {c.code}</div>
                  </div>
                  <button onClick={() => setSelected(c.code)} style={{ background: "none", border: "none", padding: 6 }}><ChevronRight size={18} color="#808a9e" /></button>
                  <button onClick={() => removeClient(c.code)} style={{ background: "none", border: "none", padding: 6 }}><Trash2 size={16} color="#c45a4a" /></button>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <RoleSwitchLink onResetRole={onResetRole} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function AddClient({ onAdd, disabled }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    if (disabled) return;
    setName(getTelegramFirstName());
    setOpen(true);
  };

  if (!open) {
    return (
      <button onClick={handleOpen} disabled={disabled} style={{
        width: "100%", padding: "13px 0", borderRadius: 10, border: "1px dashed #303a50",
        background: "none", color: disabled ? "#5a6378" : "#e0a940", fontWeight: 700, fontSize: 14,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: disabled ? 0.6 : 1
      }}><Plus size={16} /> Добавить клиента</button>
    );
  }
  return (
    <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 6 }}>Имя клиента</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Иван" />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(""); setOpen(false); } }}
          style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}>Создать</button>
        <button onClick={() => setOpen(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}>Отмена</button>
      </div>
    </div>
  );
}

function ClientDetail({ client, onBack, cloudDisabled }) {
  const [tab, setTab] = useState("program");
  const [copied, setCopied] = useState(false);
  const inviteLink = buildInviteLink(client.code);

  const copyInvite = async () => {
    const text = inviteLink || client.code;
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ paddingTop: 18 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#808a9e", fontSize: 13, marginBottom: 12, padding: 0 }}>← Все клиенты</button>
      <div className="display" style={{ fontSize: 26, marginBottom: 4 }}>{client.name}</div>
      <button onClick={copyInvite} style={{
        display: "flex", alignItems: "center", gap: 6, background: "#171c29", border: "1px solid #2b344a",
        borderRadius: 8, padding: "10px 12px", color: "#808a9e", fontSize: 13, marginBottom: 8, width: "100%",
        justifyContent: "center"
      }}>
        <Link2 size={15} color="#e0a940" />
        {copied ? "Ссылка скопирована!" : "Скопировать ссылку-приглашение"}
      </button>
      <div style={{ fontSize: 11.5, color: "#5a6378", marginBottom: 12, lineHeight: 1.5 }}>
        {inviteLink ? (
          <>Клиент откроет приложение сразу в своём режиме: <span style={{ fontFamily: "monospace", color: "#808a9e", wordBreak: "break-all" }}>{inviteLink}</span></>
        ) : (
          <>Добавь <code style={{ color: "#808a9e" }}>VITE_TELEGRAM_BOT_USERNAME</code> и <code style={{ color: "#808a9e" }}>VITE_TELEGRAM_APP_SHORT_NAME</code> в .env. Код клиента: <span style={{ fontFamily: "monospace", color: "#e0a940" }}>{client.code}</span></>
        )}
      </div>
      <TrainerNotesPanel clientCode={client.code} disabled={cloudDisabled} />
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <SubTab active={tab === "program"} onClick={() => setTab("program")} label="Программа" />
        <SubTab active={tab === "progress"} onClick={() => setTab("progress")} label="Прогресс" />
      </div>
      {tab === "program"
        ? <TrainerProgramEditor code={client.code} disabled={cloudDisabled} />
        : <ClientProgressView code={client.code} disabled={cloudDisabled} />}
    </div>
  );
}

function TrainerNotesPanel({ clientCode, disabled }) {
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (disabled || !cloudEnabled()) { setLoaded(true); return; }
    fetchClientTrainerNotes(clientCode)
      .then(setNotes)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoaded(true));
  }, [clientCode, disabled]);

  const save = async () => {
    setSaving(true);
    try {
      await saveClientTrainerNotes(clientCode, notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  };

  if (disabled) return null;

  return (
    <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 6 }}>
        ЗАМЕТКИ О КЛИЕНТЕ <span style={{ fontWeight: 400, color: "#5a6378" }}>(только для тебя)</span>
      </div>
      {loadError ? (
        <div style={{ fontSize: 12.5, color: "#e2795a" }}>{loadError}</div>
      ) : !loaded ? (
        <div style={{ fontSize: 12.5, color: "#808a9e" }}>Загрузка…</div>
      ) : (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Травмы, ограничения, на что обратить внимание…"
            style={{ ...inputStyle, minHeight: 72, resize: "vertical", marginBottom: 10 }}
          />
          <button onClick={save} disabled={saving} style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
            background: saved ? "#4a7a5a" : "#303a50", color: saved ? "#fff" : "#e8ecf5",
            fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1,
          }}>{saved ? "Сохранено" : saving ? "Сохранение…" : "Сохранить заметки"}</button>
        </>
      )}
    </div>
  );
}

function TrainerProgramEditor({ code, disabled }) {
  const [program, setProgram] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [newDayName, setNewDayName] = useState("");
  const [addingDay, setAddingDay] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (disabled || !cloudEnabled()) return;
      try {
        const p = await fetchProgram(code);
        if (!cancelled) setProgram({ days: p.days || {} });
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [code, disabled]);

  if (disabled) return <div style={{ color: "#808a9e", fontSize: 13 }}>Облако недоступно</div>;
  if (loadError) return <div style={{ color: "#e2795a", fontSize: 13 }}>{loadError}</div>;
  if (!program) return <div style={{ color: "#808a9e", fontSize: 13 }}>Загрузка…</div>;

  const dayKeys = Object.keys(program.days || {});

  const save = async () => {
    setSaving(true);
    try {
      await saveProgramDays(code, program.days);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  };

  const addDay = () => {
    const name = newDayName.trim();
    if (!name || program.days[name]) return;
    setProgram({ ...program, days: { ...program.days, [name]: [] } });
    setNewDayName(""); setAddingDay(false);
  };

  const removeDay = (d) => {
    const next = { ...program.days };
    delete next[d];
    setProgram({ ...program, days: next });
  };

  const addExercise = (d) => {
    setProgram({ ...program, days: { ...program.days, [d]: [...program.days[d], { name: "Новое упражнение", target: "3×10–12" }] } });
  };

  const updateExercise = (d, i, field, value) => {
    const exs = [...program.days[d]];
    exs[i] = { ...exs[i], [field]: value };
    setProgram({ ...program, days: { ...program.days, [d]: exs } });
  };

  const removeExercise = (d, i) => {
    const exs = [...program.days[d]];
    exs.splice(i, 1);
    setProgram({ ...program, days: { ...program.days, [d]: exs } });
  };

  const moveExercise = (d, idx, dir) => {
    const exs = [...program.days[d]];
    const target = idx + dir;
    if (target < 0 || target >= exs.length) return;
    [exs[idx], exs[target]] = [exs[target], exs[idx]];
    setProgram({ ...program, days: { ...program.days, [d]: exs } });
  };

  return (
    <div>
      {dayKeys.length === 0 && <div style={{ fontSize: 13.5, color: "#808a9e", textAlign: "center", padding: "20px 0" }}>Добавь первый день программы</div>}
      {dayKeys.map((d) => (
        <div key={d} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{d}</div>
            <button onClick={() => removeDay(d)} style={{ background: "none", border: "none" }}><Trash2 size={15} color="#c45a4a" /></button>
          </div>
          {program.days[d].map((ex, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderTop: i > 0 ? "1px solid #2b344a" : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => moveExercise(d, i, -1)} disabled={i === 0} style={{ background: "none", border: "none", padding: 0, color: i === 0 ? "#303a50" : "#808a9e" }}><ChevronUp size={14} /></button>
                <button onClick={() => moveExercise(d, i, 1)} disabled={i === program.days[d].length - 1} style={{ background: "none", border: "none", padding: 0, color: i === program.days[d].length - 1 ? "#303a50" : "#808a9e" }}><ChevronDown size={14} /></button>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <input type="text" value={ex.name} onChange={(e) => updateExercise(d, i, "name", e.target.value)} />
                <input type="text" value={ex.target} onChange={(e) => updateExercise(d, i, "target", e.target.value)} placeholder="3×10–12" style={{ fontSize: 13 }} />
              </div>
              <button onClick={() => removeExercise(d, i)} style={{ background: "none", border: "none" }}><Trash2 size={13} color="#5a6378" /></button>
            </div>
          ))}
          <button onClick={() => addExercise(d)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#e0a940", fontSize: 12.5, fontWeight: 600, marginTop: 8, padding: 0 }}><Plus size={13} /> упражнение</button>
        </div>
      ))}

      {addingDay ? (
        <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 6 }}>Название дня</div>
          <input type="text" value={newDayName} onChange={(e) => setNewDayName(e.target.value)} placeholder="Понедельник — Спина" />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={addDay} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}>Добавить</button>
            <button onClick={() => setAddingDay(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}>Отмена</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingDay(true)} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "1px dashed #303a50",
          background: "none", color: "#e0a940", fontWeight: 700, fontSize: 13.5, marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6
        }}><Plus size={15} /> Добавить день</button>
      )}

      <button onClick={save} disabled={saving} style={{
        width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#120f08", fontWeight: 800, fontSize: 14.5,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1
      }}>{saved ? <><Check size={16} /> Сохранено</> : saving ? "Сохранение…" : <><Save size={16} /> Сохранить программу</>}</button>
    </div>
  );
}

function ClientProgressView({ code, disabled }) {
  const [logs, setLogs] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (disabled || !cloudEnabled()) return;
      try {
        const [l, m] = await Promise.all([fetchWorkoutLogsMap(code), fetchBodyMetricsMap(code)]);
        if (!cancelled) { setLogs(l); setMetrics(m); }
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [code, disabled]);

  if (disabled) return <div style={{ color: "#808a9e", fontSize: 13 }}>Облако недоступно</div>;
  if (loadError) return <div style={{ color: "#e2795a", fontSize: 13 }}>{loadError}</div>;
  if (!logs || !metrics) return <div style={{ color: "#808a9e", fontSize: 13 }}>Загрузка…</div>;

  const workoutDates = Object.values(logs).sort((a, b) => (a.date < b.date ? 1 : -1));
  const metricRows = Object.values(metrics).sort((a, b) => (a.date > b.date ? 1 : -1));
  const chartData = metricRows.map((m) => ({ label: fmtDate(m.date), weight: m.weight ? parseFloat(m.weight) : null, waist: m.waist ? parseFloat(m.waist) : null }));

  return (
    <div>
      {chartData.length >= 2 && (
        <>
          <ChartBlock title="Вес, кг" data={chartData} dataKey="weight" color="#e0a940" />
          <ChartBlock title="Талия, см" data={chartData} dataKey="waist" color="#6b9eb8" />
        </>
      )}
      <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, margin: "18px 0 8px" }}>ПОСЛЕДНИЕ ТРЕНИРОВКИ</div>
      {workoutDates.length === 0 && <div style={{ fontSize: 13, color: "#808a9e" }}>Клиент ещё не вносил тренировки</div>}
      {workoutDates.slice(0, 8).map((w, i) => (
        <div key={i} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ fontSize: 12.5, color: "#e0a940", fontWeight: 700, marginBottom: 4 }}>{fmtDate(w.date)} · {w.day}</div>
          {w.exercises.map((ex, j) => {
            const done = ex.sets.filter((s) => s.weight && s.reps);
            if (!done.length) return null;
            return <div key={j} style={{ fontSize: 12, color: "#808a9e" }}>{ex.name}: {done.map((s) => `${s.weight}×${s.reps}`).join(", ")}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
