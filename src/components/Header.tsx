"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/context/UserContext";
import { useCategory } from "@/context/CategoryContext";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import AuthModal from "@/components/AuthModal";
import AccountModal from "@/components/AccountModal";
import Sidebar from "@/components/Sidebar";
import Brand from "@/components/Brand";
import { Icon } from "@/components/Icons";

/* ───────────────────────────────────────────────────────────────────────────
   EL HEADER

   Tres filas, como en cualquier tienda de indumentaria:

   1. ANUNCIO — una sola frase, fondo negro. Es donde vive la promoción
      vigente. Rota entre tres mensajes cada seis segundos para no ocupar tres
      renglones.
   2. UTILITARIA (escritorio) — cuenta, pedidos, ayuda. Lo que se usa poco pero
      tiene que estar.
   3. NAVEGACIÓN — logotipo, departamentos con menú desplegable, buscador,
      cuenta, favoritos y bolsa.

   El menú desplegable de cada departamento muestra las subcategorías reales
   del catálogo, no una lista escrita a mano: si el admin agrega "Camperas de
   cuero" en Mujer, aparece sola.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── LOS DEPARTAMENTOS DEL MENÚ ──────────────────────────────────────────
   Las once categorías del catálogo NO entran en la barra: a 1440 px la fila
   se desbordaba y empujaba el buscador y la bolsa fuera de la pantalla.
   Se agrupan en siete departamentos, que es lo que hacen todas las tiendas
   del rubro (Nordstrom, Macy's, JCPenney): "Chicos" junta niñas, niños y
   bebés; "Calzado" junta los tres calzados.

   Cada departamento abre un menú con UNA COLUMNA POR CATEGORÍA del grupo, y
   las subcategorías salen del catálogo real: si mañana se agrega "Camperas de
   cuero" en Mujer, aparece sola. `href` es a dónde va el que hace click en el
   nombre del departamento. */
const DEPARTAMENTOS: { label: string; ids: string[]; href: string }[] = [
  { label: "Mujer",      ids: ["mujer", "interior"],                                  href: "/categoria/mujer" },
  { label: "Hombre",     ids: ["hombre", "interior"],                                 href: "/categoria/hombre" },
  { label: "Chicos",     ids: ["ninas", "ninos", "bebes"],                            href: "/categoria/ninas" },
  { label: "Calzado",    ids: ["calzado-mujer", "calzado-hombre", "calzado-infantil"], href: "/categoria/calzado-mujer" },
  { label: "Deportivo",  ids: ["deportivo"],                                          href: "/categoria/deportivo" },
  { label: "Accesorios", ids: ["accesorios"],                                         href: "/categoria/accesorios" },
];

const ANUNCIOS = [
  "Envío gratis en compras desde $120.000 — a todo el país",
  "Cambios sin cargo dentro de los 30 días",
];

