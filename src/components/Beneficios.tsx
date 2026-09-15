import { Icon, IconName } from "@/components/Icons";

/* La tira de beneficios. Va pegada abajo del hero porque las cuatro dudas que
   frenan una compra de ropa por internet son siempre las mismas: cuánto sale
   el envío, en cuántas cuotas, qué pasa si no me queda, y si es seguro pagar
   acá. Contestarlas arriba de todo saca la fricción antes de que aparezca. */
const BENEFICIOS: { icono: IconName; titulo: string; detalle: string }[] = [
  { icono: "truck",  titulo: "Envío gratis desde $120.000", detalle: "A todo el país por Correo Argentino y Andreani." },
  { icono: "cambio", titulo: "Cambios sin cargo",           detalle: "30 días para cambiar el talle. Primer cambio gratis." },
  { icono: "regla",  titulo: "Guía de talles",              detalle: "Las medidas reales de cada prenda, en la ficha." },
  { icono: "escudo", titulo: "Compra protegida",            detalle: "Pagás con Mercado Pago o tarjeta." },
];

export default function Beneficios() {
  return (
    <section aria-label="Por qué comprar acá" className="border-y border-line bg-panel">
      <ul className="mx-auto grid w-full max-w-[1320px] grid-cols-2 gap-x-6 gap-y-7 px-4 py-8 md:grid-cols-4 md:px-6 md:py-10 lg:px-14">
        {BENEFICIOS.map((b) => (
          <li key={b.titulo} className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-chalk">
              <Icon name={b.icono} size={22} />
            </span>
            <div>
              <p className="text-[0.9rem] font-semibold leading-snug">{b.titulo}</p>
              <p className="mt-1 text-[0.83rem] leading-snug text-mute">{b.detalle}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
