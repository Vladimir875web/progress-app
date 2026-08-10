import React, { useState, useEffect } from "react";
import { Plus, Save, Check, Trash2 } from "lucide-react";
import { cloudEnabled, fetchProgram, saveProgramDays } from "../lib/trainerDb";
import { normalizeProgramDays, serializeProgramDays, setsToTarget } from "../lib/programFormat";

const inputStyle = {
  background: "#1b212f", border: "1px solid #303a50", color: "#e8ecf5",
  borderRadius: 6, padding: "6px 4px", fontSize: 13, width: "100%", fontFamily: "'Inter', sans-serif",
};

const cellInput = { ...inputStyle, textAlign: "center", padding: "7px 4px" };

export function TrainerProgramTable({ clientCode, disabled }) {
  const [program, setProgram] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [dayName, setDayName] = useState("Тренировка");
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (disabled || !cloudEnabled()) return;
      try {
        const p = await fetchProgram(clientCode);
        if (cancelled) return;
        const days = normalizeProgramDays(p.days || {});
        const keys = Object.keys(days);
        setProgram({ days });
        if (keys.length) {
          setSelectedDay(keys[0]);
          setDayName(keys[0]);
        } else {
          setSelectedDay(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [clientCode, disabled]);

  if (disabled) return <div style={{ color: "#808a9e", fontSize: 13 }}>Облако недоступно</div>;
  if (loadError) return <div style={{ color: "#e2795a", fontSize: 13 }}>{loadError}</div>;
  if (!program) return <div style={{ color: "#808a9e", fontSize: 13 }}>Загрузка…</div>;

  const dayKeys = Object.keys(program.days);
  const activeDay = selectedDay && program.days[selectedDay] ? selectedDay : dayKeys[0] || null;
  const exercises = activeDay ? program.days[activeDay] : [];

  const updateDays = (days) => setProgram({ days });

  const ensureDay = () => {
    const name = dayName.trim() || "Тренировка";
    if (!program.days[name]) {
      updateDays({ ...program.days, [name]: [] });
    }
    setSelectedDay(name);
    setDayName(name);
    return name;
  };

  const updateSet = (idx, setIdx, field, value) => {
    const day = activeDay || ensureDay();
    const exs = [...program.days[day]];
    const ex = { ...exs[idx], sets: [...exs[idx].sets] };
    ex.sets[setIdx] = { ...ex.sets[setIdx], [field]: value };
    ex.target = setsToTarget(ex.sets);
    exs[idx] = ex;
    updateDays({ ...program.days, [day]: exs });
  };

  const updateName = (idx, value) => {
    const day = activeDay || ensureDay();
    const exs = [...program.days[day]];
    exs[idx] = { ...exs[idx], name: value };
    updateDays({ ...program.days, [day]: exs });
  };

  const addExercise = () => {
    const day = ensureDay();
    const exs = [...(program.days[day] || []), {
      name: "",
      sets: [{ weight: "", reps: "" }, { weight: "", reps: "" }, { weight: "", reps: "" }],
      target: "",
    }];
    updateDays({ ...program.days, [day]: exs });
  };

  const removeExercise = (idx) => {
    const day = activeDay;
    if (!day) return;
    const exs = [...program.days[day]];
    exs.splice(idx, 1);
    updateDays({ ...program.days, [day]: exs });
  };

  const renameDay = () => {
    const newName = dayName.trim();
    if (!newName || !activeDay || newName === activeDay) return;
    const days = { ...program.days };
    days[newName] = days[activeDay];
    delete days[activeDay];
    updateDays(days);
    setSelectedDay(newName);
  };

  const save = async () => {
    setSaving(true);
    try {
      const day = activeDay || ensureDay();
      const payload = serializeProgramDays(program.days);
      if (!payload[day]) payload[day] = [];
      await saveProgramDays(clientCode, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 6 }}>НАЗВАНИЕ ТРЕНИРОВКИ</div>
        <input
          type="text"
          value={dayName}
          onChange={(e) => setDayName(e.target.value)}
          onBlur={renameDay}
          placeholder="Понедельник — Спина"
          style={inputStyle}
        />
      </div>

      {dayKeys.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {dayKeys.map((d) => (
            <button key={d} onClick={() => { setSelectedDay(d); setDayName(d); }} style={{
              padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px solid " + (d === activeDay ? "#e0a940" : "#303a50"),
              background: d === activeDay ? "#e0a940" : "transparent",
              color: d === activeDay ? "#120f08" : "#808a9e",
            }}>{d}</button>
          ))}
        </div>
      )}

      <div style={{ overflowX: "auto", marginBottom: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
          <thead>
            <tr style={{ fontSize: 11, color: "#808a9e", textAlign: "center" }}>
              <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 600 }}>Упражнение</th>
              <th colSpan={2} style={{ padding: "4px 2px" }}>1</th>
              <th colSpan={2} style={{ padding: "4px 2px" }}>2</th>
              <th colSpan={2} style={{ padding: "4px 2px" }}>3</th>
              <th style={{ width: 28 }} />
            </tr>
            <tr style={{ fontSize: 10, color: "#5a6378", textAlign: "center" }}>
              <th />
              <th style={{ padding: "0 2px" }}>кг</th>
              <th style={{ padding: "0 2px" }}>×</th>
              <th style={{ padding: "0 2px" }}>кг</th>
              <th style={{ padding: "0 2px" }}>×</th>
              <th style={{ padding: "0 2px" }}>кг</th>
              <th style={{ padding: "0 2px" }}>×</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {exercises.map((ex, idx) => (
              <tr key={idx} style={{ borderTop: "1px solid #2b344a" }}>
                <td style={{ padding: "6px 4px", minWidth: 120 }}>
                  <input
                    type="text"
                    value={ex.name}
                    onChange={(e) => updateName(idx, e.target.value)}
                    placeholder="Жим лёжа"
                    style={{ ...inputStyle, fontSize: 13 }}
                  />
                </td>
                {ex.sets.map((s, si) => (
                  <React.Fragment key={si}>
                    <td style={{ padding: "4px 2px", width: 44 }}>
                      <input type="number" value={s.weight} placeholder="—"
                        onChange={(e) => updateSet(idx, si, "weight", e.target.value)} style={cellInput} />
                    </td>
                    <td style={{ padding: "4px 2px", width: 44 }}>
                      <input type="number" value={s.reps} placeholder="—"
                        onChange={(e) => updateSet(idx, si, "reps", e.target.value)} style={cellInput} />
                    </td>
                  </React.Fragment>
                ))}
                <td style={{ padding: "4px", textAlign: "center" }}>
                  <button onClick={() => removeExercise(idx)} style={{ background: "none", border: "none", padding: 4 }}>
                    <Trash2 size={14} color="#5a6378" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {exercises.length === 0 && (
        <div style={{ fontSize: 13, color: "#808a9e", textAlign: "center", padding: "16px 0" }}>
          Добавь упражнения — укажи вес и повторения для каждого подхода
        </div>
      )}

      <button onClick={addExercise} style={{
        width: "100%", padding: "10px 0", marginBottom: 12, borderRadius: 8,
        border: "1px dashed #303a50", background: "none", color: "#e0a940",
        fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}><Plus size={14} /> Добавить упражнение</button>

      <button onClick={save} disabled={saving} style={{
        width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
        background: saved ? "#4a7a5a" : "#e0a940", color: "#120f08", fontWeight: 800, fontSize: 14.5,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1,
      }}>{saved ? <><Check size={16} /> Сохранено</> : saving ? "Сохранение…" : <><Save size={16} /> Сохранить тренировку</>}</button>
    </div>
  );
}
