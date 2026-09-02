export const DEFAULT_TRAINER_SET_ROWS = 3;

export function parseNumSets(target) {
  const m = String(target).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 3;
}

export function findLastExerciseSets(logs, dayKey, currentDate, exName) {
  const candidates = Object.values(logs || {})
    .filter((l) => l.day === dayKey && l.date !== currentDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const c of candidates) {
    const ex = c.exercises?.find((e) => e.name === exName);
    const done = ex?.sets?.filter((s) => s.weight || s.reps);
    if (done?.length) return done;
  }
  return null;
}

export function findLastWorkoutDate(logs, dayKey, currentDate, exName) {
  const candidates = Object.values(logs || {})
    .filter((l) => l.day === dayKey && l.date !== currentDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const c of candidates) {
    const ex = c.exercises?.find((e) => e.name === exName);
    const done = ex?.sets?.filter((s) => s.weight && s.reps);
    if (done?.length) return c.date;
  }
  return null;
}

export function newExerciseId() {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function mapSetRow(s) {
  return {
    weight: s.weight != null && s.weight !== "" ? String(s.weight) : "",
    reps: s.reps != null && s.reps !== "" ? String(s.reps) : "",
  };
}

/** Строки подходов для тренера: по умолчанию 3, лишние пустые в конце убираются. */
export function normalizeTrainerSetRows(sets, defaultWeight = "", minRows = DEFAULT_TRAINER_SET_ROWS) {
  const mapped = (sets || []).map(mapSetRow);
  while (mapped.length > minRows) {
    const last = mapped[mapped.length - 1];
    if (last.weight || last.reps) break;
    mapped.pop();
  }
  while (mapped.length < minRows) {
    mapped.push({ weight: defaultWeight, reps: "" });
  }
  return mapped;
}

/** Инициализация подходов для тренера: сохранённая запись → прошлая тренировка → шаблон программы. */
export function initTrainerWorkoutSets(exercises, existingEntry, logs, day, date) {
  const savedList = existingEntry?.exercises || [];
  return (exercises || []).map((raw, idx) => {
    const name = raw?.name || "";
    const target = raw?.target || "3×10–12";
    const prev = savedList.find((e) => e.id && raw.id && e.id === raw.id)
      || savedList.find((e) => e.name === name)
      || savedList[idx];
    const id = prev?.id || raw?.id || newExerciseId();
    const defaultWeight = raw.weight != null ? String(raw.weight) : "";

    if (prev?.sets?.length) {
      return {
        id,
        name,
        target,
        sets: normalizeTrainerSetRows(prev.sets, defaultWeight),
        comment: prev.comment ?? "",
        showComment: Boolean(prev.comment),
      };
    }
    const lastDate = findLastWorkoutDate(logs, day, date, name);
    const lastSets = lastDate ? findLastExerciseSets(logs, day, date, name) : null;
    if (lastSets?.length) {
      return {
        id,
        name,
        target,
        sets: normalizeTrainerSetRows(lastSets, defaultWeight),
        comment: "",
        showComment: false,
        prefilledFrom: lastDate,
      };
    }
    return {
      id,
      name,
      target,
      sets: normalizeTrainerSetRows([], defaultWeight),
      comment: "",
      showComment: false,
    };
  });
}

export function buildExerciseSets({ numSets, savedSets, lastSets }) {
  if (savedSets?.length) {
    return savedSets.map((s) => ({ weight: s.weight ?? "", reps: s.reps ?? "" }));
  }
  if (lastSets?.length) {
    const sets = lastSets.map((s) => ({
      weight: s.weight != null && s.weight !== "" ? String(s.weight) : "",
      reps: s.reps != null && s.reps !== "" ? String(s.reps) : "",
    }));
    while (sets.length < numSets) sets.push({ weight: "", reps: "" });
    return sets;
  }
  return Array.from({ length: numSets }, () => ({ weight: "", reps: "" }));
}
