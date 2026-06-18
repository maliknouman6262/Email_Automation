import { useState, useEffect } from "react";
import api from "../api";

export default function Campaigns() {
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("profile/").then((r) => {
      const p = r.data.profile || {};
      const inner = p.profile || p;
      setContext(inner.context || "");
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.post("profile/", {
        profile: { profile: { context }, email_style: {} }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="context-page">
      <p className="context-desc">
  Here you can provide detailed context about yourself that will help the AI craft personalized outreach emails. The more specific you are, the better the AI can tailor the emails to reflect your experience, skills, and unique value proposition. Consider including information about your background, expertise, past projects, client types, and what you offer. This will enable the AI to generate emails that truly represent you and resonate with your target audience.
      </p>

      <textarea
        className="context-textarea"
        placeholder={`Provide detailed information about yourself to help the AI craft personalized outreach emails. The more specific you are, the better the AI can tailor the emails to reflect your experience, skills, and unique value proposition.\n\nConsider including information about your background, expertise, past projects, client types, and what you offer. This will enable the AI to generate emails that truly represent you and resonate with your target audience.`}
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />

      <button className="btn btn-primary context-save-btn" onClick={save} disabled={saving}>
        {saving ? <><span className="spinner" /> Saving…</> : saved ? "✅ Saved!" : "💾 Save"}
      </button>
    </div>
  );
}