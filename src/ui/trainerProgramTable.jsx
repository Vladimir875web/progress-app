import React, { useState, useEffect } from "react";
import { Plus, Trash2, X, ChevronUp, ChevronDown, Calendar } from "lucide-react";
import { cloudEnabled, fetchProgram, saveProgramDays } from "../lib/trainerDb";
import { toJournalProgramDays, serializeJournalProgramDays } from "../lib/programFormat";
import { DEFAULT_JOURNAL_PROGRAM } from "../lib/defaultProgram";
import {
  todayISO, migrateLegacyProgramDays, getWorkoutDates, fmtDateLong,
} from "../lib/programDates";
import { WorkoutCalendar } from "./workoutCalendar";
import { StickySaveBar } from "./shared";

const inputStyle = {
  background: "#1b212f", border: "1px solid #303a50", color: "#e8ecf5",
  borderRadius: 8, padding: "8px 10px", fontSize: 15, width: "100%", fontFamily: "'Inter', sans-serif",
};

export function TrainerProgramTable({ clientCode, disabled }) {
  const [days, setDays] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEx, setNewEx] = useState({ name: "", target: "3×10–12" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (disabled || !cloudEnabled()) return;
      try {
        const p = await fetchProgram(clientCode);
        if (cancelled) return;
        let journal = migrateLegacyProgramDays(toJournalProgramDays(p.days || {}));
        if (!Object.keys(journal).length) {
          journal = migrateLegacyProgramDays(DEFAULT_JOURNAL_PROGRAM);
        }
        setDays(journal);
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [clientCode, disabled]);

  if (disabled) return <div style={{ color: "#808a9e", fontSize: 13 }}>Облако недоступно</div>;
  if (loadError) return <div style={{ color: "#e2795a", fontSize: 13 }}>{loadError}</div>;
  if (!days) return <div style={{ color: "#808a9e", fontSize: 13 }}>Загрузка…</div>;

  const exercises = days[selectedDate] || [];
  const workoutDates = getWorkoutDates(days);

  const updateExercise = (idx, field, value) => {
    const exs = [...(days[selectedDate] || [])];
    exs[idx] = { ...exs[idx], [field]: value };
    setDays({ ...days, [selectedDate]: exs });
  };

  const removeExercise = (idx) => {
    const exs = [...exercises];
    exs.splice(idx, 1);
    setDays({ ...days, [selectedDate]: exs });
  };

  const moveExercise = (idx, dir) => {
    const exs = [...exercises];
    const target = idx + dir;
    if (target < 0 || target >= exs.length) return;
    [exs[idx], exs[target]] = [exs[target], exs[idx]];
    setDays({ ...days, [selectedDate]: exs });
  };

  const addExercise = () => {
    const name = newEx.name.trim();
    const target = newEx.target.trim() || "3×10–12";
    if (!name) return;
    setDays({
      ...days,
      [selectedDate]: [...exercises, { name, target }],
    });
    setNewEx({ name: "", target: "3×10–12" });
    setShowAddForm(false);
  };

  const clearDay = () => {
    if (!exercises.length) return;
    if (!confirm("Удалить все упражнения на этот день?")) return;
    const next = { ...days };
    delete next[selectedDate];
    setDays(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveProgramDays(clientCode, serializeJournalProgramDays(days));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ paddingBottom: 88 }}>
      <WorkoutCalendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        workoutDates={workoutDates}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Calendar size={16} color="#e0a940" style={{ flexShrink: 0 }} />
          <div className="display" style={{ fontSize: 18, color: "#e8ecf5", lineHeight: 1.2 }}>
            {fmtDateLong(selectedDate)}
          </div>
        </div>
        {exercises.length > 0 && (
          <button onClick={clearDay} style={{ background: "none", border: "none", color: "#c45a4a", fontSize: 12, flexShrink: 0 }}>
            Очистить
          </button>
        )}
      </div>

      {exercises.length === 0 && !showAddForm && (
        <div style={{ fontSize: 13, color: "#808a9e", textAlign: "center", padding: "12px 0 16px" }}>
          На этот день тренировка не задана
        </div>
      )}

      {exercises.map((ex, idx) => (
        <div key={idx} style={{
          background: "#171c29", border: "1px solid #2b344a", borderRadius: 10,
          padding: 12, marginBottom: 8, display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
            <button onClick={() => moveExercise(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", padding: 0, color: idx === 0 ? "#303a50" : "#808a9e" }}><ChevronUp size={14} /></button>
            <button onClick={() => moveExercise(idx, 1)} disabled={idx === exercises.length - 1} style={{ background: "none", border: "none", padding: 0, color: idx === exercises.length - 1 ? "#303a50" : "#808a9e" }}><ChevronDown size={14} /></button>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <input type="text" value={ex.name} onChange={(e) => updateExercise(idx, "name", e.target.value)} placeholder="Название упражнения" style={inputStyle} />
            <input type="text" value={ex.target} onChange={(e) => updateExercise(idx, "target", e.target.value)} placeholder="3×10–12" style={{ ...inputStyle, fontSize: 13 }} />
          </div>
          <button onClick={() => removeExercise(idx)} style={{ background: "none", border: "none", padding: 4, marginTop: 4 }}>
            <Trash2 size={15} color="#5a6378" />
          </button>
        </div>
      ))}

      {showAddForm ? (
        <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#808a9e" }}>Новое упражнение</div>
          <input type="text" placeholder="Название" value={newEx.name} onChange={(e) => setNewEx({ ...newEx, name: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
          <input type="text" placeholder="3×10–12" value={newEx.target} onChange={(e) => setNewEx({ ...newEx, target: e.target.value })} style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addExercise} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}>Добавить</button>
            <button onClick={() => { setShowAddForm(false); setNewEx({ name: "", target: "3×10–12" }); }} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddForm(true)} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, marginBottom: 12,
          background: "#1b212f", border: "1px dashed #303a50", color: "#e0a940",
          fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><Plus size={16} /> Упражнение</button>
      )}

      <StickySaveBar onSave={save} saved={saved} saving={saving} label="Сохранить программу" />
    </div>
  );
}
