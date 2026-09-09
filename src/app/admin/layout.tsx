"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import Brand from "@/components/Brand";

interface AdminAuthCtx { logout: () => void; }
const AdminAuthContext = createContext<AdminAuthCtx>({ logout: () => {} });
export const useAdminAuth = () => useContext(AdminAuthContext);

/* ── Iconos de sección — trazo, no emoji ───────────────────────── */

function Ico({ d, circle }: { d?: string; circle?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      {circle && <circle cx="12" cy="12" r="8.5" />}
      {d && <path d={d} />}
    </svg>
  );
}

const NAV = [
  { href: "/admin/productos",     label: "Productos",  icon: <Ico d="M12 2.6 21 7v10l-9 4.4L3 17V7l9-4.4Z M3 7l9 4.4L21 7 M12 11.4V21.4" /> },
  { href: "/admin/categorias",    label: "Categorías",     icon: <Ico d="M3.5 4.5h7v7h-7z M13.5 4.5h7v7h-7z M3.5 12.5h7v7h-7z M13.5 12.5h7v7h-7z" /> },
  { href: "/admin/pedidos",       label: "Pedidos",    icon: <Ico d="M4 7h16l-1.3 12.2a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3L4 7Z M8.5 7V5.4a3.5 3.5 0 0 1 7 0V7" /> },
  { href: "/admin/consultas",     label: "Consultas",  icon: <Ico d="M20.5 15.2a2 2 0 0 1-2 2H7.9L3.5 21V5.8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9.4Z M8 9.2h8 M8 12.8h5" /> },
  { href: "/admin/a-pedido",      label: "A pedido",   icon: <Ico d="M4.5 8.5h15l-1 11h-13l-1-11Z M9 8.5V6a3 3 0 0 1 6 0v2.5 M12 12v4 M10 14h4" /> },
  { href: "/admin/resenas",       label: "Reseñas",    icon: <Ico d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z" /> },
  { href: "/admin/clientes",      label: "Clientes",   icon: <Ico d="M20 20.5v-1.8a4.2 4.2 0 0 0-4.2-4.2H8.2A4.2 4.2 0 0 0 4 18.7v1.8 M12 11.2a3.9 3.9 0 1 0 0-7.7 3.9 3.9 0 0 0 0 7.7Z" /> },
  { href: "/admin/finanzas",      label: "Finanzas",   icon: <Ico d="M4 20V9.5 M9.3 20V4.5 M14.7 20v-8 M20 20V7" /> },
  { href: "/admin/configuracion", label: "Config",     icon: <Ico circle d="M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z M12 1.8v2.2 M12 20v2.2 M1.8 12H4 M20 12h2.2" /> },
];

/* ── Aviso: Supabase sin configurar ────────────────────────────── */

function SinBase() {
  return (
    <div className="mx-auto max-w-[560px] border border-warn/40 bg-panel">
      <div className="h-[3px] w-full bg-warn" aria-hidden="true" />
      <div className="px-9 py-9">
        <p className="ag-eyebrow mb-3 text-warn">Falta conectar la base</p>
        <h2 className="font-display text-2xl font-extrabold uppercase leading-tight">
          El panel todavía no tiene a dónde consultar
        </h2>
        <p className="mt-4 font-light leading-relaxed text-mute">
          <code className="ag-mono text-chalk">.env.local</code> no tiene cargadas
          {" "}<code className="ag-mono text-chalk">NEXT_PUBLIC_SUPABASE_URL</code> ni
          {" "}<code className="ag-mono text-chalk">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
          así que el login no puede validar a nadie.
        </p>
        <p className="mt-4 font-light leading-relaxed text-mute">
          El paso a paso está en <code className="ag-mono text-chalk">COMO-EMPEZAR.md</code>,
          en la raíz del proyecto. Después de cargar las claves hay que reiniciar
          {" "}<code className="ag-mono text-chalk">npm run dev</code>.
        </p>
        <Link href="/" className="ag-btn ag-btn-ghost ag-btn-sm mt-8">Volver a la tienda</Link>
      </div>
    </div>
  );
}

/* ── Pantalla de login ─────────────────────────────────────────── */

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: pass });

    if (authError || !data.session) {
      setError("Credenciales incorrectas.");
      setLoading(false); return;
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users").select("id, role").eq("id", data.session.user.id).single();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      setError("Tu cuenta existe, pero no está cargada en admin_users.");
      setLoading(false); return;
    }

    onLogin(); setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-14">
      {!supabaseConfigurado ? <SinBase /> : (
        <div className="w-full max-w-[440px] border border-line bg-panel">
          <div className="ag-rail" aria-hidden="true" />

          <div className="px-9 py-10 md:px-11 md:py-12">
            <Brand size="lg" className="mb-9" />

            <p className="ag-eyebrow mb-2">Acceso restringido</p>
            <h1 className="font-display text-[1.9rem] font-extrabold uppercase leading-none">
              Panel de gestión
            </h1>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <div>
                <label className="ag-label mb-2 block">Email</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email" required autoFocus className="ag-input"
                />
              </div>
              <div>
                <label className="ag-label mb-2 block">Contraseña</label>
                <input
                  type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password" required className="ag-input"
                />
              </div>

              {error && (
                <div className="border border-sale/40 bg-sale/10 px-4 py-3">
                  <p className="font-cond text-[0.85rem] font-semibold uppercase tracking-[0.14em] text-sale">
                    {error}
                  </p>
                </div>
              )}

              <button type="submit" disabled={loading} className="ag-btn ag-btn-acento w-full">
                {loading ? "Verificando…" : "Ingresar"}
              </button>
            </form>

            <div className="mt-8 border-t border-line pt-6">
              <p className="text-sm font-light leading-relaxed text-dim">
                El acceso pide dos cosas: usuario en Supabase Auth y una fila con ese
                mismo id en <code className="ag-mono text-mute">admin_users</code>.
                El script <code className="ag-mono text-mute">crear-admin.sql</code> hace la segunda.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Navegación ────────────────────────────────────────────────── */

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3.5 border-l-2 px-5 py-3 font-cond text-[0.88rem] font-semibold uppercase tracking-[0.18em] transition-colors ${
              active
                ? "border-l-acento bg-raise text-chalk"
                : "border-l-transparent text-dim hover:bg-raise/50 hover:text-mute"
            }`}
          >
            <span className={active ? "text-acentohi" : "text-dim group-hover:text-mute"}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-[#0b0d10] lg:flex">
      <div className="border-b border-line px-6 py-7">
        <Link href="/admin/productos"><Brand size="sm" /></Link>
        <p className="ag-label mt-3">Panel de gestión</p>
      </div>

      <nav className="flex-1 py-5">
        <NavLinks pathname={pathname} />
      </nav>

      <div className="border-t border-line py-4">
        <Link
          href="/"
          className="flex items-center gap-3.5 border-l-2 border-l-transparent px-5 py-3 font-cond text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-dim transition-colors hover:text-mute"
        >
          <span aria-hidden="true">↗</span> Ver la tienda
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3.5 border-l-2 border-l-transparent px-5 py-3 font-cond text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-dim transition-colors hover:border-l-sale hover:text-sale"
        >
          <span aria-hidden="true">✕</span> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

/* 04/09 — El menu del panel en el celular era una tira horizontal: medía 1113 px
   dentro de una pantalla de 390. Se veian dos secciones y media y las otras
   —Clientes, Finanzas, Config— quedaban fuera de pantalla, sin ninguna pista de
   que habia que arrastrar de costado. Pasa a ser el mismo cajon lateral que usa
   la tienda: boton ☰ y las ocho secciones una debajo de la otra, mas "Ver la
   tienda" y "Cerrar sesion" al pie. */
function TopbarMobile({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  // Escape cierra, y el fondo no scrollea mientras el cajon esta abierto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-line bg-[#0b0d10] lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú del panel"
            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
          >
            <span className="h-[1.5px] w-4 bg-current" />
            <span className="h-[1.5px] w-4 bg-current" />
            <span className="h-[1.5px] w-4 bg-current" />
          </button>

          <Link href="/admin/productos" className="min-w-0">
            <Brand size="sm" />
          </Link>
        </div>
      </div>

      {/* Fondo */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Cajon */}
      <aside
        aria-label="Secciones del panel"
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[86vw] max-w-[320px] flex-col border-r border-line bg-[#0b0d10] transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="ag-rail shrink-0" aria-hidden="true" />

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-5">
          <div className="min-w-0">
            <Link href="/admin/productos" onClick={() => setOpen(false)}>
              <Brand size="sm" />
            </Link>
            <p className="ag-label mt-2.5">Panel de gestión</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú del panel"
            className="grid h-9 w-9 shrink-0 place-items-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
          >
            ✕
          </button>
        </div>

        <nav className="custom-scrollbar flex-1 overflow-y-auto py-4">
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>

        <div className="shrink-0 border-t border-line py-3">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3.5 border-l-2 border-l-transparent px-5 py-3 font-cond text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-dim transition-colors hover:text-mute"
          >
            <span aria-hidden="true">↗</span> Ver la tienda
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3.5 border-l-2 border-l-transparent px-5 py-3 font-cond text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-dim transition-colors hover:border-l-sale hover:text-sale"
          >
            <span aria-hidden="true">✕</span> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

/* ── Layout ────────────────────────────────────────────────────── */

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking]           = useState(true);

  useEffect(() => {
    if (!supabaseConfigurado) { setChecking(false); return; }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: adminUser } = await supabase
          .from("admin_users").select("id").eq("id", session.user.id).single();
        if (adminUser) setAuthenticated(true);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 animate-pulse bg-acento" />
          <p className="ag-label">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return <LoginScreen onLogin={() => setAuthenticated(true)} />;

  return (
    <AdminAuthContext.Provider value={{ logout: () => setAuthenticated(false) }}>
      <div className="min-h-screen bg-ink text-chalk">
        <div className="ag-rail" aria-hidden="true" />
        <div className="flex min-h-screen">
          <Sidebar onLogout={() => setAuthenticated(false)} />
          <div className="min-w-0 flex-1">
            <TopbarMobile onLogout={() => setAuthenticated(false)} />
            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </AdminAuthContext.Provider>
  );
}
