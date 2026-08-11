import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES, WEEKDAY_HEADERS, monthGrid, todayISO, fmtDateShort } from "../lib/programDates";

export function WorkoutCalendar({ selectedDate, onSelectDate, workoutDates = [] }) {
  const initial = selectedDate || todayISO();
  const [viewYear, setViewYear] = React.useState(() => parseInt(initial.slice(0, 4), 10));
  const [viewMonth, setViewMonth] = React.useState(() => parseInt(initial.slice(5, 7), 10) - 1);

  React.useEffect(() => {
    if (!selectedDate) return;
    setViewYear(parseInt(selectedDate.slice(0, 4), 10));
    setViewMonth(parseInt(selectedDate.slice(5, 7), 10) - 1);
  }, [selectedDate]);

  const workoutSet = new Set(workoutDates);
  const today = todayISO();
  const cells = monthGrid(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div style={{
      background: "#171c29", border: "1px solid #2b344a", borderRadius: 10,
      padding: 12, marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={prevMonth} style={{ background: "none", border: "none", color: "#808a9e", padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#e8ecf5" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>
        <button type="button" onClick={nextMonth} style={{ background: "none", border: "none", color: "#808a9e", padding: 4 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAY_HEADERS.map((h) => (
          <div key={h} style={{ textAlign: "center", fontSize: 10, color: "#5a6378", fontWeight: 600, padding: "2px 0" }}>{h}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e-${i}`} />;
          const selected = iso === selectedDate;
          const hasWorkout = workoutSet.has(iso);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              style={{
                aspectRatio: "1", borderRadius: 8, border: "none", padding: 0,
                background: selected ? "#e0a940" : hasWorkout ? "#1b212f" : "transparent",
                color: selected ? "#120f08" : isToday ? "#e0a940" : "#808a9e",
                fontWeight: selected || isToday ? 700 : 500,
                fontSize: 12,
                position: "relative",
                outline: isToday && !selected ? "1px solid #e0a940" : "none",
              }}
            >
              {parseInt(iso.slice(8), 10)}
              {hasWorkout && !selected && (
                <span style={{
                  position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)",
                  width: 4, height: 4, borderRadius: "50%", background: "#e0a940",
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <input
          type="date"
          value={selectedDate || today()}
          onChange={(e) => e.target.value && onSelectDate(e.target.value)}
          style={{ width: 150, fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#808a9e" }}>
          {selectedDate ? fmtDateShort(selectedDate) : "—"}
        </span>
      </div>
    </div>
  );
}

function today() {
  return todayISO();
}
