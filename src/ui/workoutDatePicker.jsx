import React from "react";
import { Calendar } from "lucide-react";

const dateInputStyle = {
  flex: 1,
  maxWidth: 220,
  background: "#1b212f",
  border: "1px solid #303a50",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 15,
  color: "#e8ecf5",
  fontFamily: "'Inter', sans-serif",
  colorScheme: "dark",
  cursor: "pointer",
};

/** Поле даты с иконкой — нативный input type="date", как в локальном журнале. */
export function WorkoutDatePicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      <Calendar size={15} color="#808a9e" style={{ flexShrink: 0, pointerEvents: "none" }} aria-hidden />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Выбрать дату"
        style={dateInputStyle}
      />
    </div>
  );
}
