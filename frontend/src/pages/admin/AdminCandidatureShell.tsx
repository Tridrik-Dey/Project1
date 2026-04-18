import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type AdminNavKey = "dashboard" | "alboA" | "alboB" | "candidature" | "inviti" | "valutazioni" | "report" | "impostazioni";

interface AdminCandidatureShellProps {
  active: AdminNavKey;
  children: ReactNode;
}

function navClass(active: boolean): string {
  return active ? "active" : "";
}

export function AdminCandidatureShell({ active, children }: AdminCandidatureShellProps) {
  return (
    <section className="superadmin-shell">
      <aside className="superadmin-sidebar">
        <div className="superadmin-brand">
          <strong>Solco</strong>
          <span>Albo Fornitori</span>
        </div>
        <nav className="superadmin-nav">
          <Link to="/admin/dashboard" className={navClass(active === "dashboard")}>Dashboard</Link>
          <Link to="/admin/albo-a" className={navClass(active === "alboA")}>Fornitori (Albo A)</Link>
          <Link to="/admin/albo-b" className={navClass(active === "alboB")}>Aziende (Albo B)</Link>
          <Link to="/admin/candidature" className={navClass(active === "candidature")}>Candidature</Link>
          <Link to="/admin/invites" className={navClass(active === "inviti")}>Inviti</Link>
          <Link to="/admin/evaluations" className={navClass(active === "valutazioni")}>Valutazioni</Link>
          <Link to="/admin/reports" className={navClass(active === "report")}>Report</Link>
          <Link to="/admin/users-roles" className={navClass(active === "impostazioni")}>Impostazioni</Link>
        </nav>
      </aside>
      <div className="superadmin-content">{children}</div>
    </section>
  );
}
