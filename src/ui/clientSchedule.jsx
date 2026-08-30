import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Calendar, Clock } from "lucide-react";
import { cloudEnabled, fetchClientSchedule, saveClientSchedule } from "../lib/trainerDb";
import { useClientLanguage } from "./clientLanguage";

const todayISO = () => new Date().toISOString().slice(0, 10);

const FORM_INPUT_HEIGHT = 38;

const inputStyle = {
  background: "#1b212f", border: "1px solid #303a50", color: "#e8ecf5",
  borderRadius: 8, padding: "0 8px", fontSize: 14, width: "100%", minWidth: 0,
  height: FORM_INPUT_HEIGHT, lineHeight: `${FORM_INPUT_HEIGHT - 2}px`,
  boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
};

const dateInputStyle = {
  ...inputStyle,
  fontSize: 13,
  colorScheme: "dark",
  appearance: "none",
  WebkitAppearance: "none",
};

const timeInputStyle = {
  ...inputStyle,
  fontSize: 14,
  colorScheme: "dark",
  textAlign: "center",
};

const TIME_PRESETS = ["09:00", "10:00", "12:00", "17:00", "18:00", "19:00"];

function sessionDateTime(iso, time) {
  return new Date(`${iso}T${time || "00:00"}:00`);
}

function isUpcoming(session) {
  const now = new Date();
  const dt = sessionDateTime(session.date, session.time);
  return dt >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function fmtWeekday(iso, lang) {
  const locales = { ru: "ru-RU", en: "en-GB", cs: "cs-CZ" };
  return new Date(iso + "T12:00:00").toLocaleDateString(locales[lang] || "ru-RU", { weekday: "long" });
}

function SessionRow({ session, readOnly, onDelete, fmtDate, fmtWeekdayLabel, upcoming }) {
  return (
    <div style={{
      background: "#171c29",
      border: `1px solid ${upcoming ? "#3a4a30" : "#2b344a"}`,
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity: upcoming ? 1 : 0.72,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: upcoming ? "rgba(224,169,64,0.15)" : "#1b212f",
        border: `1px solid ${upcoming ? "#e0a940" : "#303a50"}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: upcoming ? "#e0a940" : "#808a9e", lineHeight: 1 }}>
          {new Date(session.date + "T12:00:00").getDate()}
        </div>
        <div style={{ fontSize: 9, color: "#808a9e", textTransform: "uppercase", marginTop: 2 }}>
          {new Date(session.date + "T12:00:00").toLocaleDateString("ru-RU", { month: "short" })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e8ecf5", marginBottom: 2 }}>
          {fmtWeekdayLabel} · {session.time}
        </div>
        <div style={{ fontSize: 12, color: "#808a9e" }}>{fmtDate(session.date)}</div>
        {session.note && (
          <div style={{ fontSize: 12, color: "#5a6378", marginTop: 4 }}>{session.note}</div>
        )}
      </div>
      {!readOnly && (
        <button type="button" onClick={() => onDelete(session.id)} style={{ background: "none", border: "none", padding: 4, flexShrink: 0 }}>
          <Trash2 size={15} color="#5a6378" />
        </button>
      )}
    </div>
  );
}

export function ClientSchedulePanel({ clientCode, disabled, readOnly = false }) {
  const { t, fmtDate, lang } = useClientLanguage();
  const [sessions, setSessions] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), time: "18:00", note: "" });

  useEffect(() => {
    if (disabled || !cloudEnabled()) return;
    fetchClientSchedule(clientCode)
      .then((data) => setSessions(data.sessions || []))
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoaded(true));
  }, [clientCode, disabled]);

  const persist = async (nextSessions) => {
    setSaving(true);
    try {
      await saveClientSchedule(clientCode, { sessions: nextSessions });
      setSessions(nextSessions);
    } catch (e) {
      alert(t("saveError") + " " + e.message);
    }
    setSaving(false);
  };

  const addSession = async () => {
    if (!form.date || !form.time) return;
    const next = [...sessions, {
      id: `sch_${Date.now()}`,
      date: form.date,
      time: form.time,
      note: form.note.trim(),
    }].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    await persist(next);
    setForm({ date: todayISO(), time: "18:00", note: "" });
    setShowForm(false);
  };

  const deleteSession = async (id) => {
    await persist(sessions.filter((s) => s.id !== id));
  };

  const upcoming = useMemo(() => sessions.filter(isUpcoming), [sessions]);
  const past = useMemo(() => sessions.filter((s) => !isUpcoming(s)).reverse(), [sessions]);
  const nextSession = upcoming[0];

  if (disabled) return <div style={{ color: "#808a9e", fontSize: 13 }}>{t("cloudNotConfigured")}</div>;
  if (loadError) return <div style={{ color: "#e2795a", fontSize: 13 }}>{loadError}</div>;
  if (!loaded) return <div style={{ color: "#808a9e", fontSize: 13, padding: "24px 0", textAlign: "center" }}>{t("loading")}</div>;

  return (
    <div style={{ paddingBottom: 8 }}>
      {nextSession && (
        <div style={{
          background: "linear-gradient(145deg, #1f2638 0%, #171c29 100%)",
          border: "1px solid #3a4a30", borderRadius: 14, padding: "16px 14px", marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, color: "#808a9e", fontWeight: 600, marginBottom: 6 }}>
            {readOnly ? t("nextWorkout") : t("nextWorkoutClient")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Calendar size={20} color="#e0a940" />
            <div>
              <div className="display" style={{ fontSize: 22, color: "#e8ecf5", lineHeight: 1.2 }}>
                {fmtWeekday(nextSession.date, lang)}, {nextSession.time}
              </div>
              <div style={{ fontSize: 13, color: "#808a9e", marginTop: 4 }}>{fmtDate(nextSession.date)}</div>
              {nextSession.note && (
                <div style={{ fontSize: 12.5, color: "#5a6378", marginTop: 6 }}>{nextSession.note}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          {!showForm ? (
            <button type="button" onClick={() => setShowForm(true)} disabled={saving} style={{
              width: "100%", padding: "12px 0", borderRadius: 10, marginBottom: 14,
              background: "#e0a940", border: "none", color: "#120f08",
              fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Plus size={16} /> {t("addWorkoutSlot")}
            </button>
          ) : (
            <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e0a940", marginBottom: 12 }}>{t("newWorkoutSlot")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 8, marginBottom: 8, alignItems: "end" }}>
                <label style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 4 }}>{t("date")}</div>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={dateInputStyle} />
                </label>
                <label style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 4 }}>{t("time")}</div>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={timeInputStyle} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                {TIME_PRESETS.map((time) => (
                  <button key={time} type="button" onClick={() => setForm({ ...form, time })}
                    style={{
                      padding: "5px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                      border: form.time === time ? "1px solid #e0a940" : "1px solid #303a50",
                      background: form.time === time ? "rgba(224,169,64,0.12)" : "#1b212f",
                      color: form.time === time ? "#e0a940" : "#808a9e",
                    }}>{time}</button>
                ))}
              </div>
              <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder={t("scheduleNotePlaceholder")} style={{ ...inputStyle, marginBottom: 10, fontSize: 13 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={addSession} disabled={saving} style={{
                  flex: 1, padding: "11px 0", borderRadius: 8, border: "none",
                  background: "#e0a940", color: "#120f08", fontWeight: 700,
                }}>{saving ? t("saving") : t("add")}</button>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: "11px 16px", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e",
                }}>{t("cancel")}</button>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={14} /> {t("upcomingWorkouts")}
      </div>
      {upcoming.length === 0 ? (
        <div style={{ fontSize: 13, color: "#5a6378", padding: "16px 0", textAlign: "center", marginBottom: 14 }}>
          {readOnly ? t("noScheduledWorkoutsClient") : t("noScheduledWorkouts")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {upcoming.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              readOnly={readOnly}
              onDelete={deleteSession}
              fmtDate={fmtDate}
              fmtWeekdayLabel={fmtWeekday(s.date, lang)}
              upcoming
            />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 8 }}>{t("pastWorkouts")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {past.slice(0, readOnly ? 5 : 10).map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                readOnly={readOnly}
                onDelete={deleteSession}
                fmtDate={fmtDate}
                fmtWeekdayLabel={fmtWeekday(s.date, lang)}
                upcoming={false}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
