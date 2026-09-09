"use client";

// ═══════════════════════════════════════════════════════════════
//  Piezas compartidas del panel admin.
//  Mismo lenguaje visual que la tienda: grafito de taller, cantos
//  rectos, Archivo para títulos, Barlow Condensed para etiquetas,
//  Plex Mono para números. Nada de cajas redondeadas.
// ═══════════════════════════════════════════════════════════════

import React, { ReactNode } from "react";

/* ── Tonos semánticos ──────────────────────────────────────────── */

export type Tone = "mute" | "acento" | "ok" | "warn" | "sale";

const TONE_TEXT: Record<Tone, string> = {
  mute: "text-mute",
  acento: "text-acentohi",
  ok:   "text-ok",
  warn: "text-warn",
  sale: "text-sale",
};

const TONE_CHIP: Record<Tone, string> = {
  mute: "text-mute  border-line       bg-raise",
  acento: "text-acentohi border-acento/40   bg-acento/10",
  ok:   "text-ok     border-ok/40     bg-ok/10",
  warn: "text-warn   border-warn/40   bg-warn/10",
  sale: "text-sale   border-sale/40   bg-sale/10",
};

const TONE_BAR: Record<Tone, string> = {
  mute: "bg-linehi",
  acento: "bg-acento",
  ok:   "bg-ok",
  warn: "bg-warn",
  sale: "bg-sale",
};

export const toneBar = (t: Tone) => TONE_BAR[t];

/* ── Formato ───────────────────────────────────────────────────── */

export const fmtARS = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

export const fmtARS2 = (n: number) =>
  "$" + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

export const hoy = () =>
  new Date().toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

/* ── Contenedor de página ──────────────────────────────────────── */

export function Page({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[1560px] px-7 py-8 lg:px-11 lg:py-10">{children}</div>;
}

export function PageHead({
  eyebrow = "Panel admin",
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-7">
      <div>
        <div className="ag-tick mb-3.5" aria-hidden="true"><i /><i /><i /></div>
        <p className="ag-eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-[clamp(1.7rem,3.2vw,2.6rem)] font-extrabold uppercase leading-none">
          {title}
        </h1>
        {sub && <p className="mt-3 max-w-[52ch] font-light text-mute">{sub}</p>}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </header>
  );
}

/* ── Métricas ──────────────────────────────────────────────────── */

export function StatRow({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const grid =
    cols === 5 ? "sm:grid-cols-2 lg:grid-cols-5" :
    cols === 3 ? "sm:grid-cols-3" :
                 "sm:grid-cols-2 lg:grid-cols-4";
  return <div className={`mb-8 grid grid-cols-1 gap-px bg-line ${grid}`}>{children}</div>;
}

export function Stat({
  label, value, hint, tone = "mute",
}: {
  label: string; value: ReactNode; hint?: string; tone?: Tone;
}) {
  return (
    <div className="bg-panel px-6 py-6">
      <p className="ag-label">{label}</p>
      <p className={`ag-num mt-2.5 font-display text-[2.1rem] font-extrabold leading-none ${tone === "mute" ? "text-chalk" : TONE_TEXT[tone]}`}>
        {value}
      </p>
      {hint && <p className="ag-label mt-2.5">{hint}</p>}
    </div>
  );
}

/* ── Panel / tarjeta ───────────────────────────────────────────── */

export function Panel({
  title, action, children, flush = false, className = "",
}: {
  title?: string; action?: ReactNode; children: ReactNode; flush?: boolean; className?: string;
}) {
  return (
    <section className={`border border-line bg-panel ${className}`}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5">
          <h2 className="ag-eyebrow text-chalk">{title}</h2>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-6"}>{children}</div>
    </section>
  );
}

/* ── Botones ───────────────────────────────────────────────────── */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "acento" | "solid" | "ghost" | "danger";
  size?: "sm" | "xs" | "md";
};

export function Btn({ variant = "ghost", size = "sm", className = "", ...rest }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 border font-cond font-semibold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const sizes = {
    xs: "h-8  px-3  text-[0.72rem]",
    sm: "h-10 px-4  text-[0.8rem]",
    md: "h-12 px-7  text-[0.9rem]",
  }[size];
  const variants = {
    acento:   "border-acento bg-acento text-white hover:bg-acentohi hover:border-acentohi",
    solid:  "border-chalk bg-chalk text-ink hover:bg-white",
    ghost:  "border-line text-mute hover:border-linehi hover:text-chalk",
    danger: "border-line text-mute hover:border-sale hover:text-sale",
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...rest} />;
}

/* ── Campos ────────────────────────────────────────────────────── */

export function Field({
  label, hint, span, children,
}: {
  label: string; hint?: string; span?: boolean; children: ReactNode;
}) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="ag-label mb-2 block">{label}</label>
      {children}
      {hint && <p className="ag-label mt-1.5 normal-case tracking-[0.08em]">{hint}</p>}
    </div>
  );
}

const FIELD_CLS =
  "w-full border border-line bg-ink px-4 py-3 text-[0.95rem] text-chalk transition-colors placeholder:text-dim focus:border-acento focus:outline-none";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`${FIELD_CLS} ${className}`} {...rest} />;
  }
);

