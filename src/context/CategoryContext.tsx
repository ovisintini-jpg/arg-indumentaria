"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CategoryState {
  categoryId:   string | null;
  subcategory:  string | null;
  label:        string;
  searchQuery:  string;
  setCategory:  (id: string | null, sub?: string | null, label?: string) => void;
  setSearchQuery: (q: string) => void;
}

const CategoryContext = createContext<CategoryState>({
  categoryId:     null,
  subcategory:    null,
  label:          "HOME",
  searchQuery:    "",
  setCategory:    () => {},
  setSearchQuery: () => {},
});

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categoryId,  setCategoryId]  = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [label,       setLabel]       = useState("HOME");
  const [searchQuery, setSearchQueryState] = useState("");

  // Cambiar categoría limpia la búsqueda activa
  const setCategory = (
    id:  string | null,
    sub: string | null = null,
    lbl: string = "HOME"
  ) => {
    setCategoryId(id);
    setSubcategory(sub);
    setLabel(lbl);
    setSearchQueryState("");   // ← limpia búsqueda al navegar por categorías
  };

  // Buscar limpia la categoría activa (vuelve a HOME con resultados)
  const setSearchQuery = (q: string) => {
    setSearchQueryState(q);
    if (q.trim()) {
      setCategoryId(null);
      setSubcategory(null);
      setLabel("BÚSQUEDA");
    }
  };

  return (
    <CategoryContext.Provider value={{
      categoryId, subcategory, label,
      searchQuery, setCategory, setSearchQuery,
    }}>
      {children}
    </CategoryContext.Provider>
  );
}

export const useCategory = () => useContext(CategoryContext);
