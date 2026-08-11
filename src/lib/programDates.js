const RU_DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function isProgramDateKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(key));
}

/** ISO-даты из календарной версии → дни недели (Пн, Ср…). */
export function migrateDateKeysToWeekdays(days) {
  const out = {};
  for (const [key, exercises] of Object.entries(days || {})) {
    if (isProgramDateKey(key)) {
      const dow = RU_DOW[new Date(key + "T00:00:00").getDay()];
      out[dow] = exercises;
    } else {
      out[key] = exercises;
    }
  }
  return out;
}
