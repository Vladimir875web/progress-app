import React, { useState, useEffect } from "react";
import {
  Plus, Trash2, X, ChevronUp, ChevronDown, StickyNote, TrendingUp,
} from "lucide-react";
import {
  cloudEnabled, fetchProgram, saveProgramDays, fetchWorkoutLogsMap, saveWorkoutLog,
} from "../lib/trainerDb";
import { toJournalProgramDays, serializeJournalProgramDays } from "../lib/programFormat";
import { DEFAULT_JOURNAL_PROGRAM } from "../lib/defaultProgram";
import { migrateDateKeysToWeekdays, todayISO, weekdayFromISO, sortProgramDayKeys } from "../lib/programDates";
import { initTrainerWorkoutSets, parseNumSets } from "../lib/workoutUtils";
import { StickySaveBar } from "./shared";
import { WorkoutDatePicker } from "./workoutDatePicker";
import { LinkedExerciseProgress } from "../linkedClientTabs";

const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
const setVolume = (sets) => sets.reduce((sum, s) => {
  const w = parseFloat(s.weight);
  const r = parseFloat(s.reps);
  return sum + (isNaN(w) || isNaN(r) ? 0 : w * r);
}, 0);
const fmtVol = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}т` : `${Math.round(v)}кг`);

const inputStyle = {
  background: "#1b212f", border: "1px solid #303a50", color: "#e8ecf5",
  borderRadius: 8, padding: "8px 10px", fontSize: 15, width: "100%", fontFamily: "'Inter', sans-serif",
};

const setInputStyle = {
  ...inputStyle,
  flex: 1,
  minWidth: 0,
};

function normalizeRow(ex) {
  return {
    name: ex?.name || "",
    target: ex?.target || "3×10–12",
    weight: ex?.weight != null ? String(ex.weight) : "",
  };
}

function setsToProgramRow(ex) {
  const lastWeight = ex.sets?.find((s) => s.weight)?.weight || "";
  return {
    name: ex.name.trim(),
    target: ex.target.trim() || "3×10–12",
    weight: lastWeight ? String(lastWeight) : "",
  };
}

export function TrainerProgramTable({ clientCode, disabled }) {
  const [days, setDays] = useState(null);
  const [logs, setLogs] = useState({});
  const [sets, setSets] = useState([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [activeDay, setActiveDay] = useState("Пн");
  const [date, setDate] = useState(todayISO());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEx, setNewEx] = useState({ name: "", target: "3×10–12" });
  const [addingDay, setAddingDay] = useState(false);
  const [newDayKey, setNewDayKey] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (disabled || !cloudEnabled()) return;
      try {
        const [p, logMap] = await Promise.all([
          fetchProgram(clientCode),
          fetchWorkoutLogsMap(clientCode),
        ]);
        if (cancelled) return;
        let journal = migrateDateKeysToWeekdays(toJournalProgramDays(p.days || {}));
        if (!Object.keys(journal).length) journal = { ...DEFAULT_JOURNAL_PROGRAM };
        for (const key of Object.keys(journal)) {
          journal[key] = (journal[key] || []).map(normalizeRow);
        }
        setDays(journal);
        setLogs(logMap);
        setActiveDay(sortProgramDayKeys(Object.keys(journal))[0] || "Пн");
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [clientCode, disabled]);

  const dayKeys = days ? sortProgramDayKeys(Object.keys(days)) : [];
  const entryKey = `${date}_${activeDay}`;

  useEffect(() => {
    if (!days || !activeDay) return;
    const template = days[activeDay] || [];
    const entry = logs[entryKey];
    setSets(initTrainerWorkoutSets(template, entry, logs, activeDay, date));
    setNotes(entry?.notes ?? "");
  }, [days, activeDay, date, logs, entryKey]);

  const handleDateChange = (iso) => {
    setDate(iso);
    const dow = weekdayFromISO(iso);
    if (days && days[dow]) setActiveDay(dow);
  };

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

  const updateExerciseField = (exIdx, field, value) => {
    setSets((prev) => {
      const next = [...prev];
      next[exIdx] = { ...next[exIdx], [field]: value };
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

  const removeExercise = (exIdx) => {
    setSets((prev) => prev.filter((_, i) => i !== exIdx));
  };

  const moveExercise = (exIdx, dir) => {
    setSets((prev) => {
      const next = [...prev];
      const target = exIdx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[exIdx], next[target]] = [next[target], next[exIdx]];
      return next;
    });
  };

  const addExercise = () => {
    const name = newEx.name.trim();
    const target = newEx.target.trim() || "3×10–12";
    if (!name) return;
    const numSets = parseNumSets(target) || 3;
    setSets((prev) => [...prev, {
      name,
      target,
      sets: Array.from({ length: numSets }, () => ({ weight: "", reps: "" })),
      comment: "",
      showComment: false,
    }]);
    setNewEx({ name: "", target: "3×10–12" });
    setShowAddForm(false);
  };

  const addDay = () => {
    const key = newDayKey.trim();
    if (!key || days[key]) return;
    const sourceKey = activeDay && days[activeDay]?.length ? activeDay : dayKeys[0];
    const template = (days[sourceKey] || []).map((ex) => normalizeRow(ex));
    setDays({ ...days, [key]: template });
    setActiveDay(key);
    setNewDayKey("");
    setAddingDay(false);
  };

  const removeDay = (key) => {
    if (dayKeys.length <= 1) return;
    const next = { ...days };
    delete next[key];
    setDays(next);
    if (activeDay === key) setActiveDay(sortProgramDayKeys(Object.keys(next))[0]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const programExercises = sets.map(setsToProgramRow).filter((ex) => ex.name);
      const updatedDays = { ...days, [activeDay]: programExercises };
      const logEntry = {
        date,
        day: activeDay,
        notes,
        exercises: sets
          .filter((ex) => ex.name.trim())
          .map(({ name, target, sets: exSets, comment }) => ({
            name: name.trim(),
            target: target.trim() || "3×10–12",
            sets: exSets,
            comment: comment || "",
          })),
      };
      await Promise.all([
        saveProgramDays(clientCode, serializeJournalProgramDays(updatedDays)),
        saveWorkoutLog(clientCode, logEntry),
      ]);
      setDays(updatedDays);
      setLogs((prev) => ({ ...prev, [entryKey]: logEntry }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  };

  if (disabled) return <div style={{ color: "#808a9e", fontSize: 13 }}>Облако недоступно</div>;
  if (loadError) return <div style={{ color: "#e2795a", fontSize: 13 }}>{loadError}</div>;
  if (!days) return <div style={{ color: "#808a9e", fontSize: 13 }}>Загрузка…</div>;

  const totalVolume = sets.reduce((sum, ex) => sum + setVolume(ex.sets), 0);
  const programForProgress = { days };

  return (
    <div style={{ paddingBottom: 88 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {dayKeys.map((d) => (
          <button key={d} type="button" onClick={() => setActiveDay(d)} style={{
            flex: dayKeys.length <= 4 ? 1 : "none", minWidth: 52, padding: "10px 14px", borderRadius: 8,
            fontWeight: 700, fontSize: 13,
            background: activeDay === d ? "#e0a940" : "#1b212f",
            color: activeDay === d ? "#120f08" : "#808a9e",
            border: "1px solid " + (activeDay === d ? "#e0a940" : "#303a50"),
          }}>{d}</button>
        ))}
        {!addingDay && (
          <button type="button" onClick={() => setAddingDay(true)} style={{
            padding: "10px 12px", borderRadius: 8, border: "1px dashed #303a50",
            background: "none", color: "#e0a940", fontWeight: 600, fontSize: 13,
          }}><Plus size={14} /></button>
        )}
      </div>

      <WorkoutDatePicker value={date} onChange={handleDateChange} />

      {addingDay && (
        <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <input type="text" value={newDayKey} onChange={(e) => setNewDayKey(e.target.value)}
            placeholder="Название дня (Пн, Чт…)" style={{ ...inputStyle, marginBottom: 8 }} />
          <div style={{ fontSize: 11.5, color: "#5a6378", marginBottom: 8 }}>
            Упражнения скопируются из «{activeDay || dayKeys[0]}»
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={addDay} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}>Добавить</button>
            <button type="button" onClick={() => setAddingDay(false)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}><X size={16} /></button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="display" style={{ fontSize: 20, color: "#e8ecf5" }}>{activeDay}</div>
        {dayKeys.length > 1 && (
          <button type="button" onClick={() => removeDay(activeDay)} style={{ background: "none", border: "none", color: "#c45a4a", fontSize: 12 }}>
            Удалить день
          </button>
        )}
      </div>

      {sets.map((ex, exIdx) => {
        const vol = setVolume(ex.sets);
        return (
          <div key={`${ex.name}-${exIdx}`} style={{
            background: "#171c29", border: "1px solid #2b344a", borderRadius: 10,
            padding: 12, marginBottom: 10,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                <button type="button" onClick={() => moveExercise(exIdx, -1)} disabled={exIdx === 0} style={{ background: "none", border: "none", padding: 0, color: exIdx === 0 ? "#303a50" : "#808a9e" }}><ChevronUp size={14} /></button>
                <button type="button" onClick={() => moveExercise(exIdx, 1)} disabled={exIdx === sets.length - 1} style={{ background: "none", border: "none", padding: 0, color: exIdx === sets.length - 1 ? "#303a50" : "#808a9e" }}><ChevronDown size={14} /></button>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input type="text" value={ex.name} onChange={(e) => updateExerciseField(exIdx, "name", e.target.value)} placeholder="Название упражнения" style={{ ...inputStyle, marginBottom: 6, fontWeight: 600 }} />
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <input type="text" value={ex.target} onChange={(e) => updateExerciseField(exIdx, "target", e.target.value)} placeholder="3×10–12" style={{ ...inputStyle, fontSize: 13, flex: 1, minWidth: 80 }} />
                  {vol > 0 && <span style={{ fontSize: 12, color: "#e0a940", fontWeight: 600, flexShrink: 0 }}>{fmtVol(vol)}</span>}
                </div>
              </div>
              <button type="button" onClick={() => removeExercise(exIdx)} style={{ background: "none", border: "none", padding: 4, marginTop: 4 }}>
                <Trash2 size={15} color="#5a6378" />
              </button>
            </div>

            {ex.prefilledFrom && (
              <div style={{ fontSize: 11.5, color: "#6a7a6a", marginBottom: 8 }}>
                Подставлено из {fmtDate(ex.prefilledFrom)}
              </div>
            )}

            {ex.sets.map((s, setIdx) => (
              <div key={setIdx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#808a9e", width: 18, flexShrink: 0 }}>{setIdx + 1}</span>
                <input type="number" placeholder="кг" value={s.weight} onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)} style={setInputStyle} />
                <span style={{ color: "#5a6378", flexShrink: 0 }}>×</span>
                <input type="number" placeholder="повт" value={s.reps} onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)} style={setInputStyle} />
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
                placeholder="Самочувствие клиента, техника..."
                value={ex.comment || ""}
                onChange={(e) => updateComment(exIdx, e.target.value)}
                rows={2}
                style={{ ...inputStyle, marginTop: 8, minHeight: 56, fontSize: 13.5, resize: "vertical" }}
              />
            )}
          </div>
        );
      })}

      {showAddForm ? (
        <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#808a9e" }}>Новое упражнение</div>
          <input type="text" placeholder="Название" value={newEx.name} onChange={(e) => setNewEx({ ...newEx, name: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
          <input type="text" placeholder="3×10–12" value={newEx.target} onChange={(e) => setNewEx({ ...newEx, target: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={addExercise} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}>Добавить</button>
            <button type="button" onClick={() => { setShowAddForm(false); setNewEx({ name: "", target: "3×10–12" }); }} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAddForm(true)} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, marginBottom: 12,
          background: "#1b212f", border: "1px dashed #303a50", color: "#e0a940",
          fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><Plus size={16} /> Упражнение</button>
      )}

      {totalVolume > 0 && (
        <div style={{
          background: "#1b212f", border: "1px solid #303a50", borderRadius: 8,
          padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#808a9e",
          display: "flex", justifyContent: "space-between",
        }}>
          <span>Общий тоннаж тренировки</span>
          <span style={{ color: "#e0a940", fontWeight: 700 }}>{fmtVol(totalVolume)}</span>
        </div>
      )}

      <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12.5, color: "#808a9e", fontWeight: 600 }}>
          <StickyNote size={15} color="#e0a940" /> Заметки к тренировке
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Самочувствие клиента, что улучшить..."
          style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} />
      </div>

      <button type="button" onClick={() => setShowHistory((v) => !v)} style={{
        width: "100%", background: "none", border: "none", color: "#808a9e", fontSize: 13,
        padding: "8px 0 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
      }}>
        <TrendingUp size={14} /> Прогресс по упражнению {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {showHistory && <LinkedExerciseProgress logs={logs} program={programForProgress} />}

      <StickySaveBar onSave={save} saved={saved} saving={saving} label="Сохранить тренировку" />
    </div>
  );
}
