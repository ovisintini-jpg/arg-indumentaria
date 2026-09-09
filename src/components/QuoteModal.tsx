"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";
import { useQuote } from "@/context/QuoteContext";
import { Icon } from "@/components/Icons";

/* El formulario de PEDIDO POR ENCARGO.
   Reemplaza al cotizador de piezas de la versión de autopartes. Entran por acá
   dos clientes distintos y hay que atender a los dos:
     · el que encontró la prenda pero no su talle (llega desde la ficha, con
       todo precargado y sólo tiene que dejar su contacto);
     · el que vio algo en otro lado y quiere que se lo consigamos (llega desde
       una búsqueda sin resultados y escribe todo).
   Por eso lo único obligatorio es QUÉ busca y CÓMO contactarlo. */
interface Form {
  producto: string; marca: string; talle: string; color: string;
  referencia: string; sku: string;
  nombre: string; email: string; whatsapp: string;
  contacto: "email" | "whatsapp";
}

const VACIO: Form = {
  producto: "", marca: "", talle: "", color: "",
  referencia: "", sku: "",
  nombre: "", email: "", whatsapp: "",
  contacto: "email",
};

const MAX_FOTOS = 4;

function Campo({
  label, req, span, hint, children,
}: {
  label: string; req?: boolean; span?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="ag-label mb-2 block">
        {label}{req && <span className="ml-1 text-acentohi">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[0.8rem] font-light leading-relaxed text-dim">{hint}</p>}
    </div>
  );
}

export default function QuoteModal() {
  const { abierto, prefill, cerrarCotizador } = useQuote();
  const { user } = useUser();

  const [form,    setForm]    = useState<Form>(VACIO);
  const [fotos,   setFotos]   = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error,   setError]   = useState("");
  const [numero,  setNumero]  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Al abrir: precargar lo que ya sabemos (lo que buscó, o su cuenta)
  useEffect(() => {
    if (!abierto) return;
    setForm({
      ...VACIO,
      producto:   prefill.producto   ?? "",
      marca:      prefill.marca      ?? "",
      talle:      prefill.talle      ?? "",
      color:      prefill.color      ?? "",
      referencia: prefill.referencia ?? "",
      email:      user?.email        ?? "",
    });
    setFotos([]); setError(""); setNumero("");
  }, [abierto, prefill, user]);

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cerrarCotizador(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, cerrarCotizador]);

  // Si tiene cuenta, traemos su nombre y teléfono del perfil
  useEffect(() => {
    if (!abierto || !user) return;
    supabase.from("user_profiles").select("full_name,phone").eq("id", user.id).single()
      .then(({ data }) => {
        if (!data) return;
        setForm((f) => ({
          ...f,
          nombre:   f.nombre   || (data.full_name ?? ""),
          whatsapp: f.whatsapp || (data.phone     ?? ""),
        }));
      });
  }, [abierto, user]);

  const set = (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const listo = Boolean(
    form.producto.trim() && form.nombre.trim() && emailValido
  );

  /* ── Fotos ────────────────────────────────────────────────── */
  const subirFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []).slice(0, MAX_FOTOS - fotos.length);
    if (!archivos.length) return;
    setSubiendo(true); setError("");

    const nuevas: string[] = [];
    for (const file of archivos) {
      const ext    = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error: err } = await supabase.storage
        .from("consultas").upload(nombre, file, { cacheControl: "3600", upsert: false });

      if (err || !data) { setError("No pudimos subir una de las fotos. Probá con otra."); continue; }
      const { data: { publicUrl } } = supabase.storage.from("consultas").getPublicUrl(data.path);
      nuevas.push(publicUrl);
    }

    setFotos((f) => [...f, ...nuevas]);
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const quitarFoto = (url: string) => setFotos((f) => f.filter((u) => u !== url));

  /* ── Enviar ───────────────────────────────────────────────── */
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo) return;
    setEnviando(true); setError("");

    const { data, error: err } = await supabase.rpc("crear_consulta", {
      p_producto_buscado:   form.producto,
      p_nombre:             form.nombre,
      p_email:              form.email,
      p_marca_buscada:      form.marca      || null,
      p_talle_buscado:      form.talle      || null,
      p_color_buscado:      form.color      || null,
      p_referencia:         form.referencia || null,
      p_codigo:             form.sku        || null,
      p_fotos:              fotos.length ? fotos : null,
      p_whatsapp:           form.whatsapp || null,
      p_contacto_preferido: form.contacto,
      p_user_id:            user?.id ?? null,
    });

    setEnviando(false);

    if (err) {
      setError(
        err.message.includes("demasiadas_consultas")
          ? "Ya nos mandaste varias consultas hoy. Escribinos y las vemos todas juntas."
          : err.message.includes("email_invalido")
          ? "Revisá el email, no parece válido."
          : "No pudimos enviar la consulta. Probá de nuevo en un momento."
      );
      return;
    }

    const fila = Array.isArray(data) ? data[0] : data;
    setNumero(fila?.consulta_numero ?? "recibida");

    // Aviso interno. Nunca debe romper el envío si Resend no está configurado.
    fetch("/api/consulta-nueva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero:   fila?.consulta_numero,
        producto: form.producto,
        detalle:  [form.marca, form.talle && `Talle ${form.talle}`, form.color]
                    .filter(Boolean).join(" · "),
        referencia: form.referencia,
        sku:      form.sku,
        nombre:   form.nombre,
        email:    form.email,
        whatsapp: form.whatsapp,
        fotos,
      }),
    }).catch((e) => console.error("[cotizador] aviso interno:", e));
  };

  if (!abierto) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-chalk/40 backdrop-blur-sm" onClick={cerrarCotizador} />

      <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-6">
        <div className="pointer-events-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden border border-line bg-ink">
          <div className="ag-rail shrink-0" aria-hidden="true" />

          {/* Cabecera */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-6 md:px-8">
            <div>
              <div className="ag-tick mb-3" aria-hidden="true"><i /><i /><i /></div>
              <h2 className="font-display text-[1.35rem] font-extrabold uppercase leading-tight tracking-[-0.02em]">
                {numero ? "Pedido recibido" : "Pedilo por encargo"}
              </h2>
              {!numero && (
                <p className="mt-1.5 max-w-[46ch] text-[0.9rem] font-light leading-relaxed text-mute">
                  ¿No está tu talle o no encontrás la prenda? Contanos qué buscás y te decimos si la conseguimos, a qué precio y en cuánto tiempo.
                </p>
              )}
            </div>
            <button
              onClick={cerrarCotizador}
              aria-label="Cerrar"
              className="grid h-9 w-9 shrink-0 place-items-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* Contenido */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-7 md:px-8">

            {numero ? (
              <div className="py-6 text-center">
                <span className="mx-auto mb-5 grid h-12 w-12 place-items-center border border-ok/40 text-ok">
                  <Icon name="check" size={22} />
                </span>
                <p className="ag-mono text-[1.1rem] font-medium tracking-[0.06em] text-acentohi">{numero}</p>
                <p className="mx-auto mt-4 max-w-[42ch] font-light leading-relaxed text-mute">
                  Lo tenemos anotado. Vamos a buscarlo y te escribimos con el precio y el plazo.
                  Si aparece algo parecido que te sirva, también te lo mostramos.
                </p>
                <button onClick={cerrarCotizador} className="ag-btn ag-btn-ghost ag-btn-sm mt-8">
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={enviar} className="space-y-8">

                {/* ── Qué busca ── */}
                <section>
                  <p className="ag-eyebrow mb-4">Qué estás buscando</p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Campo label="Qué prenda o calzado" req span
                           hint="Cuanto más preciso, más rápido lo encontramos: tipo de prenda, color, para quién es.">
                      <textarea value={form.producto} onChange={set("producto")} required rows={3}
                        placeholder="Ej.: campera de jean oversize, talle L, color celeste"
                        className="ag-input resize-none" />
                    </Campo>
                    <Campo label="Marca">
                      <input value={form.marca} onChange={set("marca")}
                        placeholder="Levi's, Nike, Vans…" className="ag-input" />
                    </Campo>
                    <Campo label="Talle">
                      <input value={form.talle} onChange={set("talle")}
                        placeholder="M · 42 · 6 años" className="ag-input" />
                    </Campo>
                    <Campo label="Color">
                      <input value={form.color} onChange={set("color")}
                        placeholder="Negro" className="ag-input" />
                    </Campo>
                    <Campo label="Código / SKU" hint="Si lo viste en nuestra tienda, copiá el código de la ficha.">
                      <input value={form.sku} onChange={set("sku")}
                        placeholder="RM-OVS-24" className="ag-input ag-mono" />
                    </Campo>
                    <Campo label="Link de referencia" span
                           hint="Si lo viste en otra página o en Instagram, pegá el link y lo buscamos igual.">
                      <input value={form.referencia} onChange={set("referencia")}
                        placeholder="https://…" className="ag-input" />
                    </Campo>
                  </div>
                </section>

                {/* ── Fotos ── */}
                <section className="border-t border-line pt-7">
                  <p className="ag-eyebrow mb-4">Una foto ayuda</p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <label className="ag-label">Fotos ({fotos.length}/{MAX_FOTOS})</label>
                        {fotos.length < MAX_FOTOS && (
                          <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo}
                            className="font-cond text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-acentohi transition-colors hover:text-chalk disabled:opacity-40">
                            {subiendo ? "Subiendo…" : "+ Agregar foto"}
                          </button>
                        )}
                        <input ref={fileRef} type="file" accept="image/*" multiple
                          className="hidden" onChange={subirFotos} />
                      </div>

                      {fotos.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                          {fotos.map((url, i) => (
                            <div key={url} className="group relative aspect-square">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Foto ${i + 1}`}
                                className="h-full w-full border border-line object-cover" />
                              <button type="button" onClick={() => quitarFoto(url)}
                                className="absolute inset-0 grid place-items-center bg-chalk/80 font-cond text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button type="button" onClick={() => fileRef.current?.click()}
                          className="w-full border border-dashed border-line px-5 py-6 text-center transition-colors hover:border-acento">
                          <p className="ag-label">{subiendo ? "Subiendo…" : "Sumá una foto de lo que buscás"}</p>
                          <p className="mt-1.5 text-[0.82rem] font-light text-dim">
                            Una captura de pantalla o la foto de la etiqueta alcanza.
                          </p>
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* ── Contacto ── */}
                <section className="border-t border-line pt-7">
                  <p className="ag-eyebrow mb-4">Cómo te contactamos</p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Campo label="Nombre" req>
                      <input value={form.nombre} onChange={set("nombre")} required
                        autoComplete="name" className="ag-input" />
                    </Campo>
                    <Campo label="Email" req>
                      <input type="email" value={form.email} onChange={set("email")} required
                        autoComplete="email" className="ag-input" />
                    </Campo>
                    <Campo label="WhatsApp">
                      <input type="tel" value={form.whatsapp} onChange={set("whatsapp")}
                        placeholder="+54 9 ..." className="ag-input" />
                    </Campo>
                    <Campo label="Preferís que te escribamos por">
                      <div className="flex gap-2">
                        {(["email", "whatsapp"] as const).map((v) => (
                          <button
                            key={v} type="button"
                            onClick={() => setForm((f) => ({ ...f, contacto: v }))}
                            className={`flex-1 border px-4 py-3 font-cond text-[0.82rem] font-semibold uppercase tracking-[0.14em] transition-colors ${
                              form.contacto === v
                                ? "border-acento bg-acento/10 text-acentohi"
                                : "border-line text-dim hover:border-linehi hover:text-mute"
                            }`}
                          >
                            {v === "email" ? "Email" : "WhatsApp"}
                          </button>
                        ))}
                      </div>
                    </Campo>
                  </div>
                </section>

                {error && (
                  <div className="border border-sale/40 bg-sale/10 px-4 py-3">
                    <p className="text-[0.88rem] font-light leading-relaxed text-sale">{error}</p>
                  </div>
                )}

                <div className="border-t border-line pt-6">
                  <button type="submit" disabled={!listo || enviando || subiendo}
                    className="ag-btn ag-btn-solid w-full">
                    {enviando ? "Enviando…" : "Enviar el pedido"}
                    {!enviando && <Icon name="arrow" size={18} />}
                  </button>
                  <p className="mt-3 text-center text-[0.8rem] font-light text-dim">
                    Sin compromiso. Te respondemos con precio y plazo antes de que decidas.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