export default function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const cierreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { totalItems, togglePanel } = useCart();
  const { user, isAdmin, loading, signOut } = useUser();
  const { setSearchQuery: doSearch, setCategory, searchQuery: busquedaActiva } = useCategory();
  const { categories } = useCatalogCategories();

  /* El cuadro de búsqueda tiene su propio texto mientras escribís, pero cuando
     la búsqueda se cancela desde otro lado —el "Inicio" del catálogo, una
     categoría del menú— acá quedaba escrito lo que ya no filtra nada. */
  useEffect(() => {
    if (!busquedaActiva) setSearchQuery("");
  }, [busquedaActiva]);

  useEffect(() => {
    const t = setInterval(() => setAnuncio((i) => (i + 1) % ANUNCIOS.length), 6000);
    return () => clearInterval(t);
  }, []);

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"datos" | "compras">("datos");

  const openLogin = () => { setAuthTab("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthTab("register"); setAuthOpen(true); };
  const openDatos = () => { setAccountTab("datos"); setAccountOpen(true); };
  const openCompras = () => { setAccountTab("compras"); setAccountOpen(true); };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    doSearch(q);
    // La búsqueda vive en la home: si estás en una ficha, hay que volver.
    router.push("/");
  };

  const handleClear = () => {
    setSearchQuery("");
    doSearch("");
  };

  const goHome = () => {
    setSearchQuery("");
    doSearch("");
    setCategory(null, null, "HOME");
  };

  /* El menú se abre al pasar el mouse y se cierra con un respiro de 140 ms: sin
     esa demora, mover el puntero desde el nombre del departamento hasta el menú
     lo cierra en el camino (el clásico "menú que se escapa"). */
  const abrir = (id: string) => {
    if (cierreTimer.current) clearTimeout(cierreTimer.current);
    setAbierto(id);
  };
  const cerrarConDemora = () => {
    if (cierreTimer.current) clearTimeout(cierreTimer.current);
    cierreTimer.current = setTimeout(() => setAbierto(null), 140);
  };

  const displayName = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(" ")[0]
    : user?.email?.split("@")[0];

  const utilLink =
    "font-cond text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-mute transition-colors hover:text-chalk";

  const iconBtn =
    "grid h-10 w-10 shrink-0 place-items-center text-chalk transition-colors hover:text-acento";

  return (
    <>
      {/* ── Anuncio ── */}
      <div className="bg-chalk text-white">
        <div className="mx-auto flex min-h-9 w-full max-w-[1320px] items-center justify-center px-4 py-1.5">
          <p
            key={anuncio}
            className="ag-rise ag-d1 text-balance text-center font-cond text-[0.74rem] font-medium uppercase leading-tight tracking-[0.14em] md:text-[0.8rem] md:tracking-[0.16em]"
          >
            {ANUNCIOS[anuncio]}
          </p>
        </div>
      </div>

      {/* ── Barra utilitaria ── */}
      <div className="hidden border-b border-line bg-panel md:block">
        <div className="mx-auto flex h-[36px] w-full max-w-[1320px] items-center justify-end gap-6 px-6 lg:px-14">
          <div className="flex items-center gap-5">
            <Link href="/#guia-de-talles" className={utilLink}>Guía de talles</Link>
            <Link href="/arrepentimiento" className={utilLink}>Cambios y devoluciones</Link>
            {loading ? (
              <span className={utilLink + " animate-pulse"}>…</span>
            ) : user ? (
              <>
                <button type="button" onClick={openDatos} className={utilLink + " !text-acento"}>
                  {displayName}
                </button>
                {isAdmin && <Link href="/admin" className={utilLink}>Panel admin</Link>}
                <button type="button" onClick={openCompras} className={utilLink}>Mis pedidos</button>
                <button type="button" onClick={signOut} className={utilLink}>Salir</button>
              </>
            ) : (
              <>
                <button type="button" onClick={openLogin} className={utilLink}>Ingresá</button>
                <button type="button" onClick={openRegister} className={utilLink + " !text-acento"}>
                  Creá tu cuenta
                </button>
                <button type="button" onClick={openCompras} className={utilLink}>Mis pedidos</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Navegación principal ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[62px] w-full max-w-[1320px] items-center gap-3 px-4 md:h-[76px] md:gap-6 md:px-6 lg:px-14">

          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú y mi cuenta"
            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] text-chalk transition-colors hover:text-acento lg:hidden"
          >
            <span className="h-[1.5px] w-[18px] bg-current" />
            <span className="h-[1.5px] w-[18px] bg-current" />
            <span className="h-[1.5px] w-[18px] bg-current" />
          </button>

          <Link href="/" onClick={goHome} aria-label="ARG Indumentaria, inicio" className="shrink-0">
            <Brand />
          </Link>

          {/* Departamentos con menú desplegable */}
          <nav className="hidden lg:block" onMouseLeave={cerrarConDemora}>
            <ul className="flex gap-5 xl:gap-7">
              {DEPARTAMENTOS.map((dep) => (
                <li key={dep.label} onMouseEnter={() => abrir(dep.label)}>
                  <Link
                    href={dep.href}
                    className={`block whitespace-nowrap border-b-2 py-1.5 font-cond text-[0.88rem] font-semibold uppercase tracking-[0.13em] transition-colors ${
                      abierto === dep.label
                        ? "border-chalk text-chalk"
                        : "border-transparent text-mute hover:text-chalk"
                    }`}
                  >
                    {dep.label}
                  </Link>
                </li>
              ))}
              <li onMouseEnter={cerrarConDemora}>
                <Link
                  href="/categoria/outlet"
                  className="block whitespace-nowrap border-b-2 border-transparent py-1.5 font-cond text-[0.86rem] font-semibold uppercase tracking-[0.13em] text-sale transition-colors hover:border-sale"
                >
                  Outlet
                </Link>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {/* El buscador vive en su propia fila, que se abre con la lupa.
                En la fila principal no entra: con siete departamentos, el
                logotipo y los tres íconos, a 1440 px quedaba de 80 px de ancho
                —inusable— y a 1280 empujaba la bolsa fuera de la pantalla.
                Abrirlo a todo el ancho es además lo que hacen Adidas,
                Hollister y Nike. */}
            <button
              type="button"
              onClick={() => setBuscando((v) => !v)}
              aria-label="Buscar en el catálogo"
              aria-expanded={buscando}
              className={`hidden md:grid ${iconBtn}`}
            >
              <Icon name={buscando ? "close" : "search"} size={21} />
            </button>

            <button
              type="button"
              onClick={user ? openDatos : openLogin}
              aria-label={user ? `Mi cuenta, ${displayName}` : "Ingresar a mi cuenta"}
              className={`hidden md:grid ${iconBtn} ${user ? "!text-acento" : ""}`}
            >
              <Icon name="user" size={21} />
            </button>

            <button
              type="button"
              onClick={togglePanel}
              aria-label={`Ver bolsa, ${totalItems} productos`}
              className={`relative ${iconBtn}`}
            >
              <Icon name="cart" size={21} />
              {totalItems > 0 && (
                <span className="ag-num absolute right-0.5 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-chalk px-1 text-[0.64rem] font-bold text-white">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Fila del buscador — escritorio */}
        {buscando && (
          <div className="hidden border-t border-line bg-panel md:block">
            <form
              onSubmit={(e) => { handleSearch(e); setBuscando(false); }}
              className="mx-auto w-full max-w-[1320px] px-6 py-3 lg:px-14"
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-dim">
                  <Icon name="search" size={19} />
                </span>
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar prenda, marca o color"
                  aria-label="Buscar en el catálogo"
                  className="ag-input !bg-ink !py-3 !pl-12 !pr-11 text-[1rem]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Limpiar búsqueda"
                    className="absolute inset-y-0 right-4 flex items-center text-dim transition-colors hover:text-chalk"
                  >
                    <Icon name="close" size={17} />
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Menú desplegable del departamento con el mouse encima */}
        {abierto && (
          <div
            onMouseEnter={() => abrir(abierto)}
            onMouseLeave={cerrarConDemora}
            className="absolute inset-x-0 top-full hidden border-b border-line bg-ink shadow-[0_18px_40px_-24px_rgba(0,0,0,.35)] lg:block"
          >
            <div className="mx-auto w-full max-w-[1320px] px-6 py-8 lg:px-14">
              <div className="flex flex-wrap gap-x-14 gap-y-8">
                {DEPARTAMENTOS.filter((d) => d.label === abierto).flatMap((dep) =>
                  dep.ids
                    .map((id) => categories.find((c) => c.id === id))
                    .filter(Boolean)
                    .map((cat) => (
                      <div key={cat!.id} className="min-w-[190px]">
                        <Link
                          href={`/categoria/${cat!.id}`}
                          onClick={() => setAbierto(null)}
                          className="ag-eyebrow !text-chalk hover:underline"
                        >
                          {cat!.name}
                        </Link>
                        <ul className="mt-3.5 flex flex-col gap-2">
                          {cat!.subCategories.map((sub) => (
                            <li key={sub}>
                              <Link
                                href={`/categoria/${cat!.id}?sub=${encodeURIComponent(sub)}`}
                                onClick={() => setAbierto(null)}
                                className="text-[0.92rem] text-mute transition-colors hover:text-chalk hover:underline"
                              >
                                {sub}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Buscador — celular. El acceso a la cuenta va acá: arriba no entra. */}
        <div className="flex items-center gap-2 border-t border-line px-4 py-2 md:hidden">
          <form onSubmit={handleSearch} className="min-w-0 flex-1">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-dim">
                <Icon name="search" size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar prenda, marca o color"
                aria-label="Buscar en el catálogo"
                style={{ fontSize: "16px" }}
                className="ag-input !bg-panel !py-2 !pl-11 !pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Limpiar búsqueda"
                  className="absolute inset-y-0 right-3 flex items-center text-dim"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          </form>

          <button
            type="button"
            onClick={user ? openDatos : openLogin}
            aria-label={user ? `Mi cuenta, ${displayName}` : "Ingresar a mi cuenta"}
            className={`grid h-[42px] w-[42px] shrink-0 place-items-center border transition-colors ${
              user ? "border-acento text-acento" : "border-line text-mute"
            }`}
          >
            <Icon name="user" size={20} />
          </button>
        </div>
      </header>

      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onLogin={openLogin}
        onRegister={openRegister}
        onDatos={openDatos}
        onCompras={openCompras}
      />
      <AuthModal isOpen={authOpen} initialTab={authTab} onClose={() => setAuthOpen(false)} />
      <AccountModal isOpen={accountOpen} initialTab={accountTab} onClose={() => setAccountOpen(false)} />
    </>
  );
}
