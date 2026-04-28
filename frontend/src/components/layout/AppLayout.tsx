import { House, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useI18n } from "../../i18n/I18nContext";

function formatAdminGovernanceRole(role: string | null): string | null {
  if (!role) return null;
  if (role === "SUPER_ADMIN") return "SUPER ADMIN";
  if (role === "RESPONSABILE_ALBO") return "RESPONSABILE ALBO";
  if (role === "REVISORE") return "REVISORE";
  if (role === "VIEWER") return "VIEWER";
  return role;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { auth, logout } = useAuth();
  const { adminRole } = useAdminGovernanceRole();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [topbarRipple, setTopbarRipple] = useState<{ id: number; x: number; y: number } | null>(null);
  const appVersion = import.meta.env.VITE_APP_VERSION ?? "v1.0.0";
  const currentYear = new Date().getFullYear();
  const roleLabel = auth?.role === "ADMIN"
    ? (formatAdminGovernanceRole(adminRole) ?? t("nav.admin"))
    : auth?.role === "SUPPLIER"
      ? t("nav.supplier")
      : auth?.role ?? "";
  const roleClass = auth?.role === "ADMIN" ? "is-admin" : auth?.role === "SUPPLIER" ? "is-supplier" : "";
  const initials = auth?.fullName
    ? auth.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : "";
  const navItems = [
    { to: "/", end: true, label: t("nav.home"), icon: House },
    { to: "/supplier/dashboard", end: false, label: t("nav.supplier"), icon: UserRound },
    { to: "/admin/dashboard", end: false, label: t("nav.admin"), icon: ShieldCheck }
  ] as const;

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleTopbarMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setTopbarRipple((prev) => ({ id: (prev?.id ?? 0) + 1, x, y }));
  };

  const openSupportModal = () => {
    window.dispatchEvent(new Event("open-support-modal"));
  };

  const handleFooterSupportClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (location.pathname === "/") {
      openSupportModal();
      return;
    }
    navigate("/?support=1");
  };

  if (location.pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${isHeaderScrolled ? "is-scrolled" : ""}`} onMouseEnter={handleTopbarMouseEnter}>
        {topbarRipple ? (
          <span
            key={topbarRipple.id}
            className="topbar-ripple"
            style={{ left: `${topbarRipple.x}px`, top: `${topbarRipple.y}px` }}
            aria-hidden="true"
          />
        ) : null}
        <div className="topbar-brand">
          <h1>{t("app.title")}</h1>
        </div>
        <div className="topbar-right">
          <div className="lang-switch" data-lang={language}>
            <button
              type="button"
              className={language === "it" ? "lang-btn active" : "lang-btn"}
              onClick={() => setLanguage("it")}
            >
              IT
            </button>
            <button
              type="button"
              className={language === "en" ? "lang-btn active" : "lang-btn"}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
          {auth ? (
            <>
              <span className={`user-chip ${roleClass}`}>
                <span className="user-avatar" aria-hidden="true">{initials}</span>
                <span className="user-name">{auth.fullName}</span>
                <span className={`role-pill ${roleClass}`}>{roleLabel}</span>
              </span>
              <button type="button" className="logout-btn" onClick={logout}>
                <LogOut className="logout-icon h-4 w-4" />
                <span>{t("auth.logout")}</span>
              </button>
            </>
          ) : null}
        </div>
      </header>
      <nav className={`tabs ${isHeaderScrolled ? "is-scrolled" : ""}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => isActive ? "tab-link active" : "tab-link"}
          >
            <item.icon className="tab-link-icon h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="content">{children}</main>
      <footer className="app-footer">
        <div className="app-footer-left">{t("footer.copyright", { year: currentYear })}</div>
        <div className="app-footer-right">
          <span>{t("footer.version")}: {appVersion}</span>
          <Link to="/privacy">{t("footer.privacy")}</Link>
          <a href="#" onClick={(e) => e.preventDefault()}>{t("footer.cookies")}</a>
          <a href="#" onClick={handleFooterSupportClick}>{t("footer.support")}</a>
          <span className="app-footer-powered">
            <span>{t("footer.poweredBy")}</span>
            <img src="/logo_solco.png" alt="SOLCO" />
          </span>
        </div>
      </footer>
    </div>
  );
}

