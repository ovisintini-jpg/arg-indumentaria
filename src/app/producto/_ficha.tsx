// src/app/producto/_ficha.tsx
//
// La ficha de producto. Es un componente de cliente porque necesita el carrito,
// la galería y los selectores de talle y color, pero OJO: Next igual lo
// renderiza en el servidor, así que el texto, el precio y las fotos salen en el
// HTML. Eso es lo que importa para Google — nada acá se dibuja recién en un
// useEffect.
//
// LA REGLA DE LA FICHA DE INDUMENTARIA: no se puede agregar al carrito sin
// elegir talle. Si el botón agrega igual, el pedido llega sin talle y alguien
// tiene que llamar al cliente para preguntárselo. Por eso el botón, mientras
// falte elegir, dice qué falta en vez de estar apagado sin explicación.

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Product } from "@/types";
import { useCart, stockDeVariante } from "@/context/CartContext";
import { useQuote } from "@/context/QuoteContext";
import { Icon, productIcon } from "@/components/Icons";
import { BotonFavorito } from "@/components/ProductCard";

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

/** Las tres cuotas que se muestran abajo del precio. En Argentina el precio en
 *  cuotas es parte del precio: mostrarlo acá evita la pregunta por WhatsApp. */
function cuotas(precio: number) {
  return [3, 6].map((n) => ({ n, monto: Math.round(precio / n) }));
}

