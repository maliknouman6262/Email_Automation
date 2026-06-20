import { useState, useEffect } from "react";
import api from "../api";

const DAY_OPTIONS = [
  { label: "1 day", value: 1 },
  { label: "2 days", value: 2 },
  { label: "3 days", value: 3 },
  { label: "5 days", value: 5 },
  { label: "7 days", value: 7 },
  { label: "10 days", value: 10 },
];

export default function FollowUpPanel() {
  const [settings, setSettings] = useState({
    enabled: true,
    max_attempts: 2,
    followup_days: "2,5",
    auto_reply_enabled: false,
    test_mode: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("followup-settings/").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const daysArray = settings.followup_days
    ? settings.followup_days.split(",").map((d) => parseInt(d.trim())).filter(Boolean)
    : [];

  function setAttempts(n) {
    const currentDays = [...daysArray];
    while (currentDays.length < n) currentDays.push((currentDays[currentDays.length - 1] || 0) + 3);
    const trimmed = currentDays.slice(0, n);
    setSettings({ ...settings, max_attempts: n, followup_days: trimmed.join(",") });
  }

  function setDay(index, value) {
    const newDays = [...daysArray];
    newDays[index] = value;
    setSettings({ ...settings, followup_days: newDays.join(",") });
  }

  async function save() {
    setSaving(true);
    try {
      await api.post("followup-settings/", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <div className="followup-panel">

      {/* ── Test Mode Toggle ── */}
      <div className="fp-row" style={{
        background: settings.test_mode ? "#f59e0b11" : "transparent",
        border: settings.test_mode ? "1px solid #f59e0b44" : "1px solid transparent",
        borderRadius: 10, padding: "12px 16px", marginBottom: 4,
      }}>
        <div>
          <div className="fp-title" style={{ color: settings.test_mode ? "#f59e0b" : undefined }}>
            🧪 Test Mode
          </div>
          <div className="fp-sub">
            {settings.test_mode
              ? "Follow-ups send in 5 min · Auto-reply checks every 5 min"
              : "Follow-ups send after selected days · Normal production timing"}
          </div>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={settings.test_mode}
            onChange={(e) => setSettings({ ...settings, test_mode: e.target.checked })} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
        </label>
      </div>

      {/* ── Auto Follow-ups Toggle ── */}
      <div className="fp-row" style={{ marginTop: 12 }}>
        <div>
          <div className="fp-title">🔄 Auto Follow-ups</div>
          <div className="fp-sub">Send follow-up emails to leads who don't respond</div>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Max attempts */}
          <div className="fp-section">
            <div className="fp-label">Number of Follow-ups</div>
            <div className="attempt-btns">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={`attempt-btn ${settings.max_attempts === n ? "active" : ""}`}
                  onClick={() => setAttempts(n)}
                >
                  {n} {n === 1 ? "follow-up" : "follow-ups"}
                </button>
              ))}
            </div>
          </div>

          {/* Day selectors */}
          <div className="fp-section">
            <div className="fp-label">
              Send Each Follow-up After
              {settings.test_mode && (
                <span style={{
                  marginLeft: 8, fontSize: 11, color: "#f59e0b",
                  background: "#f59e0b22", padding: "2px 8px", borderRadius: 4
                }}>
                  🧪 Test: 5 min each
                </span>
              )}
            </div>
            <div className="day-selectors">
              {Array.from({ length: settings.max_attempts }).map((_, i) => (
                <div key={i} className="day-selector-row">
                  <span className="day-label">Follow-up {i + 1}</span>
                  <div className="day-chips">
                    {DAY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={`day-chip ${daysArray[i] === opt.value ? "active" : ""}`}
                        onClick={() => setDay(i, opt.value)}
                        style={{ opacity: settings.test_mode ? 0.5 : 1 }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule preview */}
          <div className="fp-schedule-preview">
            <div className="fps-title">📅 Schedule Preview</div>
            <div className="fps-timeline">
              <div className="fps-item fps-initial">
                <span className="fps-dot initial" />
                <span>Day 0 — Initial email sent</span>
              </div>
              {daysArray.slice(0, settings.max_attempts).map((day, i) => (
                <div key={i} className="fps-item">
                  <span className="fps-dot followup" />
                  <span>
                    {settings.test_mode ? `5 min` : `Day ${day}`} — Follow-up {i + 1}
                    <span className="fps-note"> (if no reply)</span>
                  </span>
                </div>
              ))}
              <div className="fps-item fps-stop">
                <span className="fps-dot stop" />
                <span>Stop — no more follow-ups</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Auto-reply toggle */}
      <div className="fp-row fp-divider">
        <div>
          <div className="fp-title">🤖 Auto-Reply Mode</div>
          <div className="fp-sub">
            AI reads replies and responds automatically.
            Ignores spam, ads, and non-business emails.
          </div>
        </div>
        <label className="toggle-switch">
          <input type="checkbox" checked={settings.auto_reply_enabled}
            onChange={(e) => setSettings({ ...settings, auto_reply_enabled: e.target.checked })} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
        </label>
      </div>

      {settings.auto_reply_enabled && (
        <div className="auto-reply-info">
          <div className="ari-row"><span>✅</span> Genuine business replies → AI responds</div>
          <div className="ari-row"><span>🚫</span> Ads, newsletters, notifications → ignored</div>
          <div className="ari-row"><span>🚫</span> Out-of-office, no-reply → ignored</div>
          <div className="ari-row"><span>⏱</span> Checks inbox every {settings.test_mode ? "5 minutes" : "15 minutes"}</div>
        </div>
      )}

      <button className="btn btn-primary save-fp-btn" onClick={save} disabled={saving}>
        {saving ? <><span className="spinner" /> Saving…</> : saved ? "✅ Saved!" : "💾 Save Settings"}
      </button>
    </div>
  );
}