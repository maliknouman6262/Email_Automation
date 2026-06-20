import { useState, useEffect, useCallback } from "react";
import api from "../api";

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function MetricCard({ icon, label, value, color, sub }) {
  return (
    <div className="metric-card" style={{ "--mc-color": color }}>
      <div className="mc-icon">{icon}</div>
      <div className="mc-value" style={{ color }}>{value}</div>
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

function Badge({ type }) {
  const map = {
    opened:    { label: "Opened",    bg: "#6366f1" },
    clicked:   { label: "Clicked",   bg: "#a78bfa" },
    replied:   { label: "Replied",   bg: "#f59e0b" },
    sent:      { label: "Sent",      bg: "#22d3a5" },
    pending:   { label: "Pending",   bg: "#64748b" },
    failed:    { label: "Failed",    bg: "#f43f5e" },
    followup:  { label: "Follow-up", bg: "#0ea5e9" },
    auto_reply:{ label: "Auto-replied", bg: "#10b981" },
  };
  const b = map[type] || map.sent;
  return (
    <span style={{
      background: b.bg + "22", color: b.bg,
      border: `1px solid ${b.bg}44`,
      borderRadius: 6, padding: "2px 8px",
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {b.label}
    </span>
  );
}

function EmailRow({ log, isPending }) {
  const getStatus = () => {
    if (isPending) return "pending";
    if (log.auto_replied) return "auto_reply";
    if (log.replied) return "replied";
    if (log.clicked) return "clicked";
    if (log.opened) return "opened";
    if (log.is_followup) return "followup";
    return "sent";
  };

  return (
    <tr style={{ borderBottom: "1px solid var(--border, #1e293b)" }}>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text, #f1f5f9)" }}>{log.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted, #64748b)", marginTop: 2 }}>{log.email}</div>
      </td>
      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted, #64748b)" }}>{log.company}</td>
      <td style={{ padding: "10px 12px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--muted, #64748b)" }}>
        {isPending ? "⏳ Queued..." : log.subject}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "center" }}>
        <Badge type={getStatus()} />
        {log.is_followup && !isPending && (
          <div style={{ fontSize: 10, color: "#0ea5e9", marginTop: 3 }}>follow-up</div>
        )}
      </td>
      <td style={{ padding: "10px 12px", textAlign: "center" }}>
        {!isPending && (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", fontSize: 12 }}>
            <span title={`Opened ${log.open_count || 0}x`}
              style={{ color: log.opened ? "#6366f1" : "#334155", display: "flex", alignItems: "center", gap: 3 }}>
              👁 <strong>{log.open_count || 0}</strong>
            </span>
            <span title={`Clicked ${log.click_count || 0}x`}
              style={{ color: log.clicked ? "#a78bfa" : "#334155", display: "flex", alignItems: "center", gap: 3 }}>
              🖱 <strong>{log.click_count || 0}</strong>
            </span>
            <span title={log.replied ? "Replied ✓" : "No reply"}
              style={{ color: log.replied ? "#f59e0b" : "#334155" }}>
              💬 {log.replied ? "✓" : "–"}
            </span>
          </div>
        )}
      </td>
      <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--muted, #64748b)", whiteSpace: "nowrap" }}>
        {isPending ? `Created ${timeAgo(log.created_at)}` : log.time_ago}
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const [stats, setStats]       = useState(null);
  const [emails, setEmails]     = useState({ pending: [], sent: [] });
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, emailsRes] = await Promise.all([
        api.get("dashboard/report/"),
        api.get("dashboard/emails/"),
      ]);
      setStats(statsRes.data);
      setEmails(emailsRes.data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchAll, 15000); // 15 sec refresh
    return () => clearInterval(t);
  }, [autoRefresh, fetchAll]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <div className="ai-orb" style={{ width: 40, height: 40 }} />
    </div>
  );

  const r = stats || {};
  const pendingList = emails.pending || [];
  const sentList    = emails.sent    || [];

  // ✅ FIXED: Deduplicate sent list by log id
  const uniqueSentList = sentList.filter((log, index, self) =>
    index === self.findIndex(l => l.id === log.id)
  );

  const displayList =
    tab === "pending" ? pendingList.map(l => ({ ...l, _isPending: true })) :
    tab === "sent"    ? uniqueSentList.map(l => ({ ...l, _isPending: false })) :
    [
      ...pendingList.map(l => ({ ...l, _isPending: true })),
      ...uniqueSentList.map(l => ({ ...l, _isPending: false })),
    ];

  return (
    <div style={{ padding: "0 0 40px" }}>
      <p style={{ color: "var(--muted, #64748b)", fontSize: 14, marginBottom: 20 }}>
        Live overview — auto-refreshes every 15 seconds.
        {lastUpdated && (
          <span style={{ marginLeft: 8, color: "#22d3a5" }}>
            Last updated: {timeAgo(lastUpdated)}
          </span>
        )}
      </p>

      {/* Metric Cards */}
      <div className="metrics-grid" style={{ marginBottom: 20 }}>
        <MetricCard icon="👥" label="Total Leads"  value={r.total_leads || 0}     color="#6366f1" sub="All time" />
        <MetricCard icon="⏳" label="Pending"       value={pendingList.length}      color="#64748b" sub="Queued to send" />
        <MetricCard icon="📧" label="Emails Sent"  value={r.total_sent || 0}       color="#22d3a5" sub="Initial outreach" />
        <MetricCard icon="🔄" label="Follow-ups"   value={r.total_followups || 0}  color="#a78bfa" sub="Auto sent" />
        <MetricCard icon="💬" label="Replies"      value={r.total_replied || 0}    color="#f59e0b" sub="Responded" />
        <MetricCard icon="❌" label="Failed"        value={r.total_failed || 0}     color="#f43f5e" sub="Errors" />
      </div>

      {/* Engagement Rates */}
      <div className="card rates-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="section-title">📊 Engagement Rates</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted, #64748b)" }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: autoRefresh ? "#22d3a5" : "#64748b",
              display: "inline-block",
              animation: autoRefresh ? "pulse 2s infinite" : "none",
            }} />
            {autoRefresh ? "Live" : "Paused"}
            <button onClick={() => setAutoRefresh(v => !v)} style={{
              background: "transparent", border: "1px solid var(--border, #1e293b)",
              color: "var(--muted, #64748b)", borderRadius: 6,
              padding: "2px 8px", cursor: "pointer", fontSize: 11,
            }}>
              {autoRefresh ? "Pause" : "Resume"}
            </button>
            <button onClick={fetchAll} style={{
              background: "transparent", border: "1px solid var(--border, #1e293b)",
              color: "var(--muted, #64748b)", borderRadius: 6,
              padding: "2px 8px", cursor: "pointer", fontSize: 11,
            }}>
              🔄 Refresh
            </button>
          </div>
        </div>
        <div className="rates-list">
          <RateRow label="Delivery Rate" value={r.delivery_rate || 0} color="#22d3a5" icon="✅" />
          <RateRow label="Open Rate"     value={r.open_rate || 0}     color="#6366f1" icon="👁" />
          <RateRow label="Click Rate"    value={r.click_rate || 0}    color="#a78bfa" icon="🖱" />
          <RateRow label="Reply Rate"    value={r.reply_rate || 0}    color="#f59e0b" icon="💬" />
          <RateRow label="Response Rate" value={r.response_rate || 0} color="#22d3a5" icon="📈" />
        </div>
      </div>

      {/* Email Activity Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border, #1e293b)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div className="section-title">📬 Email Activity</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { key: "all",     label: `All (${pendingList.length + uniqueSentList.length})` },
              { key: "pending", label: `⏳ Pending (${pendingList.length})` },
              { key: "sent",    label: `✅ Sent (${uniqueSentList.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: tab === t.key ? "var(--accent, #6366f1)" : "transparent",
                color: tab === t.key ? "#fff" : "var(--muted, #64748b)",
                border: `1px solid ${tab === t.key ? "var(--accent, #6366f1)" : "var(--border, #1e293b)"}`,
                borderRadius: 6, padding: "4px 12px",
                cursor: "pointer", fontSize: 12,
                fontWeight: tab === t.key ? 600 : 400,
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {displayList.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted, #64748b)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div>No emails yet. Upload leads to get started.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{
                  background: "var(--surface2, #0f172a)", fontSize: 11,
                  color: "var(--muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em"
                }}>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Lead</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Company</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Subject</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Opens · Clicks · Reply</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((log, i) => (
                  <EmailRow
                    key={`${log._isPending ? "p" : "s"}-${log.id}-${i}`}
                    log={log}
                    isPending={log._isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inbox Health */}
      <div className="card inbox-health" style={{ marginTop: 20 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>📬 Inbox Health</div>
        <div className="health-list">
          <div className={`health-item ${(r.delivery_rate||0) >= 90 ? "good" : "warn"}`}>
            <span>{(r.delivery_rate||0) >= 90 ? "✅" : "⚠️"}</span>
            <div>
              <strong>Delivery Rate {r.delivery_rate||0}%</strong>
              <p>{(r.delivery_rate||0) >= 90 ? "Excellent! Emails reaching inbox." : "Some emails going to spam."}</p>
            </div>
          </div>
          <div className={`health-item ${(r.open_rate||0) >= 20 ? "good" : "warn"}`}>
            <span>{(r.open_rate||0) >= 20 ? "✅" : "⚠️"}</span>
            <div>
              <strong>Open Rate {r.open_rate||0}%</strong>
              <p>{(r.open_rate||0) >= 20 ? "Good open rate!" : "Low open rate. Improve subject lines."}</p>
            </div>
          </div>
          <div className={`health-item ${(r.reply_rate||0) >= 5 ? "good" : "warn"}`}>
            <span>{(r.reply_rate||0) >= 5 ? "✅" : "⚠️"}</span>
            <div>
              <strong>Reply Rate {r.reply_rate||0}%</strong>
              <p>{(r.reply_rate||0) >= 5 ? "Great engagement!" : "Low replies. Fill profile properly."}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}