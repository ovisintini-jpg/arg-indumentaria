import Link from "next/link";

/* La 404 es una página de venta, no un cartel de error: el que llega acá casi
   siempre venía por un link viejo de un producto que se agotó o cambió de
   dirección. Entonces, además de decir qué pasó, ofrece los cuatro caminos que
   más se usan. Sin fondos oscuros ni resplandores: es la misma tienda. */
const ATAJOS = [
  { t: "Mujer",   href: "/categoria/mujer" },
  { t: "Hombre",  href: "/categoria/hombre" },
  { t: "Calzado", href: "/categoria/calzado-mujer" },
  { t: "Outlet",  href: "/categoria/outlet" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6 py-20">
      <div className="w-full max-w-[560px] text-center">
        <p className="ag-eyebrow">Error 404</p>

        <h1 className="mt-5 font-display text-[clamp(3.5rem,14vw,7rem)] font-black leading-none tracking-[-0.05em]">
          404
        </h1>

        <h2 className="mt-4 font-display text-[clamp(1.1rem,3.4vw,1.6rem)] font-extrabold uppercase tracking-[-0.02em]">
          No encontramos esta página
        </h2>

        <p className="mx-auto mt-4 max-w-[42ch] text-[0.95rem] text-mute">
          Puede que el link esté roto, o que la prenda ya no esté publicada.
          Probá por acá:
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {ATAJOS.map((a) => (
            <Link
              key={a.t}
              href={a.href}
              className="inline-flex h-11 items-center border border-line px-5 font-cond text-[0.86rem] font-semibold uppercase tracking-[0.14em] text-mute transition-colors hover:border-chalk hover:bg-chalk hover:text-white"
            >
              {a.t}
            </Link>
          ))}
        </div>

        <Link href="/" className="ag-btn ag-btn-solid mt-8">
          Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
