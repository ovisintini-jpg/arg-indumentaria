"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, stockDeVariante } from "@/context/CartContext";
import { Icon } from "@/components/Icons";
import ProductThumb from "@/components/ProductThumb";

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

/* Lo que falta para el envío gratis. Es el dato que más mueve el ticket
   promedio en una tienda de ropa, y por eso va arriba de todo y no escondido
   en el pie: el cliente tiene que verlo mientras decide. */
const ENVIO_GRATIS_DESDE = 120000;

export default function CartPanel() {
  const router = useRouter();
  const {
    items, isOpen, totalItems, totalPrice,
    closePanel, removeItem, increment, decrement, clearCart,
  } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closePanel]);

  // El fondo no se scrollea mientras el panel está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previo; };
  }, [isOpen]);

  const irAlCheckout = () => {
    closePanel();
    router.push("/checkout");
  };

  const falta = Math.max(0, ENVIO_GRATIS_DESDE - totalPrice);
  const progreso = Math.min(100, (totalPrice / ENVIO_GRATIS_DESDE) * 100);

  const qtyBtn =
    "grid h-8 w-8 place-items-center border border-line text-mute transition-colors hover:border-chalk hover:text-chalk disabled:opacity-40 disabled:hover:border-line";

  return (
    <>
      <div
        onClick={closePanel}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-chalk/35 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-label="Carrito de compras"
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-[440px] max-w-full flex-col border-l border-line bg-ink shadow-[0_0_60px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "invisible translate-x-full"
        }`}
      >
        {/* Encabezado */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-6">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-display text-[1.15rem] font-extrabold uppercase tracking-[-0.02em]">
              Mi bolsa
            </h2>
            <span className="ag-num text-[0.88rem] text-mute">
              ({totalItems})
            </span>
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Cerrar carrito"
            className="grid h-9 w-9 shrink-0 place-items-center text-mute transition-colors hover:text-chalk"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Barra de envío gratis */}
        {items.length > 0 && (
          <div className="shrink-0 border-b border-line bg-panel px-5 py-3 md:px-6">
            <p className="text-[0.83rem] text-mute">
              {falta > 0 ? (
                <>
                  Te faltan <b className="ag-num font-semibold text-chalk">{money(falta)}</b> para
                  el envío gratis
                </>
              ) : (
                <b className="font-semibold text-ok">¡Tenés el envío gratis!</b>
              )}
            </p>
            <div className="mt-2 h-[3px] w-full bg-line">
              <div
                className="h-full bg-chalk transition-[width] duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        )}

        {/* Artículos */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 md:px-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className="text-linehi"><Icon name="cart" size={48} /></span>
              <p className="font-display text-[1.05rem] font-bold">Tu bolsa está vacía</p>
              <p className="max-w-[30ch] text-[0.9rem] text-mute">
                Elegí una categoría, buscá tu talle y sumá lo que te guste.
              </p>
              <button type="button" onClick={closePanel} className="ag-btn ag-btn-ghost ag-btn-sm mt-2">
                Ver el catálogo
              </button>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {items.map(({ product, quantity, size, color, lineId }) => {
                const tope = stockDeVariante(product, size, color);
                return (
                  <li key={lineId} className="flex gap-4 py-4 first:pt-0">
                    <Link
                      href={product.slug ? `/producto/${product.slug}` : "#"}
                      onClick={closePanel}
                      className="group w-[86px] shrink-0"
                    >
                      <ProductThumb product={product} className="border border-line" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {product.brand && (
                            <p className="font-cond text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-mute">
                              {product.brand}
                            </p>
                          )}
                          <p className="mt-0.5 line-clamp-2 text-[0.92rem] font-medium leading-snug">
                            {product.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(lineId)}
                          aria-label={`Quitar ${product.title}`}
                          className="shrink-0 text-dim transition-colors hover:text-sale"
                        >
                          <Icon name="close" size={15} />
                        </button>
                      </div>

                      {/* Talle y color: en una tienda de ropa esto NO es un
                          detalle secundario, es lo que el cliente revisa antes
                          de pagar. Va en la misma línea y en mayúscula chica. */}
                      {(size || color) && (
                        <p className="mt-1.5 font-cond text-[0.78rem] uppercase tracking-[0.12em] text-mute">
                          {[size && `Talle ${size}`, color].filter(Boolean).join(" · ")}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => decrement(lineId)}
                            aria-label="Quitar una unidad"
                            className={qtyBtn}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                          <span className="ag-num w-6 text-center text-[0.92rem] font-semibold">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => increment(lineId)}
                            disabled={quantity >= tope}
                            aria-label="Agregar una unidad"
                            className={qtyBtn}
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        </div>

                        <span className="ag-num text-[1rem] font-semibold">
                          {money(product.price * quantity)}
                        </span>
                      </div>

                      {quantity >= tope && tope > 0 && (
                        <p className="mt-1.5 text-[0.76rem] text-warn">
                          Última{tope === 1 ? "" : "s"} {tope} en este talle
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Cierre */}
        {items.length > 0 && (
          <div className="shrink-0 border-t border-line px-5 py-5 md:px-6">
            <div className="flex items-baseline justify-between">
              <span className="ag-label">Subtotal</span>
              <span className="ag-num font-display text-[1.5rem] font-extrabold tracking-[-0.035em]">
                {money(totalPrice)}
              </span>
            </div>
            <p className="mt-1.5 text-[0.82rem] text-dim">
              El envío se calcula en el paso siguiente. Cambios sin cargo dentro de los 30 días.
            </p>

            <button type="button" onClick={irAlCheckout} className="ag-btn ag-btn-solid mt-4 w-full">
              Iniciar compra <Icon name="arrow" size={18} />
            </button>

            <button
              type="button"
              onClick={clearCart}
              className="mt-2 w-full py-2.5 font-cond text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-dim transition-colors hover:text-sale"
            >
              Vaciar bolsa
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
