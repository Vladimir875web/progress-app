const RU_DOW = { Пн: 1, Вт: 2, Ср: 3, Чт: 4, Пт: 5, Сб: 6, Вс: 0 };

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function isProgramDateKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(key));
}

export function fmtDateLong(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export function fmtDateShort(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit",
  });
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Ближайшая дата для legacy-ключа (Пн, Ср…) от заданной точки. */
export function legacyDayKeyToDate(key, fromIso = todayISO()) {
  const dow = RU_DOW[String(key).trim()];
  if (dow === undefined) return null;
  let cur = fromIso;
  for (let i = 0; i < 14; i++) {
    if (new Date(cur + "T00:00:00").getDay() === dow) return cur;
    cur = addDays(cur, 1);
  }
  return null;
}

/** Конвертирует старые ключи (Пн/Ср) в ISO-даты; ISO-ключи оставляет как есть. */
export function migrateLegacyProgramDays(days, fromIso = todayISO()) {
  const out = {};
  for (const [key, exercises] of Object.entries(days || {})) {
    if (isProgramDateKey(key)) {
      out[key] = exercises;
      continue;
    }
    const dateKey = legacyDayKeyToDate(key, fromIso);
    if (dateKey && !out[dateKey]) out[dateKey] = exercises;
  }
  return out;
}

export function getWorkoutDates(days) {
  return Object.keys(days || {})
    .filter((k) => isProgramDateKey(k) && (days[k]?.length ?? 0) > 0)
    .sort();
}

export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(iso);
  }
  return cells;
}

export const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const WEEKDAY_HEADERS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
