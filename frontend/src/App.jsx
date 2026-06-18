import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Campaigns from "./pages/Campaigns";
import Report from "./pages/Report";
import "./App.css";

const NAV_ITEMS = [
  // { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "leads", label: "Upload Leads", icon: "📂" },
  { id: "campaigns", label: "My Profile", icon: "✍️" },
  { id: "report", label: "Report", icon: "📈" },
];

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");

  useEffect(() => {
    function handleNav(e) { setActivePage(e.detail); }
    window.addEventListener("nav", handleNav);
    return () => window.removeEventListener("nav", handleNav);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">✉</span>
          <span className="brand-name">MailFlow</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "active" : ""}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-dot" />
          <span>Backend connected</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <h1 className="page-title">
            {NAV_ITEMS.find((n) => n.id === activePage)?.label}
          </h1>
        </header>

        <div className="page-body">
          {/* {activePage === "dashboard" && <Dashboard />} */}
          {activePage === "leads" && <Leads />}
          {activePage === "campaigns" && <Campaigns />}
          {activePage === "report" && <Report />}
        </div>
      </main>
    </div>
  );
}