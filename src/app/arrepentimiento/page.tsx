import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/components/Brand";
import Footer from "@/components/Footer";
import ArrepentimientoForm from "@/components/ArrepentimientoForm";

// Página exigida por la Resolución 424/2020 de la Secretaría de Comercio
// Interior. Tres cosas son obligatorias y no se negocian:
//   1. Se entra desde un link visible y directo de la home.
//   2. No se puede pedir registro previo ni ningún trámite adicional.
//   3. Dentro de las 24 h hay que darle al cliente un código de tramitación.
// Por eso es una ruta propia (no un modal): entra directo desde el link,
// se puede compartir y queda indexable.

export const metadata: Metadata = {
  // La marca la agrega el `title.template` de app/layout.tsx.
  title: "Botón de arrepentimiento",
  description:
    "Pedí la revocación de tu compra dentro de los 10 días corridos de recibida la pieza. Sin registro, sin costo.",
  robots: { index: true, follow: true },
};

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-panel p-5">
      <p className="ag-eyebrow mb-2 !text-acentohi">{titulo}</p>
      <p className="text-[0.95rem] font-light leading-relaxed text-mute">{children}</p>
    </div>
  );
}

export default function ArrepentimientoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-chalk">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
        <div className="ag-rail" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-14">
          <Link href="/" aria-label="ARG Indumentaria, inicio">
            <Brand />
          </Link>
          <Link href="/" className="ag-btn ag-btn-ghost ag-btn-sm">
            Volver a la tienda
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16 lg:px-14">
          <div className="ag-tick mb-5" aria-hidden="true"><i /><i /><i /></div>

          <h1 className="font-display text-[2rem] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] md:text-[2.9rem]">
            Botón de arrepentimiento
          </h1>
          <p className="mt-4 max-w-[62ch] text-[1.02rem] font-light leading-relaxed text-mute">
            Si te arrepentiste de una compra, pedís la revocación acá y listo. No hace falta que
            expliques por qué, no tenés que crear una cuenta y no te cobramos nada.
            
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Dato titulo="Tenés 10 días corridos">
              Se cuentan desde que recibís la pieza o desde que se cierra la compra, lo que pase
              último.
            </Dato>
            <Dato titulo="El envío lo pagamos nosotros">
              Vos sólo ponés la pieza a disposición. El retiro y el flete de vuelta corren por
              nuestra cuenta.
            </Dato>
            <Dato titulo="Te damos un código">
              Al enviar el formulario te aparece en pantalla y te llega por mail el código de
              tramitación. Guardalo.
            </Dato>
          </div>

          <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
            <ArrepentimientoForm />

            <aside className="lg:pt-2">
              <p className="ag-eyebrow mb-4 !text-chalk">Cómo sigue</p>
              <ol className="flex flex-col gap-5">
                {[
                  ["01", "Mandás el formulario", "Con el número de pedido resolvemos más rápido, pero si no lo tenés a mano lo buscamos por tu mail."],
                  ["02", "Te confirmamos el código", "Te llega por el mismo medio dentro de las 24 horas, como corresponde."],
                  ["03", "Coordinamos el retiro", "Te decimos cómo devolver la pieza. El costo del envío de vuelta es nuestro."],
                  ["04", "Te devolvemos la plata", "Por el mismo medio de pago con el que compraste, una vez que la pieza vuelve."],
                ].map(([n, t, d]) => (
                  <li key={n} className="flex gap-4">
                    <span className="ag-mono shrink-0 pt-0.5 text-[0.8rem] text-acentohi">{n}</span>
                    <span>
                      <span className="block font-display text-[0.95rem] font-bold uppercase tracking-wide">
                        {t}
                      </span>
                      <span className="mt-1 block text-[0.9rem] font-light leading-relaxed text-mute">
                        {d}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-9 border-l-2 border-acento pl-4">
                <p className="text-[0.9rem] font-light leading-relaxed text-mute">
                  La prenda o calzado no tienen que haber sido usada, ni tener rastros de uso, tiene que tener sus etiquetas y embalaje original.
                  se puede cambiar por otro talle, o podemos devolver el dinero.
                </p>
              </div>

              <p className="mt-8 text-[0.85rem] font-light leading-relaxed text-dim">
                Si preferís, también podés pedir la revocación por escrito a{" "}
                <a href="mailto:ventas@argindumentaria.com.ar" className="text-acentohi hover:underline">
                  ventas@argindumentaria.com.ar
                </a>
                . Y ante cualquier problema podés reclamar en{" "}
                <a
                  href="https://autogestion.produccion.gob.ar/consumidores"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-acentohi hover:underline"
                >
                  Defensa del Consumidor
                </a>
                .
              </p>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
