import { useState, useEffect } from "react";
import api from "../api";

function MetricCard({ icon, label, value, suffix = "", color, sub }) {
  return (
    <div className="metric-card" style={{ "--mc-color": color }}>
      <div className="mc-icon">{icon}</div>
      <div className="mc-value" style={{ color }}>{value}{suffix}</div>
      <div className="mc-label">{label}</div>
      {sub && <div className="mc-sub">{sub}</div>}
    </div>
  );
}

function RateRow({ label, value, color, icon }) {
  return (
    <div className="rate-row">
      <span className="rate-icon">{icon}</span>
      <span className="rate-label">{label}</span>
      <div className="rate-bar-track">
        <div className="rate-bar-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="rate-pct" style={{ color }}>{value}%</span>
    </div>
  );
}

export default function Report() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("dashboard/report/")
      .then((r) => setReport(r.data))
      .catch(() => setReport({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
      <div className="ai-orb" style={{ width: 40, height: 40 }} />
    </div>
  );

  const r = report || {};

  return (
    <div className="report-wrap">
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
        Complete analytics for all campaigns and follow-ups.
      </p>

      {/* Volume metrics */}
      <div className="metrics-grid">
        <MetricCard icon="👥" label="Total Leads" value={r.total_leads || 0} color="#6366f1" sub="Imported all time" />
        <MetricCard icon="📧" label="Emails Sent" value={r.total_sent || 0} color="#22d3a5" sub="Initial outreach" />
        <MetricCard icon="🔄" label="Follow-ups" value={r.total_followups || 0} color="#a78bfa" sub="Auto follow-ups sent" />
        <MetricCard icon="💬" label="Replies" value={r.total_replied || 0} color="#f59e0b" sub="Leads who responded" />
        <MetricCard icon="🤖" label="Auto-Replied" value={r.total_auto_replied || 0} color="#22d3a5" sub="AI auto-responses sent" />
        <MetricCard icon="❌" label="Failed" value={r.total_failed || 0} color="#f43f5e" sub="Delivery errors" />
      </div>

      {/* Rate breakdown */}
      <div className="card rates-card">
        <div className="section-title" style={{ marginBottom: 20 }}>📊 Engagement Rates</div>
        <div className="rates-list">
          <RateRow label="Delivery Rate" value={r.delivery_rate || 0} color="#22d3a5" icon="✅" />
          <RateRow label="Open Rate" value={r.open_rate || 0} color="#6366f1" icon="👁" />
          <RateRow label="Click Rate" value={r.click_rate || 0} color="#a78bfa" icon="🖱" />
          <RateRow label="Reply Rate" value={r.reply_rate || 0} color="#f59e0b" icon="💬" />
          <RateRow label="Response Rate" value={r.response_rate || 0} color="#22d3a5" icon="📈" />
        </div>
      </div>

      {/* Inbox health tips */}
      <div className="card inbox-health">
        <div className="section-title" style={{ marginBottom: 14 }}>📬 Inbox Health Tips</div>
        <div className="health-list">
          <div className={`health-item ${(r.delivery_rate || 0) >= 90 ? "good" : "warn"}`}>
            <span>{(r.delivery_rate || 0) >= 90 ? "✅" : "⚠️"}</span>
            <div>
              <strong>Delivery Rate {r.delivery_rate || 0}%</strong>
              <p>{(r.delivery_rate || 0) >= 90 ? "Excellent! Emails reaching inbox." : "Some emails may be going to spam. Check warmup settings."}</p>
            </div>
          </div>
          <div className={`health-item ${(r.open_rate || 0) >= 20 ? "good" : (r.open_rate || 0) >= 10 ? "warn" : "bad"}`}>
            <span>{(r.open_rate || 0) >= 20 ? "✅" : "⚠️"}</span>
            <div>
              <strong>Open Rate {r.open_rate || 0}%</strong>
              <p>{(r.open_rate || 0) >= 20 ? "Good open rate. Subject lines are working." : "Low open rate. Try improving subject lines in email style settings."}</p>
            </div>
          </div>
          <div className={`health-item ${(r.reply_rate || 0) >= 5 ? "good" : "warn"}`}>
            <span>{(r.reply_rate || 0) >= 5 ? "✅" : "⚠️"}</span>
            <div>
              <strong>Reply Rate {r.reply_rate || 0}%</strong>
              <p>{(r.reply_rate || 0) >= 5 ? "Great engagement! Keep personalizing emails." : "Low replies. Make sure your profile and requirements are well-filled in Campaign settings."}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}