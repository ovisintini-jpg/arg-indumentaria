"use client";

import { useState } from "react";
import Link from "next/link";
import { Product } from "@/types";
import { useCart, stockDeVariante } from "@/context/CartContext";
import { Icon } from "@/components/Icons";
import ProductThumb from "@/components/ProductThumb";

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

/* ───────────────────────────────────────────────────────────────────────────
   LA TARJETA DE PRODUCTO

   Es la pieza que más se repite en toda la tienda, así que las decisiones de
   acá se ven multiplicadas por doscientos. Las que se tomaron, y por qué:

   · SIN CAJA. No lleva borde ni fondo de tarjeta. En una grilla de ropa las
     cajas compiten con la foto y ensucian: Nordstrom, Zara, Adidas y Hollister
     apoyan la foto directamente sobre el papel. El único borde es el de la
     foto, y es del gris más claro.

   · FOTO VERTICAL 3:4. Una prenda colgada o puesta es vertical. En 4:3 (la
     proporción que usaba la versión de autopartes) la persona entra cortada.

   · TALLES AL PASAR EL MOUSE. La fila de talles aparece sobre la foto en el
     hover y agrega al carrito de un click. Es el "quick add" de DSW y
     Nordstrom Rack, y es el que evita el ida y vuelta a la ficha para algo
     que el cliente ya decidió. En el celular no hay hover: ahí la tarjeta
     lleva a la ficha, que es donde se elige con calma.

   · EL PRECIO MANDA. Precio actual en negrita; el anterior tachado al lado y
     el porcentaje en rojo. Es la convención de todo el rubro y el cliente la
     lee sin pensar.
   ─────────────────────────────────────────────────────────────────────────── */

export function ProductCard({ product }: { product: Product }) {
  const { addItem, openPanel } = useCart();
  const [agregado, setAgregado] = useState<string | null>(null);

  const stock = product.stock ?? 0;
  const sinStock = stock === 0;
  const pocas = stock > 0 && stock <= 5;

  const antes = product.price_before;
  const descuento =
    antes && antes > product.price
      ? Math.round(((antes - product.price) / antes) * 100)
      : 0;

  const talles = product.sizes ?? [];
  const colores = product.colors ?? [];
  // Con un color solo, elegirlo no es una decisión: se agrega directo.
  const colorUnico = colores.length === 1 ? colores[0].name : undefined;
  const puedeAgregarRapido = colores.length <= 1 && talles.length > 0;

  const agregarTalle = (e: React.MouseEvent, talle: string) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, { size: talle, color: colorUnico });
    setAgregado(talle);
    openPanel();
    setTimeout(() => setAgregado(null), 1400);
  };

  const contenido = (
    <>
      <div className="relative">
        <ProductThumb
          product={product}
          className="border border-line"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Chapitas — nunca más de dos, y la de oferta siempre primera */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {descuento > 0 && <span className="ag-chip ag-chip-sale">-{descuento}%</span>}
          {product.isNew && descuento === 0 && <span className="ag-chip ag-chip-ink">Nuevo</span>}
          {product.isExclusive && descuento === 0 && !product.isNew && (
            <span className="ag-chip ag-chip-linea">Selección</span>
          )}
        </div>

        {sinStock && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70">
            <span className="ag-chip ag-chip-ink">Agotado</span>
          </div>
        )}

        {/* Quick add: sólo de 768 px para arriba, sólo con el mouse encima */}
        {!sinStock && puedeAgregarRapido && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-2 border-t border-line bg-ink/95 px-2 py-2 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 md:block">
            <p className="mb-1.5 text-center font-cond text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dim">
              {agregado ? `Talle ${agregado} agregado` : "Agregar al carrito"}
            </p>
            <div className="flex flex-wrap justify-center gap-1">
              {talles.slice(0, 8).map((t) => {
                const hay = stockDeVariante(product, t, colorUnico) > 0;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!hay}
                    onClick={(e) => agregarTalle(e, t)}
                    aria-label={hay ? `Agregar talle ${t}` : `Talle ${t} sin stock`}
                    className={`ag-talle !h-8 !min-w-[36px] !text-[0.78rem] ${
                      agregado === t ? "!border-ok !bg-ok !text-white" : ""
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Datos */}
      <div className="flex flex-1 flex-col pt-3">
        {product.brand && (
          <span className="truncate font-cond text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-mute">
            {product.brand}
          </span>
        )}

        <h3 className="mt-0.5 line-clamp-2 text-[0.94rem] font-medium leading-snug text-chalk">
          {product.title}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`ag-num text-[1.05rem] font-semibold ${descuento ? "text-sale" : ""}`}>
            {money(product.price)}
          </span>
          {descuento > 0 && (
            <span className="ag-precio-antes text-[0.85rem]">{money(antes!)}</span>
          )}
        </div>

        {/* Muestras de color. Sirven para dos cosas a la vez: decir que la
            prenda viene en varios colores y decir cuáles, sin abrir la ficha. */}
        {colores.length > 1 && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {colores.slice(0, 5).map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="h-3.5 w-3.5 rounded-full border border-black/15"
                style={{ background: c.hex }}
              />
            ))}
            {colores.length > 5 && (
              <span className="ag-num text-[0.74rem] text-dim">+{colores.length - 5}</span>
            )}
          </div>
        )}

        {pocas && !sinStock && (
          <p className="mt-2 font-cond text-[0.74rem] uppercase tracking-[0.14em] text-warn">
            Últimas {stock} unidades
          </p>
        )}
      </div>
    </>
  );

  const clases = "group flex flex-col";

  // Sin slug (el parche de slugs sin correr) no hay a dónde ir: la tarjeta
  // queda sin link en vez de llevar a una página rota.
  if (!product.slug) {
    return <article className={clases}>{contenido}</article>;
  }

  return (
    <Link href={`/producto/${product.slug}`} className={clases}>
      {contenido}
    </Link>
  );
}

export default ProductCard;

/* El botón de favoritos vive acá para que la tarjeta y la ficha usen el mismo.
   Todavía no persiste en la base: guarda en el navegador. Cuando exista la
   tabla `favoritos` en Supabase, se cambia sólo este archivo. */
export function BotonFavorito({ productId, className = "" }: { productId: string; className?: string }) {
  const [guardado, setGuardado] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setGuardado((v) => !v);
        try {
          const raw = localStorage.getItem("argindumentaria-favoritos");
          const lista: string[] = raw ? JSON.parse(raw) : [];
          const nueva = lista.includes(productId)
            ? lista.filter((id) => id !== productId)
            : [...lista, productId];
          localStorage.setItem("argindumentaria-favoritos", JSON.stringify(nueva));
        } catch {
          /* modo incógnito o almacenamiento lleno: el corazón igual se pinta */
        }
      }}
      aria-label={guardado ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={guardado}
      className={`grid h-9 w-9 place-items-center transition-colors ${
        guardado ? "text-sale" : "text-dim hover:text-chalk"
      } ${className}`}
    >
      <Icon name="heart" size={19} />
    </button>
  );
}
