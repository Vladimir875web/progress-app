const RU_DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAY_ORDER = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DOW_ORDER = Object.fromEntries(WEEKDAY_ORDER.map((d, i) => [d, i]));

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Пн, Вт, Ср… — для кнопок дней программы. */
export function sortProgramDayKeys(keys) {
  return [...keys].sort((a, b) => {
    const oa = DOW_ORDER[a];
    const ob = DOW_ORDER[b];
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1;
    if (ob != null) return 1;
    return String(a).localeCompare(String(b), "ru");
  });
}

export function isProgramDateKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(key));
}

export function weekdayFromISO(iso) {
  return RU_DOW[new Date(iso + "T00:00:00").getDay()];
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
