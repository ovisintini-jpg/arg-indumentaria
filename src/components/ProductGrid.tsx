"use client";

import { useMemo } from "react";
import { useProducts } from "@/context/ProductsContext";
import { ProductCard } from "@/components/ProductCard";

const CUANTOS = 8;

/* La grilla de destacados de la home.

   POR QUÉ NO ES UN useEffect NI USA Math.random()
   ───────────────────────────────────────────────
   La selección es determinística —lo marcado como novedad, oferta o selección—
   y se calcula durante el render, así que sale igual en el servidor y en el
   navegador: los links quedan adentro del HTML (los ve Google) y la grilla no
   "salta" un instante después de cargar.

   `products` ya viene ordenado por created_at descendente desde la base. */
export default function ProductGrid() {
  const { products, loading } = useProducts();

  const aMostrar = useMemo(() => {
    const destacados = products.filter((p) => p.isNew || p.isExclusive || p.isOutlet);
    const pozo = destacados.length > 0 ? destacados : products;
    return pozo.slice(0, CUANTOS);
  }, [products]);

  /* Dos columnas en el celular. En una tienda de ropa esto no es negociable:
     con una sola columna hay que scrollear una eternidad para ver seis prendas,
     y la decisión de compra se toma comparando. Cuatro en escritorio. */
  const grilla = "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4";

  if (loading && aMostrar.length === 0) {
    return (
      <div className={grilla}>
        {[...Array(CUANTOS)].map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse border border-line bg-panel" />
        ))}
      </div>
    );
  }

  if (!aMostrar.length) {
    return <p className="ag-mono py-12 text-dim">TODAVÍA NO HAY PRODUCTOS CARGADOS</p>;
  }

  return (
    <div className={grilla}>
      {aMostrar.map((prod) => (
        <ProductCard key={prod.id} product={prod} />
      ))}
    </div>
  );
}
