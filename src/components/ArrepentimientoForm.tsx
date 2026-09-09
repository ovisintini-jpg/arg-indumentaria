"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/UserContext";
import { Icon } from "@/components/Icons";

// Formulario del botón de arrepentimiento (Res. 424/2020).
//
// Regla de oro: NO puede exigir registro ni ningún trámite previo. Por eso
// pide lo mínimo para identificar la compra, todo lo demás es opcional, y el
// motivo se aclara que no hace falta explicarlo.
//
// Si el alta en la base falla (por ejemplo, todavía no se corrió
// supabase/parches/arrepentimientos.sql), NO se le corta el trámite al
// cliente: se genera un código local y el aviso sale igual por mail. La
// solicitud nunca se pierde por un problema nuestro.

interface Form {
  nombre: string;
  email: string;
  telefono: string;
  documento: string;
  pedido: string;
  fecha: string;
  producto: string;
  motivo: string;
}

const VACIO: Form = {
  nombre: "", email: "", telefono: "", documento: "",
  pedido: "", fecha: "", producto: "", motivo: "",
};

function codigoLocal() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `ARR-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

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

export default function ArrepentimientoForm() {
  const { user } = useUser();
  const [form, setForm] = useState<Form>({ ...VACIO, email: user?.email ?? "" });
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");

  const set = (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const listo = form.nombre.trim() !== "" && form.email.trim() !== "";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo || enviando) return;
    setEnviando(true);
    setError("");

    let cod = "";

    try {
      const { data, error: err } = await supabase.rpc("crear_arrepentimiento", {
        p_nombre:        form.nombre,
        p_email:         form.email,
        p_telefono:      form.telefono || null,
        p_documento:     form.documento || null,
        p_pedido_numero: form.pedido || null,
        p_fecha_compra:  form.fecha || null,
        p_producto:      form.producto || null,
        p_motivo:        form.motivo || null,
        p_user_id:       user?.id ?? null,
      });

      if (err) {
        if (err.message.includes("email_invalido")) {
          setError("Revisá el email, no parece válido.");
          setEnviando(false);
          return;
        }
        if (err.message.includes("demasiadas_solicitudes")) {
          setError(
            "Ya recibimos varias solicitudes desde este mail hoy. Escribinos a ventas@argindumentaria.com.ar y lo resolvemos por ahí."
          );
          setEnviando(false);
          return;
        }
        // Cualquier otra cosa es un problema nuestro, no del cliente:
        // seguimos con un código local y el aviso por mail.
        console.error("[arrepentimiento] no se pudo guardar en la base:", err.message);
      }

      const fila = Array.isArray(data) ? data[0] : data;
      cod = fila?.arrepentimiento_codigo ?? codigoLocal();
    } catch (err) {
      console.error("[arrepentimiento] error inesperado:", err);
      cod = codigoLocal();
    }

    // Aviso interno + acuse al cliente. Nunca debe romper el trámite.
    try {
      await fetch("/api/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: cod, ...form }),
      });
    } catch (err) {
      console.error("[arrepentimiento] aviso:", err);
    }

    setCodigo(cod);
    setEnviando(false);
  };

  if (codigo) {
    return (
      <div className="border border-ok/30 bg-panel p-8 md:p-10">
        <span className="mb-6 grid h-12 w-12 place-items-center border border-ok/40 text-ok">
          <Icon name="check" size={22} />
        </span>
        <h2 className="font-display text-[1.35rem] font-extrabold uppercase leading-tight tracking-[-0.02em]">
          Solicitud recibida
        </h2>
        <p className="mt-3 max-w-[52ch] font-light leading-relaxed text-mute">
          Tu pedido de revocación quedó registrado. Este es el código de tramitación; guardalo,
          también te lo mandamos por mail.
        </p>

        <p className="ag-mono mt-6 border border-line bg-ink px-5 py-4 text-[1.15rem] font-medium tracking-[0.06em] text-acentohi">
          {codigo}
        </p>

        <p className="mt-6 max-w-[52ch] text-[0.95rem] font-light leading-relaxed text-mute">
          Dentro de las próximas 24 horas te escribimos para coordinar el retiro de la pieza. El
          costo del envío de vuelta corre por nuestra cuenta y el reintegro se hace por el mismo
          medio con el que pagaste.
        </p>

        <Link href="/" className="ag-btn ag-btn-ghost ag-btn-sm mt-9 inline-flex">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-9">
      <section>
        <p className="ag-eyebrow mb-4">Tus datos</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo label="Nombre y apellido" req>
            <input value={form.nombre} onChange={set("nombre")} required
              autoComplete="name" className="ag-input" />
          </Campo>
          <Campo label="Email" req hint="Acá te mandamos el código de tramitación.">
            <input type="email" value={form.email} onChange={set("email")} required
              autoComplete="email" className="ag-input" />
          </Campo>
          <Campo label="Teléfono o WhatsApp">
            <input value={form.telefono} onChange={set("telefono")}
              placeholder="+54 9 ..." autoComplete="tel" className="ag-input" />
          </Campo>
          <Campo label="DNI o CUIT">
            <input value={form.documento} onChange={set("documento")}
              placeholder="Opcional" className="ag-input ag-mono" />
          </Campo>
        </div>
      </section>

      <section>
        <p className="ag-eyebrow mb-4">La compra</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Campo label="N.º de pedido" hint="Está en el mail de confirmación. Si no lo encontrás, dejalo vacío.">
            <input value={form.pedido} onChange={set("pedido")}
              placeholder="Ej.: PE-000123" className="ag-input ag-mono" />
          </Campo>
          <Campo label="Fecha de la compra">
            <input type="date" value={form.fecha} onChange={set("fecha")} className="ag-input" />
          </Campo>
          <Campo label="Qué pieza querés devolver" span>
            <input value={form.producto} onChange={set("producto")}
              placeholder="Ej.: kit de distribución Gates, SKU 03L 198 119 D" className="ag-input" />
          </Campo>
          <Campo
            label="Motivo" span
            hint="No estás obligado a explicar nada: el derecho de revocación no exige justificar. Si nos contás qué pasó, nos sirve para no repetirlo."
          >
            <textarea value={form.motivo} onChange={set("motivo")} rows={4}
              placeholder="Opcional"
              className="ag-input resize-none" />
          </Campo>
        </div>
      </section>

      {error && (
        <p className="border border-sale/40 bg-sale/5 px-4 py-3 text-[0.9rem] font-light text-sale">
          {error}
        </p>
      )}

      <div>
        <button type="submit" disabled={!listo || enviando} className="ag-btn ag-btn-acento w-full sm:w-auto">
          {enviando ? "Enviando…" : "Solicitar la revocación"}
        </button>
        <p className="mt-3 text-[0.85rem] font-light leading-relaxed text-dim">
          Sin costo y sin penalidad. Usamos estos datos únicamente para tramitar la devolución.
        </p>
      </div>
    </form>
  );
}
