"use client";

// components/ImageZoomModal.tsx
//
// El modal de zoom de la ficha de producto. La foto chica de la ficha va en
// `object-contain` para mostrarse ENTERA (antes iba en `object-cover` y
// recortaba la prenda como si tuviera zoom puesto). Acá, en cambio, sí
// corresponde ocupar toda la pantalla: es lo que el cliente pidió al hacer
// click, así que la imagen se ve lo más grande posible mientras entre entera.

import { useEffect } from "react";
import { Icon } from "@/components/Icons";

export default function ImageZoomModal({
  imagenes,
  activa,
  alt,
  onCerrar,
  onCambiar,
}: {
  imagenes: string[];
  activa: number;
  alt: string;
  onCerrar: () => void;
  onCambiar: (i: number) => void;
}) {
  // Esc para cerrar, y bloquea el scroll de atrás mientras el modal está
  // abierto — si no, en el celular la página se sigue moviendo debajo.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") onCambiar((activa + 1) % imagenes.length);
      if (e.key === "ArrowLeft") onCambiar((activa - 1 + imagenes.length) % imagenes.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", onKey);
    };
  }, [activa, imagenes.length, onCambiar, onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ampliada de ${alt}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-chalk/95 p-4 md:p-10"
      onClick={onCerrar}
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center border border-white/25 text-white transition-colors hover:bg-white/10"
      >
        <Icon name="close" size={20} />
      </button>

      {imagenes.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCambiar((activa - 1 + imagenes.length) % imagenes.length);
            }}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center text-white transition-colors hover:bg-white/10 md:left-6"
          >
            <Icon name="chev" size={22} className="rotate-90" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCambiar((activa + 1) % imagenes.length);
            }}
            aria-label="Foto siguiente"
            className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center text-white transition-colors hover:bg-white/10 md:right-6"
          >
            <Icon name="chev" size={22} className="-rotate-90" />
          </button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagenes[activa]}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] object-contain"
      />

      {imagenes.length > 1 && (
        <span className="ag-num absolute bottom-5 left-1/2 -translate-x-1/2 text-[0.82rem] text-white/80">
          {activa + 1} / {imagenes.length}
        </span>
      )}
    </div>
  );
}
