import React from "react";
import { Link2 } from "lucide-react";
import { getTelegramStartDebugInfo, shouldShowStartDebug } from "../lib/telegram";

export function StartParamDebugBanner({ extra }) {
  const show = shouldShowStartDebug() || Boolean(extra?.includes("error") || extra?.includes("invalid_param"));
  if (!show) return null;
  const info = getTelegramStartDebugInfo();
  return (
    <div style={{
      margin: "8px 0", padding: "8px 10px", borderRadius: 8, fontSize: 10.5, lineHeight: 1.45,
      fontFamily: "monospace", background: "#1a2438", border: "1px solid #2b4470", color: "#9eb8e0",
      wordBreak: "break-all",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#e0a940" }}>DEBUG startapp</div>
      <div>Telegram: {String(info.hasTelegram)} · platform: {info.platform ?? "—"}</div>
      <div>start_param: {info.start_param ?? "—"}</div>
      <div>tgWebAppStartParam: {info.tgWebAppStartParam ?? "—"}</div>
      <div>parsed code: {info.parsedCode ?? "—"}</div>
      {extra && <div style={{ marginTop: 4, color: "#808a9e" }}>{extra}</div>}
    </div>
  );
}

export function ConnectToTrainerPrompt({ onGoProfile }) {
  return (
    <div style={{ padding: "48px 16px", textAlign: "center" }}>
      <Link2 size={32} color="#e0a940" style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Нужно подключение к тренеру</div>
      <div style={{ fontSize: 14, color: "#808a9e", marginBottom: 20, lineHeight: 1.5 }}>
        Программа и упражнения задаёт тренер. Введи код или перейди по ссылке-приглашению.
      </div>
      <button onClick={onGoProfile} style={{
        padding: "12px 24px", borderRadius: 10, border: "none",
        background: "#e0a940", color: "#120f08", fontWeight: 700, fontSize: 14,
      }}>Подключиться в профиле</button>
    </div>
  );
}