export default function Ficha({
  product,
  rubro,
}: {
  product: Product;
  rubro?: { id: string; name: string };
}) {
  const { addItem, openPanel } = useCart();
  const { abrirCotizador } = useQuote();

  const imagenes = [...(product.image ? [product.image] : []), ...(product.images ?? [])];
  const talles = product.sizes ?? [];
  const colores = product.colors ?? [];

  const [activa, setActiva] = useState(0);
  const [talle, setTalle] = useState<string | undefined>(talles.length === 1 ? talles[0] : undefined);
  const [color, setColor] = useState<string | undefined>(colores.length === 1 ? colores[0].name : undefined);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>("detalle");

  const hayDetalle = Boolean(product.stock_variantes && Object.keys(product.stock_variantes).length);

  /* Con el detalle de stock cargado, un talle puede estar agotado en un color y
     disponible en otro. Cuando el cliente elige un color, los talles se
     recalculan: es la diferencia entre "no hay" y "no hay en ese color". */
  const stockElegido = useMemo(() => {
    if (!talle && talles.length > 1) return null;
    return stockDeVariante(product, talle ?? talles[0], color ?? colores[0]?.name);
  }, [product, talle, color, talles, colores]);

  const stockTotal = product.stock ?? 0;
  const sinStock = stockTotal === 0;

  const antes = product.price_before;
  const descuento = antes && antes > product.price
    ? Math.round(((antes - product.price) / antes) * 100)
    : 0;

  const faltaTalle = talles.length > 1 && !talle;
  const faltaColor = colores.length > 1 && !color;

  const agregar = () => {
    if (sinStock) return;
    if (faltaTalle) { setAviso("Elegí un talle para continuar"); return; }
    if (faltaColor) { setAviso("Elegí un color para continuar"); return; }
    setAviso(null);
    const tope = stockDeVariante(product, talle, color);
    addItem(product, { size: talle, color, qty: Math.min(Math.max(1, cantidad), tope) });
    setAgregado(true);
    openPanel();
    setTimeout(() => setAgregado(false), 1600);
  };

  const topeCantidad = Math.max(1, stockElegido ?? stockTotal);

  const acordeon = [
    { id: "detalle", titulo: "Detalle del producto", cuerpo: (
      <div className="flex flex-col gap-2 text-[0.92rem] text-mute">
        {product.description && <p>{product.description}</p>}
        {product.composicion && <p><b className="font-semibold text-chalk">Composición:</b> {product.composicion}</p>}
        {product.material && !product.composicion && <p><b className="font-semibold text-chalk">Material:</b> {product.material}</p>}
        {product.cuidados && <p><b className="font-semibold text-chalk">Cuidados:</b> {product.cuidados}</p>}
        {product.sku && <p className="ag-mono text-dim">SKU {product.sku}</p>}
        {!product.description && !product.composicion && !product.material && !product.cuidados && (
          <p>Sin descripción cargada todavía. Consultanos y te contamos todo sobre esta prenda.</p>
        )}
      </div>
    )},
    { id: "envio", titulo: "Envíos y plazos", cuerpo: (
      <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[0.92rem] text-mute">
        <li>Envío gratis en compras desde $120.000.</li>
        <li>A todo el país por Correo Argentino y Andreani: 3 a 7 días hábiles.</li>
        <li>Retiro sin cargo en el local, con turno, en 24 horas.</li>
      </ul>
    )},
    { id: "cambios", titulo: "Cambios y devoluciones", cuerpo: (
      <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[0.92rem] text-mute">
        <li>30 días para cambiar el talle, con la etiqueta puesta y sin uso.</li>
        <li>El primer cambio no tiene costo de envío.</li>
        <li>Ropa interior y trajes de baño no tienen cambio, por higiene.</li>
      </ul>
    )},
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-6 md:py-12 lg:px-14">

      {/* Migas — ubican al cliente y le dan a Google el camino desde la home */}
      <nav aria-label="Dónde estás" className="mb-7 flex flex-wrap items-center gap-2 text-[0.85rem] text-dim">
        <Link href="/" className="transition-colors hover:text-chalk">Inicio</Link>
        {rubro && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/categoria/${rubro.id}`} className="transition-colors hover:text-chalk">
              {rubro.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-chalk">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">

        {/* ── Fotos ──
            Vertical y grande. En una tienda de ropa la foto ES el producto: se
            le da todo el ancho que se pueda y las miniaturas van al costado en
            escritorio para no robarle alto. */}
        <div className="flex gap-3">
          {imagenes.length > 1 && (
            <div className="hidden w-[74px] shrink-0 flex-col gap-2 md:flex">
              {imagenes.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setActiva(i)}
                  aria-label={`Ver foto ${i + 1} de ${product.title}`}
                  className={`aspect-[3/4] overflow-hidden border transition-colors ${
                    i === activa ? "border-chalk" : "border-line hover:border-linehi"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="relative aspect-[3/4] w-full overflow-hidden border border-line bg-raise">
              {imagenes.length > 0 ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imagenes[activa]}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-linehi">
                  <Icon name={productIcon(product)} size="38%" />
                </span>
              )}

              <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                {descuento > 0 && <span className="ag-chip ag-chip-sale">-{descuento}%</span>}
                {product.isNew && <span className="ag-chip ag-chip-ink">Nuevo</span>}
              </div>

              <div className="absolute right-2 top-2">
                <BotonFavorito productId={product.id} className="bg-ink/85" />
              </div>
            </div>

            {/* Miniaturas en el celular, abajo y en carrusel */}
            {imagenes.length > 1 && (
              <div className="ag-carrusel mt-3 gap-2 md:hidden">
                {imagenes.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setActiva(i)}
                    aria-label={`Ver foto ${i + 1}`}
                    className={`h-[86px] w-[64px] overflow-hidden border ${
                      i === activa ? "border-chalk" : "border-line"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Compra ── */}
        <div className="lg:sticky lg:top-[104px] lg:self-start">
          {product.brand && <p className="ag-eyebrow mb-2.5">{product.brand}</p>}

          <h1 className="font-display text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold leading-[1.05]">
            {product.title}
          </h1>

          {/* Precio */}
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className={`ag-num font-display text-[2rem] font-extrabold tracking-[-0.035em] ${descuento ? "text-sale" : ""}`}>
              {money(product.price)}
            </span>
            {descuento > 0 && (
              <>
                <span className="ag-precio-antes text-[1.05rem]">{money(antes!)}</span>
                <span className="ag-chip ag-chip-sale">-{descuento}%</span>
              </>
            )}
          </div>
          <p className="ag-num mt-1.5 text-[0.88rem] text-mute">
            {cuotas(product.price).map((c) => `${c.n} cuotas de ${money(c.monto)}`).join(" · ")} sin interés
          </p>

          {/* Color */}
          {colores.length > 0 && (
            <div className="mt-7">
              <p className="ag-label mb-3">
                Color{color ? <span className="ml-2 normal-case tracking-normal text-chalk">{color}</span> : ""}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {colores.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={color === c.name}
                    onClick={() => { setColor(c.name); setAviso(null); }}
                    className="ag-color !h-9 !w-9"
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Talle */}
          {talles.length > 0 && (
            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="ag-label">
                  Talle{talle ? <span className="ml-2 normal-case tracking-normal text-chalk">{talle}</span> : ""}
                </p>
                <Link
                  href="/#guia-de-talles"
                  className="inline-flex items-center gap-1.5 text-[0.84rem] text-mute underline underline-offset-4 transition-colors hover:text-chalk"
                >
                  <Icon name="regla" size={15} /> Guía de talles
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {talles.map((t) => {
                  const hay = hayDetalle
                    ? stockDeVariante(product, t, color ?? colores[0]?.name) > 0
                    : true;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!hay}
                      aria-pressed={talle === t}
                      onClick={() => { setTalle(t); setCantidad(1); setAviso(null); }}
                      title={hay ? `Talle ${t}` : `Talle ${t} sin stock${color ? ` en ${color}` : ""}`}
                      className="ag-talle"
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              {hayDetalle && talle && (stockElegido ?? 0) > 0 && (stockElegido ?? 0) <= 5 && (
                <p className="mt-2.5 text-[0.85rem] text-warn">
                  Quedan {stockElegido} en este talle{color ? ` y color` : ""}.
                </p>
              )}
            </div>
          )}

          {/* Cantidad + agregar */}
          {sinStock ? (
            <div className="mt-8 border border-line bg-panel p-5">
              <p className="font-display text-[1.05rem] font-bold">Agotado por ahora</p>
              <p className="mt-2 text-[0.92rem] text-mute">
                Pedinos que te avisemos cuando vuelva, o buscámoslo por encargo en tu talle.
              </p>
              <button
                type="button"
                onClick={() => abrirCotizador({ producto: product.title, marca: product.brand, talle, color })}
                className="ag-btn ag-btn-solid mt-4"
              >
                Pedir por encargo <Icon name="arrow" size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-8">
              <div className="flex flex-wrap items-stretch gap-3">
                <div className="flex items-center border border-line">
                  <button
                    onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    disabled={cantidad <= 1}
                    aria-label="Quitar una unidad"
                    className="grid h-[52px] w-11 place-items-center text-mute transition-colors hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon name="minus" size={15} />
                  </button>
                  <span
                    aria-live="polite"
                    aria-label={`Cantidad: ${cantidad}`}
                    className="ag-num w-9 text-center text-[1rem] font-semibold"
                  >
                    {cantidad}
                  </span>
                  <button
                    onClick={() => setCantidad((c) => Math.min(topeCantidad, c + 1))}
                    disabled={cantidad >= topeCantidad}
                    aria-label="Agregar una unidad"
                    className="grid h-[52px] w-11 place-items-center text-mute transition-colors hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon name="plus" size={15} />
                  </button>
                </div>

                <button onClick={agregar} className="ag-btn ag-btn-solid min-w-[220px] flex-1">
                  {agregado
                    ? "✓ Agregado a la bolsa"
                    : faltaTalle
                    ? "Elegí tu talle"
                    : faltaColor
                    ? "Elegí un color"
                    : "Agregar a la bolsa"}
                </button>
              </div>

              {aviso && (
                <p role="alert" className="mt-3 text-[0.88rem] font-medium text-sale">{aviso}</p>
              )}
            </div>
          )}

          {/* Beneficios de la ficha */}
          <ul className="mt-7 flex flex-col gap-2.5 border-y border-line py-5 text-[0.88rem] text-mute">
            <li className="flex items-center gap-2.5"><Icon name="truck" size={17} /> Envío gratis desde $120.000</li>
            <li className="flex items-center gap-2.5"><Icon name="cambio" size={17} /> Cambio de talle sin cargo, 30 días</li>
            <li className="flex items-center gap-2.5"><Icon name="escudo" size={17} /> Pago protegido con Mercado Pago</li>
          </ul>

          {/* Acordeón */}
          <div className="mt-2">
            {acordeon.map((s) => (
              <div key={s.id} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => setAbierto(abierto === s.id ? null : s.id)}
                  aria-expanded={abierto === s.id}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left font-cond text-[0.92rem] font-semibold uppercase tracking-[0.12em]"
                >
                  {s.titulo}
                  <span className={`shrink-0 text-dim transition-transform ${abierto === s.id ? "rotate-180" : ""}`}>
                    <Icon name="chev" size={16} />
                  </span>
                </button>
                {abierto === s.id && <div className="pb-5">{s.cuerpo}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
