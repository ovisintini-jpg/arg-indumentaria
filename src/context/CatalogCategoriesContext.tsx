"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { Category, Especial } from "@/types";
import { categories as RUBROS_DE_ARRANQUE, especiales as DESTACADOS_DE_ARRANQUE } from "@/data/categories";

interface CatalogCategoriesState {
  categories:     Category[];
  especiales:     Especial[];
  loading:        boolean;
  refreshCatalog: () => void;
}

const CatalogCategoriesContext = createContext<CatalogCategoriesState>({
  categories:     [],
  especiales:     [],
  loading:        true,
  refreshCatalog: () => {},
});

// Igual que en ProductsProvider: la semilla viene del servidor para que los
// rubros estén en el HTML y no aparezcan recién después de hidratar.
export function CatalogCategoriesProvider({
  children,
  initialCategories = [],
  initialEspeciales = [],
}: {
  children: ReactNode;
  initialCategories?: Category[];
  initialEspeciales?: Especial[];
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [especiales, setEspeciales] = useState<Especial[]>(initialEspeciales);
  const [loading,    setLoading]    = useState(initialCategories.length === 0);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);

    // Sin credenciales: rubros de arranque de src/data/categories.ts
    if (!supabaseConfigurado) {
      setCategories(RUBROS_DE_ARRANQUE);
      setEspeciales(DESTACADOS_DE_ARRANQUE);
      setLoading(false);
      return;
    }

    const [{ data: cats }, { data: esps }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, sort_order, subcategories(name, sort_order)")
        .order("sort_order"),
      supabase
        .from("especiales")
        .select("id, name, sort_order")
        .order("sort_order"),
    ]);

    if (cats) {
      setCategories(
        cats.map((c: { id: string; name: string; subcategories: { name: string; sort_order: number }[] }) => ({
          id:            c.id,
          name:          c.name,
          subCategories: (c.subcategories ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => s.name),
        }))
      );
    }

    if (esps) {
      setEspeciales(
        esps.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  return (
    <CatalogCategoriesContext.Provider value={{
      categories,
      especiales,
      loading,
      refreshCatalog: fetchCatalog,
    }}>
      {children}
    </CatalogCategoriesContext.Provider>
  );
}

export const useCatalogCategories = () => useContext(CatalogCategoriesContext);
