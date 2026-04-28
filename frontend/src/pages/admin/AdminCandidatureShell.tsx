import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Building2, ChevronDown, ClipboardList, Eye, LayoutDashboard, LogOut, MailPlus, Settings, ShieldCheck, Star, Users } from "lucide-react";
import { getAdminEvaluationAssignments } from "../../api/adminEvaluationApi";
import { useAuth } from "../../auth/AuthContext";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";

type AdminNavKey = "dashboard" | "alboA" | "alboB" | "candidature" | "inviti" | "valutazioni" | "report" | "impostazioni";

interface AdminCandidatureShellProps {
  active: AdminNavKey;
  children: ReactNode;
  evaluationAssignmentsVisible?: boolean;
}

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  RESPONSABILE_ALBO: "Responsabile Albo",
  REVISORE: "Revisore",
  VIEWER: "Viewer",
};
const SIDEBAR_WIDTH_STORAGE_KEY = "admin.sidebar.width";
const SIDEBAR_EXPANDED_SESSION_KEY = "admin.sidebar.expanded";
const SIDEBAR_WIDTH_MIN = 84;
const SIDEBAR_WIDTH_MAX = 320;
const SIDEBAR_WIDTH_DEFAULT = 220;
const SIDEBAR_COMPACT_THRESHOLD = 132;
const SIDEBAR_COLLAPSE_DELAY_MS = 520;
const EVALUATION_SEEN_ASSIGNMENTS_KEY = "admin.evaluations.seen.assignmentIds";

function clampSidebarWidth(value: number): number {
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, value));
}

function roleTone(role: string | null | undefined): string {
  if (role === "SUPER_ADMIN") return "tone-super-admin";
  if (role === "RESPONSABILE_ALBO") return "tone-responsabile";
  if (role === "REVISORE") return "tone-revisore";
  if (role === "VIEWER") return "tone-viewer";
  return "tone-viewer";
}

function roleGlyph(role: string | null | undefined) {
  if (role === "SUPER_ADMIN") return <ShieldCheck size={14} />;
  if (role === "RESPONSABILE_ALBO") return <Building2 size={14} />;
  if (role === "REVISORE") return <Users size={14} />;
  return <Eye size={14} />;
}

function navClass(active: boolean): string {
  return active ? "active" : "";
}

function initials(name: string | null | undefined): string {
  const safe = (name ?? "").trim();
  if (!safe) return "AD";
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readSeenEvaluationAssignments(): Set<string> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(EVALUATION_SEEN_ASSIGNMENTS_KEY) || "[]") as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSeenEvaluationAssignments(ids: string[]): void {
  sessionStorage.setItem(EVALUATION_SEEN_ASSIGNMENTS_KEY, JSON.stringify(ids));
}

