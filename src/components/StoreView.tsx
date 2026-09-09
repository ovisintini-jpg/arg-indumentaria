"use client";

import { useCategory } from "@/context/CategoryContext";
import Hero from "@/components/Hero";
import Beneficios from "@/components/Beneficios";
import CategoryTiles from "@/components/CategoryTiles";
import ProductGrid from "@/components/ProductGrid";
import ProductCatalog from "@/components/ProductCatalog";
import GuiaTalles from "@/components/GuiaTalles";
import BandaImagen from "@/components/BandaImagen";
import Resenas from "@/components/Resenas";
import Brands from "@/components/Brands";
import SectionHead from "@/components/SectionHead";

/* El orden de la home, y el porqué de cada bloque:

   hero        → una campaña, dos departamentos y los atajos. Lo primero.
   beneficios  → envío, cambios, talles y pago: las cuatro dudas de siempre.
   categorías  → el catálogo entero, ordenado por persona.
   temporada   → la campaña grande.
   destacados  → producto de verdad, con precio: hasta acá era todo promesa.
   guía talles → la que evita la mitad de las devoluciones.
   outlet      → la banda de oferta, para el que baja buscando precio.
   reseñas     → prueba social antes de cerrar.
   marcas      → qué marcas se venden. Cierra la página.

   Cuando hay búsqueda activa o una categoría elegida desde el buscador, todo
   esto se reemplaza por el catálogo filtrado. */
export default function StoreView() {
  const { categoryId, searchQuery } = useCategory();

  if (categoryId !== null || searchQuery.trim() !== "") {
    return <ProductCatalog />;
  }

  return (
    <>
      <Hero />
      <Beneficios />
      <CategoryTiles />
      <BandaImagen ranura="temporada" />

      <section className="mx-auto w-full max-w-[1320px] px-4 py-12 md:px-6 md:py-20 lg:px-14">
        <SectionHead
          eyebrow="Lo más buscado"
          title="Destacados de la semana"
        />
        <ProductGrid />
      </section>

      <GuiaTalles />
      <BandaImagen ranura="editorial" />
      <Resenas />
      <BandaImagen ranura="cierre" />
      <Brands />
    </>
  );
}
