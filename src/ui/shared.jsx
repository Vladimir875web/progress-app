import React from "react";
import { Check, Save } from "lucide-react";

export function SyncIndicator({ label = "Синхронизировано" }) {
  return (
    <div style={{
      position: "fixed", top: 10, right: 14, display: "flex", alignItems: "center", gap: 5,
      fontSize: 11, color: "#6a9e7a", zIndex: 30, pointerEvents: "none",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4caf50", flexShrink: 0 }} />
      {label}
    </div>
  );
}

export function StickySaveBar({ onSave, saved, saving, label = "Сохранить тренировку" }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
      background: "linear-gradient(to top, #0e111a 65%, transparent)",
      padding: "10px 16px calc(10px + env(safe-area-inset-bottom, 0px))",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={onSave} disabled={saving} style={{
          width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
          background: saved ? "#4a7a5a" : "#e0a940", color: "#120f08", fontWeight: 800, fontSize: 15,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          opacity: saving ? 0.7 : 1, boxShadow: "0 -4px 20px rgba(0,0,0,0.35)",
        }}>
          {saved ? <><Check size={17} /> Сохранено</> : saving ? "Сохранение…" : <><Save size={17} /> {label}</>}
        </button>
      </div>
    </div>
  );
}

export function RoleSwitchLink({ onResetRole, label = "Сменить роль" }) {
  return (
    <button onClick={onResetRole} style={{
      background: "none", border: "none", color: "#5a6378", fontSize: 11.5,
      padding: "12px 0", textDecoration: "underline", textUnderlineOffset: 3,
    }}>{label}</button>
  );
}
