import { useState, useEffect } from "react";
import api from "../api";

function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return val;
}

function StatCard({ label, value, sub, color, icon, suffix = "" }) {
  const animated = useCountUp(typeof value === "number" ? Math.round(value) : 0);
  return (
    <div className="stat-card" style={{ "--accent": color }}>
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{animated.toLocaleString()}{suffix}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

// ── Warmup Panel ─────────────────────────────────────────────
function WarmupPanel({ warmup, onToggle, onAdvanceDay, saving }) {
  if (!warmup) return null;
  const DAILY_LIMIT = 25;
  const pct = Math.round((warmup.emails_sent_today / DAILY_LIMIT) * 100);

  return (
    <div className="card warmup-card">
      <div className="warmup-header">
        <div>
          <div className="section-title">🔥 Warmup Mode</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            Gradually increase sending to avoid spam folder
          </div>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={warmup.is_active} onChange={onToggle} disabled={saving} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
        </label>
      </div>

      {warmup.is_active && (
        <div className="warmup-body">
          <div className="warmup-row">
            <span className="warmup-stat-label">Sent Today</span>
            <span className="warmup-stat-value" style={{ color: "#22d3a5" }}>{warmup.emails_sent_today}</span>
            <span className="warmup-stat-label" style={{ marginLeft: 20 }}>Remaining</span>
            <span className="warmup-stat-value" style={{ color: "#f59e0b" }}>{warmup.remaining_today ?? (25 - warmup.emails_sent_today)}</span>
            <span className="warmup-stat-label" style={{ marginLeft: 20 }}>Daily Cap</span>
            <span className="warmup-stat-value">25</span>
          </div>

          <div className="warmup-progress-wrap">
            <div className="warmup-progress-track">
              <div className="warmup-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="warmup-pct">{pct}%</span>
          </div>

          <div className="warmup-info-box">
            <span className="warmup-info-icon">✅</span>
            <span>Account already warmed up — sending at <strong>25 emails/day</strong> for optimal inbox delivery</span>
          </div>

          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, marginTop: 12 }}
            onClick={onAdvanceDay}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : "→ Advance to Next Day (Testing)"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tracking Card ─────────────────────────────────────────────
function TrackingCard({ tracking }) {
  if (!tracking) return null;
  const { open_rate, click_rate, total_opened, total_clicked, total_sent, followups_sent } = tracking;

  function RateBar({ pct, color }) {
    return (
      <div className="rate-bar-track">
        <div className="rate-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    );
  }

  return (
    <div className="card tracking-card">
      <div className="section-title" style={{ marginBottom: 16 }}>📊 Email Analytics</div>

      <div className="tracking-grid">
        <div className="tracking-item">
          <div className="tracking-icon">👁</div>
          <div className="tracking-info">
            <div className="tracking-label">Open Rate</div>
            <div className="tracking-value" style={{ color: "#6366f1" }}>{open_rate}%</div>
            <div className="tracking-sub">{total_opened} of {total_sent} opened</div>
          </div>
          <RateBar pct={open_rate} color="#6366f1" />
        </div>

        <div className="tracking-item">
          <div className="tracking-icon">🖱</div>
          <div className="tracking-info">
            <div className="tracking-label">Click Rate</div>
            <div className="tracking-value" style={{ color: "#22d3a5" }}>{click_rate}%</div>
            <div className="tracking-sub">{total_clicked} of {total_sent} clicked</div>
          </div>
          <RateBar pct={click_rate} color="#22d3a5" />
        </div>

        <div className="tracking-item">
          <div className="tracking-icon">🔄</div>
          <div className="tracking-info">
            <div className="tracking-label">Follow-ups Sent</div>
            <div className="tracking-value" style={{ color: "#f59e0b" }}>{followups_sent}</div>
            <div className="tracking-sub">Auto follow-up emails</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [warmup, setWarmup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warmupSaving, setWarmupSaving] = useState(false);

  async function load() {
    try {
      const [s, t, w] = await Promise.all([
        api.get("dashboard/stats/"),
        api.get("dashboard/tracking/"),
        api.get("warmup/"),
      ]);
      setStats(s.data);
      setTracking(t.data);
      setWarmup(w.data);
    } catch {
      setStats({ total_leads: 0, sent: 0, pending: 0, failed: 0, recent: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  async function toggleWarmup() {
    setWarmupSaving(true);
    try {
      const r = await api.post("warmup/", { is_active: !warmup.is_active });
      setWarmup((prev) => ({ ...prev, ...r.data }));
    } finally { setWarmupSaving(false); }
  }

  async function advanceDay() {
    setWarmupSaving(true);
    try {
      const r = await api.post("warmup/", { advance_day: true });
      setWarmup((prev) => ({ ...prev, ...r.data }));
    } finally { setWarmupSaving(false); }
  }

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}>
      <div className="ai-orb" style={{ width: 48, height: 48 }} />
    </div>
  );

  const total = stats.total_leads || 0;
  const sent = stats.sent || 0;
  const pending = stats.pending || 0;
  const failed = stats.failed || 0;
  const sentPct = total > 0 ? Math.round((sent / total) * 100) : 0;
  const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
  const recent = stats.recent || [];

  return (
    <div className="dashboard-wrap">

      {/* Stats */}
      <div className="stat-grid">
        <StatCard label="Total Leads" value={total} sub="Imported all time" color="#6366f1" icon="👥" />
        <StatCard label="Emails Sent" value={sent} sub="Delivered successfully" color="#22d3a5" icon="✅" />
        <StatCard label="Pending" value={pending} sub="Queued to send" color="#f59e0b" icon="⏳" />
        <StatCard label="Failed" value={failed} sub="Delivery errors" color="#f43f5e" icon="❌" />
      </div>

      {/* Progress */}
      <div className="card progress-card">
        <div className="progress-header">
          <span className="section-title">Campaign Progress</span>
          <span className="progress-pct">{sentPct}% delivered</span>
        </div>
        <div className="progress-track">
          <div className="progress-seg seg-sent" style={{ width: `${sentPct}%` }} />
          <div className="progress-seg seg-pending" style={{ width: `${pendingPct}%` }} />
        </div>
        <div className="progress-legend">
          <span className="leg-item"><span className="leg-dot" style={{ background: "#22d3a5" }} />Sent ({sent})</span>
          <span className="leg-item"><span className="leg-dot" style={{ background: "#f59e0b" }} />Pending ({pending})</span>
          <span className="leg-item"><span className="leg-dot" style={{ background: "#f43f5e" }} />Failed ({failed})</span>
        </div>
      </div>

      {/* Tracking analytics */}
      <TrackingCard tracking={tracking} />

      {/* Bottom */}
      <div className="dashboard-bottom">
        {/* Activity */}
        <div className="card activity-card">
          <div className="section-header">
            <span className="section-title">Recent Activity</span>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={load}>↻ Refresh</button>
          </div>
          <div className="activity-list">
            {recent.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 16px" }}>
                <div className="empty-icon">📭</div>
                <p>No emails sent yet. Upload leads to get started.</p>
              </div>
            ) : recent.map((item, i) => (
              <div key={i} className="activity-item">
                <div className="activity-avatar"
                  style={{ background: item.status === "sent" ? "rgba(34,211,165,0.15)" : item.status === "failed" ? "rgba(244,63,94,0.15)" : "var(--accent-glow)" }}>
                  {item.name[0].toUpperCase()}
                </div>
                <div className="activity-info">
                  <div className="activity-name">
                    {item.name}
                    {item.is_followup && <span className="followup-tag">follow-up</span>}
                    {item.opened && <span className="followup-tag" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>opened</span>}
                    {item.clicked && <span className="followup-tag" style={{ background: "rgba(34,211,165,0.15)", color: "#22d3a5" }}>clicked</span>}
                    <span className="activity-company"> · {item.company}</span>
                  </div>
                  <div className="activity-email">{item.email}</div>
                </div>
                <div className="activity-right">
                  <span className={`badge badge-${item.status}`}>{item.status}</span>
                  <div className="activity-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="sidebar-cards">
          {/* Quick actions */}
          <div className="card quickactions-card">
            <div className="section-title" style={{ marginBottom: 14 }}>Quick Actions</div>
            <div className="qa-list">
              <button className="qa-btn" onClick={() => window.dispatchEvent(new CustomEvent("nav", { detail: "leads" }))}>
                <span className="qa-icon">📂</span>
                <div><div className="qa-title">Upload Leads</div><div className="qa-sub">CSV, Excel, screenshot, text</div></div>
              </button>
              <button className="qa-btn" onClick={() => window.dispatchEvent(new CustomEvent("nav", { detail: "campaigns" }))}>
                <span className="qa-icon">✍️</span>
                <div><div className="qa-title">Edit My Profile</div><div className="qa-sub">Skills, portfolio, email style</div></div>
              </button>
              <button className="qa-btn" onClick={() => window.dispatchEvent(new CustomEvent("nav", { detail: "campaigns" }))}>
                <span className="qa-icon">👁</span>
                <div><div className="qa-title">Preview AI Email</div><div className="qa-sub">Test before sending</div></div>
              </button>
            </div>
          </div>

          {/* Warmup */}
          <WarmupPanel warmup={warmup} onToggle={toggleWarmup} onAdvanceDay={advanceDay} saving={warmupSaving} />

          {/* System status */}
          <div className="card" style={{ padding: "18px 20px" }}>
            <div className="sys-title" style={{ marginBottom: 12 }}>System Status</div>
            {[
              { label: "Backend API", ok: true },
              { label: "Email (Gmail SMTP)", ok: sent >= 0 },
              { label: "DeepInfra AI", ok: true },
              { label: "Celery Queue", ok: pending >= 0 },
              { label: "Email Tracking", ok: true },
            ].map((item) => (
              <div key={item.label} className="sys-row" style={{ marginBottom: 8 }}>
                <span className="status-dot" style={{ background: item.ok ? "#22d3a5" : "#f43f5e" }} />
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{item.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: item.ok ? "#22d3a5" : "#f43f5e", fontWeight: 600 }}>
                  {item.ok ? "Online" : "Error"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}