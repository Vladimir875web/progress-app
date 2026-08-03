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
