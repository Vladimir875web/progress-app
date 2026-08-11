import React, { useRef } from "react";
import { Calendar } from "lucide-react";

function fmtDatePickerLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "numeric", year: "numeric" });
}

/** Поле даты с иконкой — по нажатию открывается системный календарь (как в журнале). */
export function WorkoutDatePicker({ value, onChange }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* fallback */ }
    }
    el.click();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      <button
        type="button"
        onClick={openPicker}
        aria-label="Выбрать дату"
        style={{
          background: "none", border: "none", padding: 0, display: "flex",
          alignItems: "center", color: "#808a9e", flexShrink: 0,
        }}
      >
        <Calendar size={15} />
      </button>
      <button
        type="button"
        onClick={openPicker}
        style={{
          flex: 1, maxWidth: 220, textAlign: "left",
          background: "#1b212f", border: "1px solid #303a50", borderRadius: 8,
          padding: "8px 10px", fontSize: 15, color: "#e8ecf5",
          fontFamily: "'Inter', sans-serif", cursor: "pointer",
        }}
      >
        {fmtDatePickerLabel(value)}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-hidden
        tabIndex={-1}
        style={{
          position: "absolute", opacity: 0, width: 1, height: 1,
          pointerEvents: "none", overflow: "hidden",
        }}
      />
    </div>
  );
}
