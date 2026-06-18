import { useState, useEffect } from "react";
import api from "../api";

const TABS = ["profile", "email_style", "preview"];

// ── Profile Form ─────────────────────────────────────────────
function ProfileTab({ profile, setProfile, onSave, saving }) {
  const f = (key) => ({
    value: profile[key] || "",
    onChange: (e) => setProfile({ ...profile, [key]: e.target.value }),
  });

  return (
    <div className="profile-form">
      <p className="tab-desc">
        This information is used by AI when writing personalized emails to each lead.
        The more detail you provide, the better the proposals.
      </p>

      <div className="form-grid">
        <div className="form-row">
          <div className="field">
            <label>Your Full Name</label>
            <input {...f("name")} placeholder="e.g. Ali Hassan" />
          </div>
          <div className="field">
            <label>Your Role / Title</label>
            <input {...f("role")} placeholder="e.g. Full Stack Developer" />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Years of Experience</label>
            <input {...f("experience")} placeholder="e.g. 4 years" />
          </div>
          <div className="field">
            <label>Your Location</label>
            <input {...f("location")} placeholder="e.g. Lahore, Pakistan" />
          </div>
        </div>

        <div className="field">
          <label>Skills & Technologies</label>
          <input {...f("skills")} placeholder="e.g. React, Django, Python, REST APIs, PostgreSQL" />
        </div>

        <div className="field">
          <label>Portfolio / Website URL</label>
          <input {...f("portfolio")} placeholder="https://yourportfolio.com" />
        </div>

        <div className="field">
          <label>LinkedIn Profile URL</label>
          <input {...f("linkedin")} placeholder="https://linkedin.com/in/yourname" />
        </div>

        <div className="field">
          <label>GitHub / Other Work Links</label>
          <input {...f("github")} placeholder="https://github.com/yourusername" />
        </div>

        <div className="field">
          <label>Notable Projects / Past Work</label>
          <textarea {...f("projects")} placeholder="e.g. Built an e-commerce platform for 10k+ users, SaaS dashboard for a US startup, etc." style={{ minHeight: 90 }} />
        </div>

        <div className="field">
          <label>Hourly Rate / Project Rate</label>
          <input {...f("rate")} placeholder="e.g. $25/hr or from $500/project" />
        </div>

        <div className="field">
          <label>Short Bio (1-2 sentences)</label>
          <textarea {...f("bio")} placeholder="e.g. I'm a Pakistani developer with 4 years experience building web apps for clients worldwide. I specialize in React + Django solutions." style={{ minHeight: 70 }} />
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
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
        Tell the AI how to write emails. These instructions guide the tone, length, and focus of every proposal.
      </p>

      <div className="form-grid">
        <div className="field">
          <label>Email Tone</label>
          <select {...f("tone")}>
            <option value="">Choose tone…</option>
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

        <div className="field">
          <label>What to emphasize in each email</label>
          <textarea {...f("emphasis")} placeholder="e.g. Always mention that I understand their specific requirement. Highlight my portfolio. Ask for a call." style={{ minHeight: 80 }} />
        </div>

        <div className="field">
          <label>What to NEVER include</label>
          <textarea {...f("avoid")} placeholder="e.g. Don't mention price upfront. Don't use generic intros like 'I hope this finds you well'." style={{ minHeight: 80 }} />
        </div>

        <div className="field">
          <label>Custom CTA (Call to Action)</label>
          <input {...f("cta")} placeholder="e.g. 'Let's schedule a 15-min call this week'" />
        </div>

        <div className="field">
          <label>Any extra instructions for AI</label>
          <textarea {...f("extra")} placeholder="e.g. Reference their company name. Mention that I've worked with similar businesses before." style={{ minHeight: 80 }} />
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : "💾 Save Style"}
        </button>
      </div>
    </div>
  );
}

// ── Preview / Test Tab ────────────────────────────────────────
function PreviewTab({ profile, style }) {
  const [testLead, setTestLead] = useState({
    name: "Ahmed Khan",
    company: "TechSolutions Ltd",
    requirement: "Need a Python developer to build a data scraping tool",
  });
  const [preview, setPreview] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generate() {
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
        Test how AI writes an email using your profile and style settings.
      </p>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <div className="field">
            <label>Test Lead Name</label>
            <input
              value={testLead.name}
              onChange={(e) => setTestLead({ ...testLead, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Test Lead Company</label>
            <input
              value={testLead.company}
              onChange={(e) => setTestLead({ ...testLead, company: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Test Lead Requirement</label>
          <input
            value={testLead.requirement}
            onChange={(e) => setTestLead({ ...testLead, requirement: e.target.value })}
          />
        </div>
      </div>

      <button className="btn btn-primary" onClick={generate} disabled={generating}>
        {generating ? <><span className="spinner" /> Generating…</> : "✨ Generate Sample Email"}
      </button>

      {preview && (
        <div className="email-preview-box">
          <div className="email-preview-label">Generated Email Preview</div>
          <pre className="email-preview-text">{preview}</pre>
        </div>
      )}
    </div>
  );
}

// ── Main Campaigns page ───────────────────────────────────────
export default function Campaigns() {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({});
  const [style, setStyle] = useState({ tone: "professional", language: "english" });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  function showAlert(type, msg) {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  }

  useEffect(() => {
    api.get("profile/")
      .then((r) => {
        const p = r.data.profile || {};
        setProfile(p.profile || p || {});
        setStyle(p.email_style || { tone: "professional", language: "english" });
      })
      .catch(() => {});
  }, []);

  async function saveAll() {
    setSaving(true);
    try {
      await api.post("profile/", {
        profile: { profile, email_style: style },
      });
      showAlert("success", "Profile & email style saved!");
    } catch {
      showAlert("error", "Failed to save. Check backend.");
    } finally {
      setSaving(false);
    }
  }

  const tabLabels = {
    profile: "👤 Your Profile",
    email_style: "✍️ Email Style",
    preview: "👁 Preview Email",
  };

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
        Fill in your complete profile so AI can write personalized proposals for each lead using your actual experience and context.
      </p>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab-btn ${activeTab === t ? "active" : ""}`}
            onClick={() => setActiveTab(t)}
          >
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