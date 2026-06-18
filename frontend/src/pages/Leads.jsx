import { useState, useRef, useCallback, useEffect } from "react";
import api from "../api";
import FollowUpPanel from "../components/FollowUpPanel";

const ACCEPTED = ".csv,.xlsx,.xls,.txt,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp";

// ── Countdown timer component ────────────────────────────────
function Countdown({ targetSeconds }) {
  const [remaining, setRemaining] = useState(targetSeconds);

  useEffect(() => {
    setRemaining(targetSeconds);
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(t); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [targetSeconds]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const done = remaining === 0;

  return (
    <span className={`countdown ${done ? "countdown-done" : ""}`}>
      {done ? "✅ Sent!" : `${m}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

// ── Test Mode Toggle ─────────────────────────────────────────
function TestModeToggle({ testMode, onChange }) {
  return (
    <div className={`test-mode-bar ${testMode ? "active" : ""}`}>
      <div className="test-mode-left">
        <span className="test-mode-icon">{testMode ? "🧪" : "🚀"}</span>
        <div>
          <div className="test-mode-title">{testMode ? "Test Mode ON" : "Production Mode"}</div>
          <div className="test-mode-sub">
            {testMode
              ? "Emails send in 2–5 min gaps · Follow-up in 5 min"
              : "Emails send in 15–20 min gaps · Follow-up in 24 hrs"}
          </div>
        </div>
      </div>
      <label className="toggle-switch">
        <input type="checkbox" checked={testMode} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-track">
          <span className="toggle-thumb" />
        </span>
      </label>
    </div>
  );
}

// ── Input Zone ───────────────────────────────────────────────
function InputZone({ onAnalyze, loading }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [activeTab, setActiveTab] = useState("file");
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  }, []);

  function removeFile(i) { setFiles((prev) => prev.filter((_, idx) => idx !== i)); }

  function handleFileInput(e) {
    setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    e.target.value = "";
  }

  function canSubmit() {
    return activeTab === "file" ? files.length > 0 : textInput.trim().length > 10;
  }

  function handleSubmit() {
    if (activeTab === "file") onAnalyze({ type: "files", files });
    else onAnalyze({ type: "text", text: textInput });
  }

  return (
    <div className="input-zone-wrap">
      <div className="input-tabs">
        <button className={`input-tab ${activeTab === "file" ? "active" : ""}`} onClick={() => setActiveTab("file")}>
          📁 Upload Files
        </button>
        <button className={`input-tab ${activeTab === "text" ? "active" : ""}`} onClick={() => setActiveTab("text")}>
          📋 Paste Text
        </button>
      </div>

      {activeTab === "file" ? (
        <div>
          <div
            className={`upload-zone ${dragOver ? "drag-over" : ""}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !loading && inputRef.current.click()}
            style={{ marginBottom: files.length ? 14 : 0 }}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} multiple style={{ display: "none" }} onChange={handleFileInput} />
            {loading ? (
              <div className="upload-loading">
                <div className="ai-orb" />
                <p className="upload-main-text">AI analyzing {files.length} file{files.length !== 1 ? "s" : ""}…</p>
                <p className="upload-sub-text">Extracting leads, validating emails</p>
              </div>
            ) : (
              <div className="upload-idle">
                <div className="upload-icon">📂</div>
                <p className="upload-main-text">Drop files here or click to browse</p>
                <p className="upload-sub-text">CSV · Excel · TXT · JSON · Screenshots · Images</p>
                <p className="upload-sub-text" style={{ color: "var(--accent)", marginTop: 4, fontSize: 12 }}>Multiple files supported</p>
                <div className="format-chips" style={{ marginTop: 12 }}>
                  {["CSV", "XLSX", "TXT", "JSON", "PNG", "JPG"].map((f) => <span key={f} className="chip">{f}</span>)}
                </div>
              </div>
            )}
          </div>

          {files.length > 0 && !loading && (
            <div className="file-list">
              {files.map((f, i) => (
                <div key={i} className="file-item">
                  <span className="file-icon">{getFileIcon(f.name)}</span>
                  <span className="file-name">{f.name}</span>
                  <span className="file-size">{(f.size / 1024).toFixed(1)} KB</span>
                  <button className="file-remove" onClick={() => removeFile(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea
            className="text-input-area"
            placeholder={`Paste leads in any format:\n\nJohn Doe, john@acme.com, Acme Inc, Need Python developer\nJane | jane@corp.com | Corp Ltd | React developer needed\n\nAI will extract what it can.`}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={loading}
          />
          {loading && (
            <div className="text-analyzing">
              <div className="ai-orb" style={{ width: 32, height: 32 }} />
              <span>AI is analyzing your text…</span>
            </div>
          )}
        </div>
      )}

      <button
        className="btn btn-primary analyze-btn"
        onClick={handleSubmit}
        disabled={loading || !canSubmit()}
      >
        {loading
          ? <><span className="spinner" /> Analyzing…</>
          : activeTab === "file"
            ? `✨ Analyze ${files.length || ""} file${files.length !== 1 ? "s" : ""}`
            : "✨ Extract Leads from Text"}
      </button>
    </div>
  );
}

function getFileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  return { csv: "📊", xlsx: "📊", xls: "📊", txt: "📄", json: "📋", png: "🖼", jpg: "🖼", jpeg: "🖼", webp: "🖼" }[ext] || "📄";
}

// ── Preview Table ────────────────────────────────────────────
function LeadsPreview({ leads, testMode, onConfirm, onReset, confirming }) {
  const [selected, setSelected] = useState(leads.map((_, i) => i));
  const avgGap = 17.5; // 15-20 min average

  function toggle(i) {
    setSelected((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }
  function toggleAll() {
    setSelected(selected.length === leads.length ? [] : leads.map((_, i) => i));
  }

  const chosenLeads = leads.filter((_, i) => selected.includes(i));

  function getScheduleTime(rankInSelected) {
    const minutes = Math.round((rankInSelected + 1) * avgGap);
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
  }

  return (
    <div>
      <div className="preview-header">
        <div>
          <h3 className="preview-title">
            <span className="ai-label">AI Extracted</span>
            {leads.length} leads found
          </h3>
          <p className="preview-sub">Emails send with 15–20 min random gaps · Follow-up auto-scheduled after 24 hrs</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={onReset}>↩ Start Over</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(chosenLeads)}
            disabled={confirming || chosenLeads.length === 0}
          >
            {confirming
              ? <><span className="spinner" /> Scheduling…</>
              : `✅ Schedule ${chosenLeads.length} email${chosenLeads.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.length === leads.length} onChange={toggleAll} /></th>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Requirement</th>
              <th>Send Time</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const isSelected = selected.includes(i);
              const rank = selected.filter((s) => s < i).length;
              return (
                <tr
                  key={i}
                  style={isSelected ? { background: "var(--accent-glow)" } : { opacity: 0.4 }}
                  onClick={() => toggle(i)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(i)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{lead.name}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{lead.email}</td>
                  <td>{lead.company}</td>
                  <td style={{ color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.requirement || "—"}
                  </td>
                  <td>
                    {isSelected
                      ? <span className="schedule-badge">🕐 {getScheduleTime(rank)}</span>
                      : <span style={{ color: "var(--muted)", fontSize: 12 }}>skipped</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Success + Live Timeline ──────────────────────────────────
function ScheduledSuccess({ result, leads, testMode, onReset, onTestFollowup }) {
  const avgGap = result.avg_gap_minutes || 17.5;
  const [followupSent, setFollowupSent] = useState(false);
  const [sendingFollowup, setSendingFollowup] = useState(false);

  async function handleFollowup() {
    setSendingFollowup(true);
    try {
      await onTestFollowup();
      setFollowupSent(true);
    } finally {
      setSendingFollowup(false);
    }
  }

  return (
    <div>
      <div className="success-state">
        <div className="success-icon">🚀</div>
        <h3 className="success-title">Emails Scheduled!</h3>
        <p className="success-sub">
          <strong>{result.scheduled}</strong> emails queued with 15–20 min gaps
        </p>
        <p className="success-sub" style={{ color: "var(--muted)" }}>
          Follow-up auto-scheduled 24 hrs after each email
        </p>
        {result.skipped_duplicates > 0 && (
          <p className="success-sub" style={{ color: "var(--warn)" }}>
            {result.skipped_duplicates} duplicates skipped.
          </p>
        )}
      </div>

      {/* Live countdown timeline */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <span className="section-title">📅 Live Send Schedule</span>

        </div>
        <div className="timeline">
          {leads.slice(0, result.scheduled).map((lead, i) => {
            const totalSeconds = Math.round((i + 1) * avgGap * 60);
            return (
              <div key={i} className="timeline-item">
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <span className="timeline-name">{lead.name}</span>
                  <span className="timeline-company">{lead.company}</span>
                  <span className="timeline-email">{lead.email}</span>
                </div>
                <Countdown targetSeconds={totalSeconds} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Follow-up test */}
      <div className="card followup-card">
        <div className="followup-header">
          <div>
            <div className="section-title">🔄 Follow-up Test</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              Follow-up auto-scheduled 24 hours after each initial email
            </div>
          </div>
            <span className="badge badge-sent">✅ Auto-scheduled for 24 hrs later</span>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={onReset}>Upload More Leads</button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function Leads() {
  const [step, setStep] = useState("upload");
  const testMode = false; // Production mode
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [confirmedLeads, setConfirmedLeads] = useState([]);
  const [scheduleResult, setScheduleResult] = useState(null);
  const [alert, setAlert] = useState(null);

  function showAlert(type, msg) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  }

  async function handleAnalyze({ type, files, text }) {
    setAnalyzing(true);
    try {
      let allLeads = [];
      if (type === "text") {
        const blob = new Blob([text], { type: "text/plain" });
        const fd = new FormData();
        fd.append("file", blob, "pasted_data.txt");
        const r = await api.post("leads/upload/", fd, { headers: { "Content-Type": "multipart/form-data" } });
        allLeads = r.data.leads || [];
      } else {
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          const r = await api.post("leads/upload/", fd, { headers: { "Content-Type": "multipart/form-data" } });
          if (r.data.leads) allLeads = [...allLeads, ...r.data.leads];
        }
        const seen = new Set();
        allLeads = allLeads.filter((l) => { if (seen.has(l.email)) return false; seen.add(l.email); return true; });
      }

      if (!allLeads.length) { showAlert("error", "AI could not find valid leads."); return; }
      setExtractedLeads(allLeads);
      setStep("preview");
    } catch (e) {
      showAlert("error", e.response?.data?.error || "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirm(chosenLeads) {
    setConfirming(true);
    let senderProfile = {};
    try { const pr = await api.get("profile/"); senderProfile = pr.data.profile || {}; } catch {}
    try {
      const r = await api.post("leads/confirm/", {
        leads: chosenLeads,
        sender_profile: senderProfile,

      });
      setConfirmedLeads(chosenLeads);
      setScheduleResult(r.data);
      setStep("success");
    } catch (e) {
      showAlert("error", e.response?.data?.error || "Scheduling failed.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleTestFollowup() {
    // Schedule followup for first confirmed lead
    if (!confirmedLeads.length) return;
    // We need a lead ID — fetch leads to get the DB id
    try {
      const r = await api.get("leads/");
      const firstMatch = r.data.find((l) => l.email === confirmedLeads[0].email);
      if (firstMatch) {
        await api.post("followups/run/", { lead_id: firstMatch.id, test_mode: true });
        showAlert("success", "Follow-up scheduled in 5 minutes!");
      }
    } catch {
      showAlert("error", "Could not schedule follow-up.");
    }
  }

  function reset() { setStep("upload"); setExtractedLeads([]); setScheduleResult(null); setConfirmedLeads([]); }

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}



      {step === "upload" && (
        <>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "16px 0" }}>
            Upload files or paste text — AI extracts leads and schedules emails automatically.
          </p>
          <InputZone onAnalyze={handleAnalyze} loading={analyzing} />
          <div className="how-it-works" style={{ marginTop: 16 }}>
            <div className="hiw-step"><span className="hiw-num">1</span><span>Upload CSV, Excel, screenshot, or paste text</span></div>
            <div className="hiw-arrow">→</div>
            <div className="hiw-step"><span className="hiw-num">2</span><span>AI extracts valid leads, skips bad emails</span></div>
            <div className="hiw-arrow">→</div>
            <div className="hiw-step"><span className="hiw-num">3</span><span>Confirm — emails auto-schedule with gaps</span></div>
          </div>
          <div style={{ marginTop: 20 }}>
            <FollowUpPanel />
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <LeadsPreview
            leads={extractedLeads}
            testMode={testMode}
            onConfirm={handleConfirm}
            onReset={reset}
            confirming={confirming}
          />
          <div style={{ marginTop: 20 }}>
            <FollowUpPanel />
          </div>
        </>
      )}

      {step === "success" && (
        <ScheduledSuccess
          result={scheduleResult}
          leads={confirmedLeads}
          testMode={testMode}
          onReset={reset}
          onTestFollowup={handleTestFollowup}
        />
      )}
    </div>
  );
}