export function AdminCandidatureShell({ active, children, evaluationAssignmentsVisible = false }: AdminCandidatureShellProps) {
  const { auth, logout } = useAuth();
  const { adminRole, resolved } = useAdminGovernanceRole();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!stored) return SIDEBAR_WIDTH_DEFAULT;
    const parsed = Number(stored);
    if (!Number.isFinite(parsed)) return SIDEBAR_WIDTH_DEFAULT;
    return clampSidebarWidth(parsed);
  });
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return sessionStorage.getItem(SIDEBAR_EXPANDED_SESSION_KEY) === "true";
  });
  const [myEvaluationCount, setMyEvaluationCount] = useState(0);
  const userRef = useRef<HTMLDivElement>(null);
  const sidebarCollapseTimerRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const resolvedRole = adminRole ? (roleLabel[adminRole] ?? adminRole) : "Admin";
  const resolvedRoleTone = roleTone(adminRole);
  const sidebarCompact = !sidebarExpanded || sidebarWidth <= SIDEBAR_COMPACT_THRESHOLD;
  const renderedSidebarWidth = sidebarExpanded ? sidebarWidth : SIDEBAR_WIDTH_MIN;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    sessionStorage.setItem(SIDEBAR_EXPANDED_SESSION_KEY, sidebarExpanded ? "true" : "false");
  }, [sidebarExpanded]);

  async function loadMyEvaluationCount() {
    if (!auth?.token || !resolved || adminRole === "VIEWER") {
      setMyEvaluationCount(0);
      return;
    }
    try {
      const rows = await getAdminEvaluationAssignments(auth.token, "MINE");
      const activeIds = rows
        .filter((row) => row.status !== "COMPLETATA")
        .map((row) => row.assignmentId || row.supplierRegistryProfileId)
        .filter(Boolean);
      if (evaluationAssignmentsVisible) {
        saveSeenEvaluationAssignments(activeIds);
        setMyEvaluationCount(0);
        return;
      }
      const seen = readSeenEvaluationAssignments();
      setMyEvaluationCount(activeIds.filter((id) => !seen.has(id)).length);
    } catch {
      setMyEvaluationCount(0);
    }
  }

  useEffect(() => {
    void loadMyEvaluationCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token, adminRole, resolved, active, evaluationAssignmentsVisible]);

  useAdminRealtimeRefresh({
    token: auth?.token ?? "",
    enabled: resolved && adminRole !== "VIEWER",
    shouldRefresh: (event) => (event.eventKey ?? "").includes("evaluation"),
    onRefresh: loadMyEvaluationCount
  });

  useEffect(() => {
    if (!popoverOpen) return;
    function handleOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [popoverOpen]);

  useEffect(() => {
    return () => {
      if (sidebarCollapseTimerRef.current !== null) {
        window.clearTimeout(sidebarCollapseTimerRef.current);
        sidebarCollapseTimerRef.current = null;
      }
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, []);

  function expandSidebar() {
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
      sidebarCollapseTimerRef.current = null;
    }
    setSidebarExpanded(true);
  }

  function scheduleSidebarCollapse() {
    if (sidebarResizing) return;
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
    }
    sidebarCollapseTimerRef.current = window.setTimeout(() => {
      sidebarCollapseTimerRef.current = null;
      setSidebarExpanded(false);
    }, SIDEBAR_COLLAPSE_DELAY_MS);
  }

  function commitPendingResize() {
    const next = pendingWidthRef.current;
    pendingWidthRef.current = null;
    resizeRafRef.current = null;
    if (next === null) return;
    setSidebarWidth(clampSidebarWidth(next));
  }

  function onResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const pointerId = event.pointerId;
    expandSidebar();
    setSidebarResizing(true);
    event.currentTarget.setPointerCapture(pointerId);

    function onPointerMove(moveEvent: PointerEvent) {
      pendingWidthRef.current = moveEvent.clientX;
      if (resizeRafRef.current !== null) return;
      resizeRafRef.current = window.requestAnimationFrame(commitPendingResize);
    }

    function onPointerUp() {
      setSidebarResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  return (
    <section
      className={`superadmin-shell${sidebarResizing ? " is-resizing-sidebar" : ""}`}
      style={{ "--sidebar-width": `${renderedSidebarWidth}px` } as CSSProperties}
    >
      <aside
        className={`superadmin-sidebar${sidebarCompact ? " is-compact" : " is-expanded"}`}
        onMouseEnter={expandSidebar}
        onMouseLeave={scheduleSidebarCollapse}
        onFocusCapture={expandSidebar}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          scheduleSidebarCollapse();
        }}
      >
        <div className="superadmin-brand">
          <strong>Solco</strong>
          <span>Albo Fornitori</span>
        </div>
        <nav className="superadmin-nav">
          <Link to="/admin/dashboard" className={navClass(active === "dashboard")}><LayoutDashboard className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Dashboard</span></Link>
          <Link to="/admin/albo-a" className={navClass(active === "alboA")}><Users className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Fornitori (Albo A)</span></Link>
          <Link to="/admin/albo-b" className={navClass(active === "alboB")}><Building2 className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Aziende (Albo B)</span></Link>
          {resolved && adminRole !== "VIEWER" && (
            <Link to="/admin/candidature" className={navClass(active === "candidature")}><ClipboardList className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Candidature</span></Link>
          )}
          {resolved && (adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO") && (
            <Link to="/admin/invites" className={navClass(active === "inviti")}><MailPlus className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Inviti</span></Link>
          )}
          {resolved && adminRole !== "VIEWER" && (
            <Link to="/admin/evaluations" className={navClass(active === "valutazioni")}><Star className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Valutazioni</span>{myEvaluationCount > 0 ? <span className="superadmin-nav-count">{myEvaluationCount}</span> : null}</Link>
          )}
          {resolved && (adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO") && (
            <Link to="/admin/reports" className={navClass(active === "report")}><BarChart3 className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Report</span></Link>
          )}
          {resolved && adminRole === "SUPER_ADMIN" && (
            <Link to="/admin/users-roles" className={navClass(active === "impostazioni")}><Settings className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Impostazioni</span></Link>
          )}
        </nav>
        {auth && (
          <div
            ref={userRef}
            className={`superadmin-user${popoverOpen ? " is-open" : ""}`}
            onClick={() => setPopoverOpen(o => !o)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && setPopoverOpen(o => !o)}
          >
            <div className="superadmin-user-main">
              <div className="superadmin-user-avatar">
                {initials(auth.fullName || auth.email)}
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="superadmin-user-name">{auth.fullName}</span>
                <span className="superadmin-user-email">{auth.email}</span>
                <span className={`superadmin-role-badge ${resolvedRoleTone}`}>{resolvedRole}</span>
              </div>
              <span className={`superadmin-user-role-icon ${resolvedRoleTone}`} aria-label={resolvedRole} title={resolvedRole}>
                {roleGlyph(adminRole)}
              </span>
              <ChevronDown size={14} className={`superadmin-user-chevron${popoverOpen ? " is-open" : ""}`} />
            </div>
            {popoverOpen && (
              <div className="superadmin-user-inline-menu">
                <button
                  className="superadmin-user-popover-logout"
                  onClick={e => { e.stopPropagation(); logout(); }}
                >
                  <LogOut size={14} />
                  Esci
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="superadmin-sidebar-resizer"
          onPointerDown={onResizeStart}
          aria-label="Ridimensiona barra laterale"
          title="Trascina per ridimensionare"
        />
      </aside>
      <div className="superadmin-content">{children}</div>
    </section>
  );
}
