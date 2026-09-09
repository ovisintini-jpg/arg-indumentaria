"use client";

import Link from "next/link";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import { useProducts } from "@/context/ProductsContext";
import SectionHead from "@/components/SectionHead";
import { Icon, categoryIcon } from "@/components/Icons";

/* La grilla de categorías.

   Antes eran botones que filtraban la home sin cambiar la dirección: el
   visitante no podía compartir "la sección de mujer" ni volver con la flecha
   del navegador, y Google no veía nada. Ahora cada baldosa es un link de
   verdad a /categoria/<id>, que es una página con su propio título y su propia
   descripción.

   El dibujo es de filete: las líneas de la grilla las hace el borde de cada
   baldosa, no un fondo gris con separaciones. Con doce baldosas la última fila
   puede quedar incompleta, y con el truco del fondo el gris asoma en las
   celdas vacías —se ve un rectángulo suelto, como si faltara una imagen. */
export default function CategoryTiles() {
  const { categories } = useCatalogCategories();
  const { products } = useProducts();

  const contar = (id: string) => products.filter((p) => p.categoryId === id).length;

  const baldosa =
    "group relative flex min-h-[128px] flex-col justify-between gap-4 border-b border-r border-line bg-ink p-4 pt-5 text-left transition-colors hover:bg-chalk hover:text-white md:min-h-[186px] md:p-6 md:pt-7";

  return (
    <section
      id="catalogo"
      className="mx-auto w-full max-w-[1320px] scroll-mt-[124px] px-4 py-12 md:scroll-mt-24 md:px-6 md:py-20 lg:px-14"
    >
      <SectionHead
        eyebrow="Catálogo"
        title="Elegí por dónde empezar"
        sub="Once secciones, de bebés a calzado de vestir. Todo con talles y colores a la vista."
      />

      <div className="grid grid-cols-2 border-l border-t border-line md:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <Link key={cat.id} href={`/categoria/${cat.id}`} className={baldosa}>
            <span className="text-linehi transition-colors group-hover:text-white">
              <Icon
                name={categoryIcon(cat.id)}
                size={46}
                className="h-9 w-9 md:h-[52px] md:w-[52px]"
              />
            </span>
            <span>
              <span className="block font-display text-[0.9rem] font-bold uppercase leading-tight tracking-[-0.01em] md:text-[1.05rem]">
                {cat.name}
              </span>
              <span className="ag-num mt-1 block text-[0.76rem] text-dim transition-colors group-hover:text-white/70 md:mt-1.5 md:text-[0.82rem]">
                {contar(cat.id)} artículos
              </span>
            </span>
          </Link>
        ))}

        <Link href="/categoria/todos" className={baldosa}>
          <span className="text-linehi transition-colors group-hover:text-white">
            <Icon name="search" size={46} className="h-9 w-9 md:h-[52px] md:w-[52px]" />
          </span>
          <span>
            <span className="block font-display text-[0.9rem] font-bold uppercase leading-tight tracking-[-0.01em] md:text-[1.05rem]">
              Ver todo el catálogo
            </span>
            <span className="ag-num mt-1 block text-[0.76rem] text-dim transition-colors group-hover:text-white/70 md:mt-1.5 md:text-[0.82rem]">
              {products.length} artículos
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}
