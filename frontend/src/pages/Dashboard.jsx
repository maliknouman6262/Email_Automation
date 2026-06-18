import { useState, useEffect } from "react";
import api from "../api";

const TABS = ["profile", "email_style", "preview"];

// ── Profile Tab ───────────────────────────────────────────────
function ProfileTab({ profile, setProfile, onSave, saving }) {
  return (
    <div className="profile-form">
      <p className="tab-desc">
        Apna poora context yahan paste karo — AI is ko parh kar har lead ke liye personalized email likhega.
        Jitna detail do utna behtar proposal banega.
      </p>

      <div className="context-example">
        <div className="ce-title">📋 Example format (ya apna khud likho):</div>
        <pre className="ce-text">{`Main Nouman hun, ek Full Stack Developer hun Pakistan se.
4 saal ka experience hai React, Django, Python, REST APIs mein.
Main e-commerce platforms, SaaS dashboards, automation tools bana chuka hun.
Fiverr pe Top Rated hun, 50+ international clients ke saath kaam kiya hai.
Portfolio: myportfolio.com | LinkedIn: linkedin.com/in/nouman
Rate: $25/hr ya project basis pe baat ho sakti hai.
Main fast delivery aur clean code pe focus karta hun.`}</pre>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Apna Context / Introduction</label>
        <textarea
          className="context-textarea"
          placeholder={`Yahan apna poora context paste karo:\n\nMera naam ___ hai, main ___ developer hun...\nMujhe ___ mein experience hai...\nMain ___ type ke projects kar chuka hun...\nMeri rate ___ hai...\nMera portfolio/LinkedIn: ___`}
          value={profile.context || ""}
          onChange={(e) => setProfile({ ...profile, context: e.target.value })}
          rows={14}
        />
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "💾 Save Profile"}
        </button>
      </div>
    </div>
  );
}

// ── Email Style Tab ───────────────────────────────────────────
function EmailStyleTab({ style, setStyle, onSave, saving }) {
  const f = (key) => ({
    value: style[key] || "",
    onChange: (e) => setStyle({ ...style, [key]: e.target.value }),
  });

  return (
    <div className="profile-form">
      <p className="tab-desc">
        AI ko batao ke email kaise likhni hai — tone, language, kya highlight karna hai.
      </p>

      <div className="form-grid">
        <div className="form-row">
          <div className="field">
            <label>Email Tone</label>
            <select {...f("tone")}>
              <option value="professional">Professional & Formal</option>
              <option value="friendly">Friendly & Conversational</option>
              <option value="concise">Short & Punchy</option>
              <option value="detailed">Detailed & Thorough</option>
            </select>
          </div>
          <div className="field">
            <label>Language</label>
            <select {...f("language")}>
              <option value="english">English</option>
              <option value="urdu">Urdu</option>
              <option value="mixed">Mixed (English + Urdu)</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Kya emphasize karna hai har email mein</label>
          <textarea {...f("emphasis")}
            placeholder="e.g. Hamesha portfolio mention karo. Lead ki requirement ko directly address karo."
            style={{ minHeight: 70 }} />
        </div>

        <div className="field">
          <label>Kya BILKUL nahi likhna</label>
          <textarea {...f("avoid")}
            placeholder="e.g. 'I hope this email finds you well' mat likho. Price upfront mat batao."
            style={{ minHeight: 70 }} />
        </div>

        <div className="field">
          <label>Call to Action (CTA)</label>
          <input {...f("cta")} placeholder="e.g. Let's schedule a 15-min call this week" />
        </div>

        <div className="field">
          <label>Extra instructions</label>
          <textarea {...f("extra")}
            placeholder="e.g. Hamesha lead ki company ka naam use karo. Similar projects ka reference do."
            style={{ minHeight: 70 }} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "💾 Save Style"}
        </button>
      </div>
    </div>
  );
}

// ── Preview Tab ───────────────────────────────────────────────
function PreviewTab({ profile, style }) {
  const [testLead, setTestLead] = useState({
    name: "Ahmed Khan",
    company: "TechSolutions Ltd",
    requirement: "Need a Python developer to build a data scraping tool",
  });
  const [preview, setPreview] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (!profile.context) {
      alert("Pehle Profile tab mein apna context save karo!");
      return;
    }
    setGenerating(true);
    try {
      const r = await api.post("campaign/preview-email/", {
        lead: testLead,
        sender_profile: profile,
        email_style: style,
      });
      setPreview(r.data.email || "");
    } catch {
      setPreview("⚠️ Could not generate preview. Make sure backend is running.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="profile-form">
      <p className="tab-desc">
        Test karo ke AI tumhara context use karke kaisi email likhta hai.
      </p>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <div className="field">
            <label>Lead Name</label>
            <input value={testLead.name}
              onChange={(e) => setTestLead({ ...testLead, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Lead Company</label>
            <input value={testLead.company}
              onChange={(e) => setTestLead({ ...testLead, company: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Lead Requirement</label>
          <input value={testLead.requirement}
            onChange={(e) => setTestLead({ ...testLead, requirement: e.target.value })} />
        </div>
      </div>

      <button className="btn btn-primary" onClick={generate} disabled={generating}>
        {generating ? <><span className="spinner" /> Generating…</> : "✨ Generate Sample Email"}
      </button>

      {preview && (
        <div className="email-preview-box" style={{ marginTop: 16 }}>
          <div className="email-preview-label">Generated Email Preview</div>
          <pre className="email-preview-text">{preview}</pre>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function Campaigns() {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({ context: "" });
  const [style, setStyle] = useState({ tone: "professional", language: "english" });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  function showAlert(type, msg) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3000);
  }

  useEffect(() => {
    api.get("profile/").then((r) => {
      const p = r.data.profile || {};
      setProfile(p.profile || p || { context: "" });
      setStyle(p.email_style || { tone: "professional", language: "english" });
    }).catch(() => {});
  }, []);

  async function saveAll() {
    setSaving(true);
    try {
      await api.post("profile/", { profile: { profile, email_style: style } });
      showAlert("success", "Profile & email style saved!");
    } catch {
      showAlert("error", "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const tabLabels = {
    profile: "👤 Your Context",
    email_style: "✍️ Email Style",
    preview: "👁 Preview Email",
  };

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
        Apna context paste karo — AI is ko parh ke har lead ke liye custom proposal likhega.
      </p>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button key={t}
            className={`tab-btn ${activeTab === t ? "active" : ""}`}
            onClick={() => setActiveTab(t)}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {activeTab === "profile" && (
          <ProfileTab profile={profile} setProfile={setProfile} onSave={saveAll} saving={saving} />
        )}
        {activeTab === "email_style" && (
          <EmailStyleTab style={style} setStyle={setStyle} onSave={saveAll} saving={saving} />
        )}
        {activeTab === "preview" && (
          <PreviewTab profile={profile} style={style} />
        )}
      </div>
    </div>
  );
}