export function TextArea({ className = "", ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLS} resize-none ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_CLS} cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** Select compacto y coloreado, para estados dentro de una tabla. */
export function StatusSelect({
  tone, className = "", children, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { tone: Tone }) {
  return (
    <select
      className={`cursor-pointer border bg-transparent px-3 py-1.5 font-cond text-[0.78rem] font-semibold uppercase tracking-[0.16em] focus:outline-none ${TONE_CHIP[tone]} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Check({
  checked, onChange, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-acento"
      />
      <span className="ag-label group-hover:text-mute">{label}</span>
    </label>
  );
}

/* ── Chips ─────────────────────────────────────────────────────── */

export function Badge({ tone = "mute", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block border px-2.5 py-1 font-cond text-[0.7rem] font-semibold uppercase tracking-[0.18em] ${TONE_CHIP[tone]}`}>
      {children}
    </span>
  );
}

/* ── Tabla ─────────────────────────────────────────────────────── */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-line bg-panel">
      <table className="w-full min-w-[860px] border-collapse">{children}</table>
    </div>
  );
}

export function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-line bg-ink/50">
        {cols.map((c, i) => (
          <th key={i} className="ag-label px-4 py-4 text-left font-semibold">{c}</th>
        ))}
      </tr>
    </thead>
  );
}

export function Td({ children, className = "", ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-4 align-middle ${className}`} {...rest}>{children}</td>;
}

export function Row({ children, active = false, dim = false }: { children: ReactNode; active?: boolean; dim?: boolean }) {
  return (
    <tr className={`border-b border-line/70 transition-colors ${active ? "bg-raise" : "hover:bg-raise/50"} ${dim ? "opacity-45" : ""}`}>
      {children}
    </tr>
  );
}

/* ── Estados ───────────────────────────────────────────────────── */

export function Loading({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20">
      <span className="h-1.5 w-1.5 animate-pulse bg-acento" />
      <p className="ag-label">{label}…</p>
    </div>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-6 py-20 text-center">
      <div className="ag-tick mx-auto mb-5 opacity-40" aria-hidden="true"><i /><i /><i /></div>
      <p className="font-display text-lg font-extrabold uppercase text-mute">{title}</p>
      {sub && <p className="mx-auto mt-2 max-w-[46ch] font-light text-dim">{sub}</p>}
    </div>
  );
}

export function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-5 h-[3px] w-9 bg-warn" aria-hidden="true" />
      <p className="font-display text-lg font-extrabold uppercase text-warn">
        No se pudo leer la base
      </p>
      <p className="mx-auto mt-2.5 max-w-[54ch] font-light leading-relaxed text-mute">{msg}</p>
    </div>
  );
}

export const SIN_RESPUESTA =
  "La base no respondió. Revisá NEXT_PUBLIC_SUPABASE_URL y la clave anon en .env.local, y que el proyecto de Supabase esté activo.";

export function Note({ children }: { children: ReactNode }) {
  return <p className="ag-label mt-5 normal-case tracking-[0.08em]">{children}</p>;
}

export function Msg({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p className={`font-cond text-[0.85rem] font-semibold uppercase tracking-[0.14em] ${TONE_TEXT[tone]}`}>
      {children}
    </p>
  );
}

/* ── Modal ─────────────────────────────────────────────────────── */

export function Modal({
  open, onClose, eyebrow, title, sub, children, footer, width = "max-w-3xl",
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
        <div className={`pointer-events-auto flex max-h-[88vh] w-full ${width} flex-col overflow-hidden border border-line bg-panel`}>
          <div className="ag-rail shrink-0" aria-hidden="true" />
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-7 py-6">
            <div>
              {eyebrow && <p className="ag-eyebrow mb-2">{eyebrow}</p>}
              <h3 className="font-display text-xl font-extrabold uppercase leading-tight">{title}</h3>
              {sub && <p className="mt-1 text-sm font-light text-mute">{sub}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-mute transition-colors hover:border-linehi hover:text-chalk"
            >
              ✕
            </button>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto px-7 py-7">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line px-7 py-5">{footer}</div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Confirmación destructiva ──────────────────────────────────── */

export function Confirm({
  open, title, body, confirmLabel = "Sí, eliminar", onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm" onClick={onCancel} />
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="pointer-events-auto w-full max-w-md border border-sale/40 bg-panel">
          <div className="h-[3px] w-full bg-sale" aria-hidden="true" />
          <div className="px-8 py-8">
            <p className="ag-eyebrow mb-3 text-sale">Acción irreversible</p>
            <h3 className="font-display text-xl font-extrabold uppercase leading-tight">{title}</h3>
            <p className="mt-3 font-light leading-relaxed text-mute">{body}</p>
            <div className="mt-8 flex gap-3">
              <Btn size="md" variant="ghost" className="flex-1" onClick={onCancel}>Cancelar</Btn>
              <button
                onClick={onConfirm}
                className="inline-flex h-12 flex-1 items-center justify-center border border-sale bg-sale/15 px-6 font-cond text-[0.9rem] font-semibold uppercase tracking-[0.16em] text-sale transition-colors hover:bg-sale hover:text-white"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Barra de progreso ─────────────────────────────────────────── */

export function Bar({ pct, tone = "acento" }: { pct: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden bg-raise">
      <div className={`h-full transition-all ${TONE_BAR[tone]}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
