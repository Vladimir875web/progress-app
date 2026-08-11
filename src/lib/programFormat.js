const EMPTY_SET = () => ({ weight: "", reps: "" });

export function parseTargetToSets(target) {
  if (!target) return [EMPTY_SET(), EMPTY_SET(), EMPTY_SET()];
  const parts = String(target).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [EMPTY_SET(), EMPTY_SET(), EMPTY_SET()];
  const sets = parts.map((part) => {
    const m = part.match(/(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)/);
    if (m) return { weight: m[1].replace(",", "."), reps: m[2] };
    const range = part.match(/^(\d+)\s*[×xX*]\s*(\d+)/);
    if (range) return { weight: "", reps: range[2] };
    return EMPTY_SET();
  });
  while (sets.length < 3) sets.push(EMPTY_SET());
  return sets.slice(0, 3);
}

export function setsToTarget(sets) {
  return (sets || [])
    .filter((s) => s.weight || s.reps)
    .map((s) => `${s.weight || "—"}×${s.reps || "—"}`)
    .join(", ");
}

export function normalizeExercise(ex) {
  const name = ex?.name || "";
  let sets;
  if (Array.isArray(ex?.sets) && ex.sets.length) {
    sets = ex.sets.map((s) => ({
      weight: s.weight != null ? String(s.weight) : "",
      reps: s.reps != null ? String(s.reps) : "",
    }));
  } else {
    sets = parseTargetToSets(ex?.target);
  }
  while (sets.length < 3) sets.push(EMPTY_SET());
  sets = sets.slice(0, 3);
  return { name, sets, target: setsToTarget(sets) };
}

export function normalizeProgramDays(days) {
  const out = {};
  for (const [day, exercises] of Object.entries(days || {})) {
    out[day] = (exercises || []).map(normalizeExercise);
  }
  return out;
}

export function serializeExercise(ex) {
  const norm = normalizeExercise(ex);
  return { name: norm.name, sets: norm.sets, target: norm.target };
}

export function serializeProgramDays(days) {
  const out = {};
  for (const [day, exercises] of Object.entries(days || {})) {
    out[day] = (exercises || []).map(serializeExercise);
  }
  return out;
}

/** Формат журнала: только name + target (как в workout-tracker). */
export function toJournalExercise(ex) {
  const norm = normalizeExercise(ex);
  return {
    name: norm.name,
    target: norm.target || "3×10–12",
  };
}

export function toJournalProgramDays(days) {
  const out = {};
  for (const [day, exercises] of Object.entries(days || {})) {
    out[day] = (exercises || []).map(toJournalExercise);
  }
  return out;
}

export function serializeJournalProgramDays(days) {
  const out = {};
  for (const [day, exercises] of Object.entries(days || {})) {
    out[day] = (exercises || [])
      .map((ex) => ({
        name: String(ex?.name || "").trim(),
        target: String(ex?.target || "3×10–12").trim() || "3×10–12",
      }))
      .filter((ex) => ex.name);
  }
  return out;
}
