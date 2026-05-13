import { Link, useLocation, useNavigate, useOutlet } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Menu,
  X,
  LogOut,
  Shield,
  LayoutDashboard,
  ExternalLink,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useData } from "../context/DataContext";

const SIDEBAR_WIDTH_KEY = "persi_workspace_sidebar_width";
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 208;
const MAX_SIDEBAR_WIDTH = 340;

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const { isAdmin, adminLogout, currentHospital, hospitalLogout } = useData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const isAdminRoute = location.pathname.startsWith("/admin") || location.pathname.startsWith("/siap-persi/admin");
  const isAdminLoginRoute = location.pathname === "/admin/login";
  const isHospitalPortalRoute =
    location.pathname === "/submit" ||
    location.pathname === "/submit-performance" ||
    location.pathname === "/hospital/hasil-penilaian" ||
    (location.pathname.startsWith("/siap-persi") && !location.pathname.startsWith("/siap-persi/admin"));

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "Berita", to: "/news" },
    { label: "Rankings", to: "/rankings" },
    { label: "Events", to: "/events" },
    { label: "Metodologi", to: "/methodology" },
  ];

  useEffect(() => {
    if (!isSidebarResizing) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      const nextWidth = clampSidebarWidth(event.clientX);
      setSidebarWidth(nextWidth);
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(nextWidth));
    };

    const handlePointerUp = () => {
      setIsSidebarResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isSidebarResizing]);

  const workspaceSidebarStyle: CSSProperties = { width: `${sidebarWidth}px` };
  const workspaceContentStyle = { "--sidebar-width": `${sidebarWidth}px` } as CSSProperties;
  const sidebarResizeHandle = (
    <button
      type="button"
      aria-label="Atur lebar sidebar"
      title="Tarik untuk mengatur lebar sidebar"
      onPointerDown={(event) => {
        event.preventDefault();
        setIsSidebarResizing(true);
      }}
      className={`absolute inset-y-0 right-0 w-2 cursor-col-resize transition-colors ${
        isSidebarResizing ? "bg-teal-300/50" : "bg-transparent hover:bg-teal-300/30"
      }`}
    />
  );

  const adminShellLogout = () => {
    adminLogout();
    navigate("/admin/login");
  };

  const hospitalShellLogout = () => {
    hospitalLogout();
    navigate("/");
  };

  const hospitalAuth = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("hospitalAuth") || "{}");
    } catch {
      return {};
    }
  })();
  const hospitalName = currentHospital?.hospitalName || hospitalAuth.hospitalName || "Rumah Sakit";
  const hospitalCode =
    hospitalAuth.hospitalCode ||
    currentHospital?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 12) ||
    hospitalAuth.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 12) ||
    "Portal RS";

  if (isAdminRoute) {
    if (isAdminLoginRoute) {
      return (
        <div className="min-h-screen bg-slate-950">
          {outlet}
        </div>
      );
    }

    // ADD THIS:
    if (!isAdmin) {
      navigate("/admin/login");
      return null;
    }

    const adminLinks = [
      { label: "Control Center", to: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Review NHR", to: "/siap-persi/admin/dashboard", icon: Shield },
      { label: "Public Site", to: "/", icon: ExternalLink },
    ];

    return (
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <aside
          className="fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-slate-950 text-white lg:flex lg:flex-col"
          style={workspaceSidebarStyle}
        >
          <div className="px-6 py-6 border-b border-white/10">
            <Link to="/siap-persi/admin/dashboard" className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-teal-300" />
              </div>
              <div>
                <div className="font-black leading-tight">NHR PERSI</div>
                <div className="text-xs text-slate-400">Admin Workspace</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-4 py-5 space-y-1">
            {adminLinks.map(link => {
              const Icon = link.icon;
              const active = link.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                    active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={adminShellLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-200 hover:bg-red-500/10 hover:text-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout Admin
            </button>
          </div>
          {sidebarResizeHandle}
        </aside>

        <div className="min-h-screen flex flex-col lg:pl-[var(--sidebar-width)]" style={workspaceContentStyle}>
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="h-16 px-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-teal-600">Admin Workspace</p>
                <p className="font-black text-slate-900">PERSI Internal Review</p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Lihat Public Site
                </Link>
                <button
                  onClick={adminShellLogout}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950 text-white text-sm font-bold hover:bg-slate-800"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="flex-1"
            >
              {outlet}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (isHospitalPortalRoute) {
    const hospitalLinks = [
      { label: "Home Portal", to: "/submit", icon: LayoutDashboard },
      { label: "Pengisian Data", to: "/siap-persi/select-specialty", icon: ClipboardCheck },
      { label: "Hasil & Review", to: "/hospital/hasil-penilaian", icon: FileText },
      { label: "Website Publik", to: "/", icon: ExternalLink },
    ];

    const isHospitalLinkActive = (to: string) => {
      if (to === "/siap-persi/select-specialty") {
        return location.pathname.startsWith("/siap-persi") && !location.pathname.startsWith("/siap-persi/admin");
      }
      if (to === "/") return location.pathname === "/";
      return location.pathname.startsWith(to);
    };

    return (
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <aside
          className="fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-slate-950 text-white lg:flex lg:flex-col"
          style={workspaceSidebarStyle}
        >
          <div className="px-6 py-6 border-b border-white/10">
            <Link to="/submit" className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-teal-300" />
              </div>
              <div>
                <div className="font-black leading-tight">NHR PERSI</div>
                <div className="text-xs text-slate-400">Portal Rumah Sakit</div>
              </div>
            </Link>
          </div>

          <div className="px-6 py-5 border-b border-white/10">
            <div className="text-xs font-black uppercase tracking-widest text-teal-300 mb-2">Akun RS</div>
            <div className="font-bold leading-tight truncate">{hospitalName}</div>
            <div className="text-xs text-slate-400 mt-1">Kode: {hospitalCode}</div>
          </div>

          <nav className="flex-1 px-4 py-5 space-y-1">
            {hospitalLinks.map(link => {
              const Icon = link.icon;
              const active = isHospitalLinkActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                    active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={hospitalShellLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-200 hover:bg-red-500/10 hover:text-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout RS
            </button>
          </div>
          {sidebarResizeHandle}
        </aside>

        <div className="min-h-screen flex flex-col lg:pl-[var(--sidebar-width)]" style={workspaceContentStyle}>
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="h-16 px-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-teal-600">Portal Rumah Sakit</p>
                <p className="font-black text-slate-900 truncate max-w-[54vw]">{hospitalName}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Lihat Website Publik
                </Link>
                <button
                  onClick={hospitalShellLogout}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950 text-white text-sm font-bold hover:bg-slate-800"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="flex-1"
            >
              {outlet}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1E3A8A] rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-[700] text-[#1E3A8A] leading-tight">
                  NHR PERSI
                </div>
                <div className="text-[10px] text-gray-500 leading-tight">
                  National Hospital Ranking
                </div>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-2 relative">
              {navLinks.map((link) => {
                const active = isActive(link.to) && (link.to === "/" ? location.pathname === "/" : true);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative px-4 py-2 rounded-lg text-sm font-[500] transition-colors z-10 ${
                      active ? "text-[#1E3A8A]" : "text-gray-600 hover:text-[#1E3A8A]"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="active-nav-pill"
                        className="absolute inset-0 bg-blue-50/80 rounded-lg -z-10"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <Link
                to="/hospital-login"
                className="hidden lg:inline-flex text-sm font-[600] px-5 py-2.5 bg-[#0D9488] text-white rounded-lg hover:bg-[#0b7f75] transition-colors"
              >
                Portal Rumah Sakit
              </Link>

              {/* Mobile Menu Toggle */}
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="lg:hidden overflow-hidden"
              >
                <div className="pt-4 pb-2 border-t border-gray-100 mt-3">
                  <div className="space-y-1">
                    {navLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-4 py-2.5 rounded-lg text-sm font-[500] ${
                          isActive(link.to)
                            ? "text-[#1E3A8A] bg-blue-50"
                            : "text-gray-600 hover:bg-gray-50 bg-transparent transition-colors"
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link
                      to="/hospital-login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-2.5 rounded-lg text-sm font-[600] text-[#0D9488]"
                    >
                      Portal Rumah Sakit
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.main
          // We use pathname as key so framer-motion triggers on route change
          key={location.pathname}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="flex-grow flex flex-col"
        >
          {outlet}
        </motion.main>
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-0">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#1E3A8A] rounded flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <span className="font-[700] text-white">NHR PERSI</span>
              </div>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                Perhimpunan Rumah Sakit Seluruh Indonesia. Platform penilaian
                kualitas rumah sakit berbasis data untuk Indonesia yang lebih
                sehat.
              </p>
            </div>
            <div>
              <h4 className="font-[600] text-sm mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/news"
                    className="hover:text-white transition-colors"
                  >
                    Berita
                  </Link>
                </li>
                <li>
                  <Link
                    to="/rankings"
                    className="hover:text-white transition-colors"
                  >
                    Rankings
                  </Link>
                </li>
                <li>
                  <Link
                    to="/events"
                    className="hover:text-white transition-colors"
                  >
                    Events
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-[600] text-sm mb-4">Assessment</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link
                    to="/methodology"
                    className="hover:text-white transition-colors"
                  >
                    Metodologi
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/login"
                    className="hover:text-white transition-colors"
                  >
                    Login Admin
                  </Link>
                </li>
                <li>
                  <Link
                    to="/hospital-login"
                    className="hover:text-white transition-colors"
                  >
                    Portal Rumah Sakit
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-[600] text-sm mb-4">Kontak</h4>
              <ul className="space-y-4 text-sm text-gray-400">
                <li>
                  <div className="flex flex-col gap-1">
                    <span className="text-white font-[500]">Email:</span>
                    <a href="mailto:persi@pacific.net.id" className="hover:text-white transition-colors">persi@pacific.net.id</a>
                    <a href="mailto:sekretariat@persi.or.id" className="hover:text-white transition-colors">sekretariat@persi.or.id</a>
                  </div>
                </li>
                <li>
                  <div className="flex flex-col gap-1 text-gray-400">
                    <div className="flex items-center gap-1">
                      <span className="text-white font-[500]">Telp:</span>
                      <a href="tel:+622183788722" className="hover:text-white transition-colors">(+62-21) 8378 8722</a>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-white font-[500]">Fax:</span>
                      <span>(+62-21) 8378 8724</span>
                    </div>
                  </div>
                </li>
                <li>
                  <div className="flex flex-col gap-1 leading-relaxed">
                    <span className="text-white font-[500]">Alamat:</span>
                    <span>Crown Palace Blok E/6</span>
                    <span>Jl. Prof Soepomo, SH No. 231, Tebet Jakarta Selatan 12870</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} PERSI - Perhimpunan Rumah Sakit
            Seluruh Indonesia. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
