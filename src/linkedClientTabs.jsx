import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Dumbbell, Activity, Plus, ChevronDown, ChevronUp, Save, TrendingUp, Ruler, Scale,
  Calendar, Check, StickyNote
} from "lucide-react";
import {
  fetchProgram, fetchWorkoutLogsMap, saveWorkoutLog,
  fetchBodyMetricsMap, saveBodyMetric, cloudEnabled
} from "./lib/trainerDb";
import { buildExerciseSets, findLastExerciseSets, parseNumSets } from "./lib/workoutUtils";
import { normalizeExercise } from "./lib/programFormat";
import { migrateDateKeysToWeekdays } from "./lib/programDates";
import { SyncIndicator, StickySaveBar } from "./ui/shared";
import { WorkoutDatePicker } from "./ui/workoutDatePicker";
import { useClientLanguage } from "./ui/clientLanguage";

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
const setVolume = (sets) => sets.reduce((sum, s) => { const w = parseFloat(s.weight); const r = parseFloat(s.reps); return sum + (isNaN(w) || isNaN(r) ? 0 : w * r); }, 0);
const fmtVol = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}т` : `${Math.round(v)}кг`);

const inputStyle = {
  background: "#1b212f", border: "1px solid #303a50", color: "#e8ecf5",
  borderRadius: 8, padding: "8px 10px", fontSize: 15, width: "100%", fontFamily: "'Inter', sans-serif"
};

function initSetsFromTrainerDay(exercises, existingEntry, logs, day, date) {
  return (exercises || []).map((raw) => {
    const ex = normalizeExercise(raw);
    const prev = existingEntry?.exercises?.find((e) => e.name === ex.name);
    const numSets = parseNumSets(ex.target) || ex.sets?.length || 3;
    const defaultWeight = raw.weight != null ? String(raw.weight) : "";
    if (prev?.sets?.length) {
      return {
        name: ex.name, target: ex.target,
        sets: prev.sets.map((s) => ({ weight: s.weight ?? "", reps: s.reps ?? "" })),
        comment: prev.comment ?? "",
        showComment: Boolean(prev.comment),
      };
    }
    const lastDate = findLastDate(logs, day, date, ex.name);
    const lastSets = lastDate ? findLastExerciseSets(logs, day, date, ex.name) : null;
    if (lastSets?.length) {
      const sets = lastSets.map((s) => ({
        weight: s.weight != null && s.weight !== "" ? String(s.weight) : "",
        reps: s.reps != null && s.reps !== "" ? String(s.reps) : "",
      }));
      while (sets.length < numSets) sets.push({ weight: "", reps: "" });
      return {
        name: ex.name, target: ex.target,
        sets: sets.slice(0, Math.max(numSets, sets.length)),
        comment: "",
        showComment: false,
        prefilledFrom: lastDate,
      };
    }
    return {
      name: ex.name, target: ex.target,
      sets: Array.from({ length: numSets }, () => ({ weight: defaultWeight, reps: "" })),
      comment: "",
      showComment: false,
    };
  });
}

function findLastDate(logs, day, currentDate, exName) {
  const candidates = Object.values(logs)
    .filter((l) => l.day === day && l.date !== currentDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const c of candidates) {
    const ex = c.exercises?.find((e) => e.name === exName);
    const done = ex?.sets?.filter((s) => s.weight && s.reps);
    if (done?.length) return c.date;
  }
  return null;
}

export function LinkedWorkoutTab({ clientCode }) {
  const [program, setProgram] = useState(null);
  const [logs, setLogs] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [day, setDay] = useState("");
  const [date, setDate] = useState(todayISO());
  const [sets, setSets] = useState([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cloudEnabled()) { setLoadError("Supabase не настроен"); setLoaded(true); return; }
      try {
        const [prog, logMap] = await Promise.all([
          fetchProgram(clientCode),
          fetchWorkoutLogsMap(clientCode),
        ]);
        if (cancelled) return;
        const migratedDays = migrateDateKeysToWeekdays(prog.days || {});
        setProgram({ days: migratedDays });
        setLogs(logMap);
        const keys = Object.keys(migratedDays);
        if (keys.length) setDay(keys[0]);
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [clientCode]);

  const dayKeys = Object.keys(program?.days || {});
  const entryKey = `${date}_${day}`;

  useEffect(() => {
    if (!day || !program?.days?.[day]) return;
    const entry = logs[`${date}_${day}`];
    setSets(initSetsFromTrainerDay(program.days[day], entry, logs, day, date));
    setNotes(entry?.notes ?? "");
  }, [day, date, program, logs]);

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

  const updateComment = (exIdx, value) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], comment: value };
      return next;
    });
  };

  const toggleComment = (exIdx) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], showComment: !next[exIdx].showComment };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entry = { date, day, exercises: sets, notes };
      await saveWorkoutLog(clientCode, entry);
      setLogs((prev) => ({ ...prev, [entryKey]: entry }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  };

  if (!loaded) return <div style={{ padding: 40, textAlign: "center", color: "#808a9e" }}>Загрузка программы…</div>;
  if (loadError) return <div style={{ padding: 40, textAlign: "center", color: "#e2795a" }}>{loadError}</div>;
  if (!dayKeys.length) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#808a9e", fontSize: 14 }}>
        <SyncIndicator />
        Тренер ещё не составил программу — попроси его добавить дни
      </div>
    );
  }

  const totalVolume = sets.reduce((sum, ex) => sum + setVolume(ex.sets), 0);

  return (
    <div style={{ paddingBottom: 88 }}>
      <SyncIndicator />
      <div style={{ display: "flex", gap: 8, margin: "18px 0 14px" }}>
        {dayKeys.map((d) => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, fontWeight: 700, fontSize: 14,
            background: day === d ? "#e0a940" : "#1b212f", color: day === d ? "#120f08" : "#808a9e",
            border: "1px solid " + (day === d ? "#e0a940" : "#303a50"),
          }}>{d.length > 12 ? d.slice(0, 10) + "…" : d}</button>
        ))}
      </div>

      <WorkoutDatePicker value={date} onChange={setDate} />

      {sets.map((ex, exIdx) => {
        const vol = setVolume(ex.sets);
        return (
          <div key={ex.name + exIdx} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, flex: 1, minWidth: 0, wordBreak: "break-word" }}>{ex.name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexShrink: 0 }}>
                {vol > 0 && <div style={{ fontSize: 12, color: "#e0a940", fontWeight: 600 }}>{fmtVol(vol)}</div>}
                <div style={{ fontSize: 12, color: "#808a9e" }}>{ex.target}</div>
              </div>
            </div>
            {ex.prefilledFrom && (
              <div style={{ fontSize: 11.5, color: "#6a7a6a", marginBottom: 8 }}>
                Подставлено из {fmtDate(ex.prefilledFrom)}
              </div>
            )}
            {ex.sets.map((s, setIdx) => (
              <div key={setIdx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#808a9e", width: 18, flexShrink: 0 }}>{setIdx + 1}</span>
                <input type="number" placeholder="кг" value={s.weight} onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)} />
                <span style={{ color: "#5a6378", flexShrink: 0 }}>×</span>
                <input type="number" placeholder="повт" value={s.reps} onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)} />
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button type="button" onClick={() => addSet(exIdx)} style={{
                display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
                color: "#e0a940", fontSize: 12.5, fontWeight: 600, padding: "4px 0",
              }}><Plus size={13} /> подход</button>
              <button type="button" onClick={() => toggleComment(exIdx)} style={{
                display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
                color: ex.comment || ex.showComment ? "#8a9e8a" : "#808a9e",
                fontSize: 12.5, fontWeight: 600, padding: "4px 0",
              }}><Plus size={13} /> заметка</button>
            </div>
            {(ex.showComment || ex.comment) && (
              <textarea
                placeholder="Заметка: было тяжело, тянуло плечо..."
                value={ex.comment || ""}
                onChange={(e) => updateComment(exIdx, e.target.value)}
                rows={2}
                style={{ ...inputStyle, marginTop: 8, minHeight: 56, fontSize: 13.5, resize: "vertical" }}
              />
            )}
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

      <StickySaveBar onSave={handleSave} saved={saved} saving={saving} />

      <button onClick={() => setShowHistory((v) => !v)} style={{
        width: "100%", background: "none", border: "none", color: "#808a9e", fontSize: 13,
        padding: "16px 0 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5
      }}>
        <TrendingUp size={14} /> Прогресс по упражнению {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {showHistory && <LinkedExerciseProgress logs={logs} program={program} />}
    </div>
  );
}

function LinkedExerciseProgress({ logs, program }) {
  const allExercises = useMemo(() => {
    const set = new Set();
    Object.values(program?.days || {}).forEach((exs) => exs.forEach((e) => set.add(e.name)));
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

const EMPTY_METRICS = { weight: "", waist: "", chest: "", pulse: "", sleep: "", custom: {} };

function FieldRow({ icon, label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12.5, color: "#808a9e", fontWeight: 600 }}>{icon}{label}</div>
      {children}
    </div>
  );
}

function ChartBlock({ title, data, dataKey, color }) {
  return (
    <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginTop: 10 }}>
      <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid stroke="#2b344a" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "#808a9e", fontSize: 10.5 }} axisLine={{ stroke: "#303a50" }} />
          <YAxis tick={{ fill: "#808a9e", fontSize: 10.5 }} axisLine={{ stroke: "#303a50" }} width={38} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#1b212f", border: "1px solid #303a50", borderRadius: 8, fontSize: 12 }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinkedMetricsTab({ clientCode }) {
  const { t, fmtDate: fmtDateLoc } = useClientLanguage();
  const [metrics, setMetrics] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState(EMPTY_METRICS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cloudEnabled()) { setLoadError(t("supabaseNotConfigured")); setLoaded(true); return; }
      try {
        const map = await fetchBodyMetricsMap(clientCode);
        if (!cancelled) setMetrics(map);
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [clientCode, t]);

  useEffect(() => {
    const entry = metrics[date];
    setForm({
      weight: entry?.weight ?? "",
      waist: entry?.waist ?? "",
      chest: entry?.chest ?? "",
      pulse: entry?.pulse ?? "",
      sleep: entry?.sleep ?? "",
      custom: entry?.custom || {},
    });
  }, [date, metrics]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entry = { date, ...form };
      await saveBodyMetric(clientCode, entry);
      setMetrics((prev) => ({ ...prev, [date]: entry }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      alert(t("saveError") + " " + e.message);
    }
    setSaving(false);
  };

  const sorted = useMemo(() => Object.values(metrics).sort((a, b) => (a.date > b.date ? 1 : -1)), [metrics]);
  const chartData = sorted.map((m) => ({
    label: fmtDateLoc(m.date),
    weight: m.weight ? parseFloat(m.weight) : null,
    waist: m.waist ? parseFloat(m.waist) : null,
  }));

  if (!loaded) return <div style={{ padding: 40, textAlign: "center", color: "#808a9e" }}>{t("loading")}</div>;
  if (loadError) return <div style={{ padding: 40, textAlign: "center", color: "#e2795a" }}>{loadError}</div>;

  return (
    <div style={{ position: "relative" }}>
      <SyncIndicator label={t("synced")} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 14px" }}>
        <Activity size={16} color="#e0a940" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t("bodyMetrics")}</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginLeft: "auto", width: 150 }} />
      </div>

      <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <FieldRow icon={<Scale size={15} color="#e0a940" />} label={t("currentWeight")}>
          <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} style={inputStyle} />
        </FieldRow>
        <FieldRow icon={<Ruler size={15} color="#e0a940" />} label={t("waistCm")}>
          <input type="number" step="0.1" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} style={inputStyle} />
        </FieldRow>
        <FieldRow icon={<Ruler size={15} color="#6b9eb8" />} label={t("chestCm")}>
          <input type="number" step="0.1" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} style={inputStyle} />
        </FieldRow>
        <FieldRow icon={<Activity size={15} color="#7a8fa8" />} label={t("restingPulse")}>
          <input type="number" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} style={inputStyle} />
        </FieldRow>
        <FieldRow icon={<Calendar size={15} color="#808a9e" />} label={t("sleepHours")}>
          <input type="number" step="0.5" value={form.sleep} onChange={(e) => setForm({ ...form, sleep: e.target.value })} style={inputStyle} />
        </FieldRow>
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#120f08", fontWeight: 800, fontSize: 15,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1
      }}>{saved ? <><Check size={17} /> {t("saved")}</> : saving ? t("saving") : <><Save size={17} /> {t("save")}</>}</button>

      {chartData.length >= 2 && (
        <>
          <ChartBlock title={t("weightKg")} data={chartData} dataKey="weight" color="#e0a940" />
          <ChartBlock title={t("waistCm")} data={chartData} dataKey="waist" color="#6b9eb8" />
        </>
      )}

      {sorted.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12.5, color: "#808a9e", marginBottom: 8, fontWeight: 600 }}>{t("history")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sorted.slice().reverse().slice(0, 10).map((m) => (
              <div key={m.date} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 6, padding: "8px 10px", color: "#808a9e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "#e8ecf5", fontWeight: 600 }}>{fmtDateLoc(m.date)}</span>
                  <span>{m.weight ? `${m.weight}${t("kg")}` : "—"}</span>
                  <span>{m.waist ? `${m.waist}${t("cm")}` : "—"}</span>
                  <span>{m.pulse ? `${m.pulse}${t("bpm")}` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TrainerProgramPreview({ clientCode }) {
  const [program, setProgram] = useState(null);

  useEffect(() => {
    if (!cloudEnabled() || !clientCode) return;
    fetchProgram(clientCode).then((p) => setProgram(p)).catch(() => {});
  }, [clientCode]);

  if (!program || !Object.keys(program.days || {}).length) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12.5, color: "#808a9e", marginBottom: 10, fontWeight: 600 }}>ПРОГРАММА ОТ ТРЕНЕРА</div>
      {Object.entries(program.days).map(([day, exercises]) => (
        <div key={day} style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div className="display" style={{ fontSize: 18, color: "#e0a940", marginBottom: 4 }}>{day}</div>
          {(exercises || []).map((ex, i) => (
            <div key={i} style={{ fontSize: 12.5, color: "#808a9e", padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
              <span>{i + 1}. {ex.name}</span>
              <span>{ex.target}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
