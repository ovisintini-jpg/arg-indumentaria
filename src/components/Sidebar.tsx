"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCategory } from "@/context/CategoryContext";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import { useUser } from "@/context/UserContext";
import Brand from "@/components/Brand";
import { Icon } from "@/components/Icons";

export default function Sidebar({
  open,
  onClose,
  onLogin,
  onRegister,
  onDatos,
  onCompras,
}: {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onDatos: () => void;
  onCompras: () => void;
}) {
  const router = useRouter();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { categoryId, subcategory, setCategory } = useCategory();
  const { categories, especiales } = useCatalogCategories();
  const { user, isAdmin, loading, signOut } = useUser();

  const displayName = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(" ")[0]
    : user?.email?.split("@")[0];

  /* Cerrar el panel y recien despues abrir el modal: si no, el modal aparece
     debajo del cajon y con el scroll del body todavia bloqueado. */
  const cerrarYAbrir = (accion: () => void) => {
    onClose();
    accion();
  };

  const enlaceSuelto =
    "font-cond text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-dim transition-colors hover:text-chalk";

  // Cerrar con Escape y bloquear el scroll de fondo mientras está abierto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const handleHome = () => {
    setCategory(null, null, "HOME");
    setOpenSection(null);
    onClose();
    router.push("/");
  };

  const handleCategory = (id: string, name: string) => {
    setCategory(id, null, name);
    setOpenSection(openSection === id ? null : id);
  };

  /* El cajón NAVEGA, no filtra. Antes sólo cambiaba el contexto: desde una
     ficha o desde el checkout, tocar una categoría no hacía nada visible
     porque esas páginas no leen ese filtro. Ahora va a /categoria/<id>, que
     es una página de verdad y se puede compartir. */
  const irA = (url: string) => {
    onClose();
    setOpenSection(null);
    router.push(url);
  };

  const handleSubcategory = (catId: string, sub: string) => {
    setCategory(catId, sub, sub);
    irA(`/categoria/${catId}?sub=${encodeURIComponent(sub)}`);
  };

  const handleEspecial = (id: string, name: string) => {
    setCategory(id, null, name);
    irA(`/categoria/${id}`);
  };

  return (
    <>
      {/* Fondo */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-chalk/35 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        aria-label="Menú y mi cuenta"
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[86vw] max-w-[380px] flex-col border-r border-line bg-ink transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="ag-rail shrink-0" />

        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-5">
          <button type="button" onClick={handleHome}>
            <Brand size="sm" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el menú"
            className="grid h-9 w-9 place-items-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* ── Mi cuenta ──
            04/09 — En el celular la barra utilitaria (Ingresa / Crea tu cuenta /
            Mis pedidos) esta oculta por md:block, asi que este era el unico lugar
            que faltaba para poder entrar a la cuenta desde el telefono. */}
        <div className="shrink-0 border-b border-line px-6 py-5">
          <p className="ag-eyebrow mb-4">Mi cuenta</p>

          {loading ? (
            <p className={enlaceSuelto + " animate-pulse"}>Cargando…</p>
          ) : user ? (
            <div className="flex flex-col gap-2">
              <p className="mb-1 truncate font-display text-[1.02rem] font-bold uppercase leading-tight tracking-[-0.01em] text-chalk">
                Hola, <span className="text-acento">{displayName}</span>
              </p>
              <button
                type="button"
                onClick={() => cerrarYAbrir(onDatos)}
                className="ag-btn ag-btn-ghost ag-btn-sm w-full"
              >
                Mis datos
              </button>
              <button
                type="button"
                onClick={() => cerrarYAbrir(onCompras)}
                className="ag-btn ag-btn-ghost ag-btn-sm w-full"
              >
                Mis pedidos
              </button>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="ag-btn ag-btn-ghost ag-btn-sm w-full"
                >
                  Panel admin
                </Link>
              )}
              <button
                type="button"
                onClick={() => { onClose(); signOut(); }}
                className={enlaceSuelto + " mt-1 self-start"}
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => cerrarYAbrir(onLogin)}
                className="ag-btn ag-btn-solid ag-btn-sm w-full"
              >
                Ingresá
              </button>
              <button
                type="button"
                onClick={() => cerrarYAbrir(onRegister)}
                className="ag-btn ag-btn-ghost ag-btn-sm w-full"
              >
                Creá tu cuenta
              </button>
              <button
                type="button"
                onClick={() => cerrarYAbrir(onCompras)}
                className={enlaceSuelto + " mt-1 self-start"}
              >
                Mis pedidos
              </button>
            </div>
          )}
        </div>

        <nav className="custom-scrollbar flex-1 overflow-y-auto px-6 py-6">
          <p className="ag-eyebrow mb-4">Catálogo</p>

          <ul className="flex flex-col">
            {categories.map((item) => {
              const isOpen = openSection === item.id;
              const isActive = categoryId === item.id;
              return (
                <li key={item.id} className="border-b border-line">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => irA(`/categoria/${item.id}`)}
                      className={`flex-1 py-3.5 text-left font-display text-[0.95rem] font-bold uppercase leading-tight tracking-[-0.01em] transition-colors ${
                        isActive ? "text-acento" : "text-chalk hover:text-acento"
                      }`}
                    >
                      {item.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategory(item.id, item.name)}
                      aria-expanded={isOpen}
                      aria-label={`Ver subcategorías de ${item.name}`}
                      className={`grid h-9 w-9 shrink-0 place-items-center text-dim transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-chalk" : ""
                      }`}
                    >
                      <Icon name="chev" size={16} />
                    </button>
                  </div>

                  {isOpen && (
                    <ul className="flex flex-col gap-0.5 border-l border-linehi pb-4 pl-4">
                      {item.subCategories.map((sub) => {
                        const isSubActive = categoryId === item.id && subcategory === sub;
                        return (
                          <li key={sub}>
                            <button
                              type="button"
                              onClick={() => handleSubcategory(item.id, sub)}
                              className={`w-full py-2 text-left text-[0.9rem] font-light transition-colors ${
                                isSubActive ? "text-acento" : "text-mute hover:text-chalk"
                              }`}
                            >
                              {sub}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="ag-eyebrow mb-4 mt-9">Destacados</p>

          <ul className="flex flex-col gap-2">
            {especiales.map((esp) => (
              <li key={esp.id}>
                <button
                  type="button"
                  onClick={() => handleEspecial(esp.id, esp.name)}
                  className={`w-full border px-4 py-3 text-left font-cond text-[0.85rem] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    categoryId === esp.id
                      ? "border-chalk bg-chalk text-white"
                      : "border-line text-mute hover:border-linehi hover:text-chalk"
                  }`}
                >
                  {esp.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-line px-6 py-5">
          <button
            type="button"
            onClick={handleHome}
            className="ag-btn ag-btn-ghost ag-btn-sm w-full"
          >
            Volver al inicio
          </button>
        </div>
      </aside>
    </>
  );
}
