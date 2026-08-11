import React, { useState, useEffect, useMemo } from "react";
import { Plus, Minus, CreditCard, Banknote, ArrowRightLeft } from "lucide-react";
import { cloudEnabled, fetchClientMembership, saveClientMembership } from "../lib/trainerDb";

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fmtMoney = (n) => `${Number(n).toLocaleString("cs-CZ")} CZK`;

const METHODS = [
  { id: "cash", label: "Наличные", icon: Banknote },
  { id: "card", label: "Карта", icon: CreditCard },
  { id: "transfer", label: "Перевод", icon: ArrowRightLeft },
];

const methodLabel = (id) => METHODS.find((m) => m.id === id)?.label || id;

const inputStyle = {
  background: "#1b212f", border: "1px solid #303a50", color: "#e8ecf5",
  borderRadius: 8, padding: "8px 10px", fontSize: 15, width: "100%", minWidth: 0,
  boxSizing: "border-box", fontFamily: "'Inter', sans-serif",
};

const dateInputStyle = {
  ...inputStyle,
  fontSize: 13,
  colorScheme: "dark",
};

export function ClientMembershipPanel({ clientCode, disabled }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(), amount: "", sessions: "10", method: "card", note: "",
  });

  useEffect(() => {
    if (disabled || !cloudEnabled()) return;
    fetchClientMembership(clientCode)
      .then(setData)
      .catch((e) => setLoadError(e.message));
  }, [clientCode, disabled]);

  const persist = async (next) => {
    setSaving(true);
    try {
      await saveClientMembership(clientCode, next);
      setData(next);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  };

  const lastPackageSessions = useMemo(() => {
    const sorted = [...(data?.payments || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
    return sorted[0]?.sessions || 0;
  }, [data]);

  const progressPct = lastPackageSessions
    ? Math.min(100, Math.round(((data?.remainingSessions || 0) / lastPackageSessions) * 100))
    : 0;

  const addPayment = async () => {
    const sessions = parseInt(form.sessions, 10);
    const amount = parseFloat(String(form.amount).replace(",", "."));
    if (!sessions || sessions < 1) return;
    if (!amount || amount <= 0) return;
    const payment = {
      id: `p_${Date.now()}`,
      date: form.date,
      amount,
      sessions,
      method: form.method,
      note: form.note.trim(),
    };
    const next = {
      remainingSessions: (data?.remainingSessions || 0) + sessions,
      payments: [payment, ...(data?.payments || [])],
    };
    await persist(next);
    setForm({ date: todayISO(), amount: "", sessions: "10", method: "card", note: "" });
    setShowForm(false);
  };

  const useSession = async () => {
    if (!data || data.remainingSessions <= 0) return;
    await persist({ ...data, remainingSessions: data.remainingSessions - 1 });
  };

  if (disabled) return <div style={{ color: "#808a9e", fontSize: 13 }}>Облако недоступно</div>;
  if (loadError) return <div style={{ color: "#e2795a", fontSize: 13 }}>{loadError}</div>;
  if (!data) return <div style={{ color: "#808a9e", fontSize: 13 }}>Загрузка…</div>;

  const remaining = data.remainingSessions;
  const isLow = remaining > 0 && remaining <= 2;
  const isEmpty = remaining === 0;

  return (
    <div style={{ paddingBottom: 8 }}>
      <div style={{
        background: "linear-gradient(145deg, #1f2638 0%, #171c29 100%)",
        border: `1px solid ${isEmpty ? "#5a3a3a" : isLow ? "#6a5a30" : "#2b344a"}`,
        borderRadius: 14, padding: "18px 16px", marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, color: "#808a9e", fontWeight: 600, marginBottom: 6 }}>ОСТАЛОСЬ ТРЕНИРОВОК</div>
        <div className="display" style={{
          fontSize: 52, lineHeight: 1, color: isEmpty ? "#c45a4a" : isLow ? "#e0a940" : "#e8ecf5",
          marginBottom: 10,
        }}>{remaining}</div>
        {lastPackageSessions > 0 && (
          <>
            <div style={{ height: 6, background: "#1b212f", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: "#e0a940", borderRadius: 3, transition: "width .3s" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#5a6378" }}>из {lastPackageSessions} в последнем абонементе</div>
          </>
        )}
        {isEmpty && <div style={{ fontSize: 12.5, color: "#e2795a", marginTop: 8 }}>Абонемент закончился — запиши оплату</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={useSession}
          disabled={saving || remaining <= 0}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #303a50",
            background: "#1b212f", color: remaining > 0 ? "#e8ecf5" : "#5a6378",
            fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Minus size={16} /> −1 тренировка
        </button>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{
            flex: 1.4, padding: "12px 0", borderRadius: 10, border: "none",
            background: "#e0a940", color: "#120f08", fontWeight: 700, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Plus size={16} /> Оплата
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#171c29", border: "1px solid #2b344a", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e0a940", marginBottom: 12 }}>Новая оплата</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8, marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 4 }}>Дата</div>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={dateInputStyle} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 4 }}>Сумма, CZK</div>
              <input type="number" min="0" step="100" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="3000" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 4 }}>Тренировок в абонементе</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["8", "10", "12", "16"].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, sessions: n })}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, fontWeight: 600, fontSize: 13,
                    border: form.sessions === n ? "1px solid #e0a940" : "1px solid #303a50",
                    background: form.sessions === n ? "rgba(224,169,64,0.15)" : "#1b212f",
                    color: form.sessions === n ? "#e0a940" : "#808a9e",
                  }}
                >{n}</button>
              ))}
              <input
                type="number"
                min="1"
                value={form.sessions}
                onChange={(e) => setForm({ ...form, sessions: e.target.value })}
                style={{ ...inputStyle, width: 56, flexShrink: 0, textAlign: "center", padding: "8px 4px" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#808a9e", marginBottom: 6 }}>Способ оплаты</div>
            <div style={{ display: "flex", gap: 6 }}>
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm({ ...form, method: id })}
                  style={{
                    flex: 1, padding: "9px 6px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                    border: form.method === id ? "1px solid #e0a940" : "1px solid #303a50",
                    background: form.method === id ? "rgba(224,169,64,0.12)" : "#1b212f",
                    color: form.method === id ? "#e0a940" : "#808a9e",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Комментарий (необязательно)"
            style={{ ...inputStyle, marginBottom: 10, fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={addPayment}
              disabled={saving}
              style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: "#e0a940", color: "#120f08", fontWeight: 700 }}
            >{saving ? "Сохранение…" : "Записать оплату"}</button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid #303a50", background: "none", color: "#808a9e" }}
            >Отмена</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: "#808a9e", fontWeight: 600, marginBottom: 8 }}>ИСТОРИЯ ОПЛАТ</div>
      {data.payments.length === 0 ? (
        <div style={{ fontSize: 13, color: "#5a6378", padding: "20px 0", textAlign: "center" }}>Оплат пока нет</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.payments.map((p) => (
            <div key={p.id} style={{
              background: "#171c29", border: "1px solid #2b344a", borderRadius: 10,
              padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e8ecf5", marginBottom: 2 }}>{fmtMoney(p.amount)}</div>
                <div style={{ fontSize: 12, color: "#808a9e" }}>
                  {fmtDate(p.date)} · +{p.sessions} трен. · {methodLabel(p.method)}
                </div>
                {p.note && <div style={{ fontSize: 11.5, color: "#5a6378", marginTop: 4 }}>{p.note}</div>}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "#4caf50", background: "rgba(76,175,80,0.12)",
                padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap",
              }}>+{p.sessions}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
