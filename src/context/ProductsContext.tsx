"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  supabase, productFromDB, productToDB, supabaseConfigurado,
  sinExtras, faltaColumnaExtra,
} from "@/lib/supabase";
import { Product } from "@/types";
import { products as CATALOGO_DE_ARRANQUE } from "@/data/products";

interface ProductsContextValue {
  products:      Product[];
  loading:       boolean;
  addProduct:    (data: Omit<Product, "id">) => Promise<void>;
  updateProduct: (product: Product)          => Promise<void>;
  deleteProduct: (id: string)                => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

// `initialProducts` lo manda app/layout.tsx, que es de servidor: son los
// mismos repuestos, ya leídos, para que el HTML salga con la grilla puesta
// en vez de vacía. Ver src/lib/catalogo-servidor.ts para el porqué largo.
// Si no viene nada, todo funciona igual que antes.
export function ProductsProvider({
  children,
  initialProducts = [],
}: {
  children: ReactNode;
  initialProducts?: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  // Con semilla no hay nada que esperar: arrancar en `true` mostraría el
  // esqueleto gris arriba de datos que ya están.
  const [loading, setLoading]   = useState(initialProducts.length === 0);

  const fetchProducts = async () => {
    // Sin credenciales: mostramos el catálogo de arranque de src/data/products.ts
    // para poder ver la tienda antes de conectar la base.
    if (!supabaseConfigurado) {
      setProducts(CATALOGO_DE_ARRANQUE);
      setLoading(false);
      return;
    }

    try {
      // cost_price excluido del fetch público — solo admins lo necesitan
      // y lo leen directamente en el panel admin con su propia query
      const BASE =
        "id, title, price, icon, image, images, category_id, subcategory, " +
        "description, stock, is_new, is_exclusive, is_outlet, created_at, updated_at";

      // brand y sku son opcionales: si todavía no corriste el parche de columnas
      // la primera consulta falla y reintentamos sin esas columnas.
      let rows: Record<string, unknown>[] | null = null;

      // Las piezas a pedido (visibilidad = 'privado') no van en la tienda.
      // Para un visitante las esconde la RLS, pero un admin logueado las
      // vería: el filtro es para él. Si el parche de piezas a pedido no está
      // corrido, la columna no existe y caemos al intento de abajo.
      const conPiezas = await supabase
        .from("products")
        .select(`${BASE}, brand, sku, visibilidad, slug`)
        .eq("visibilidad", "catalogo")
        .order("created_at", { ascending: false });

      if (!conPiezas.error && conPiezas.data) {
        setProducts((conPiezas.data as unknown as Record<string, unknown>[]).map(productFromDB));
        setLoading(false);
        return;
      }

      const conExtras = await supabase
        .from("products")
        .select(`${BASE}, brand, sku`)
        .order("created_at", { ascending: false });

      if (conExtras.error) {
        const base = await supabase
          .from("products")
          .select(BASE)
          .order("created_at", { ascending: false });
        if (!base.error && base.data) rows = base.data as unknown as Record<string, unknown>[];
      } else if (conExtras.data) {
        rows = conExtras.data as unknown as Record<string, unknown>[];
      }

      if (rows) setProducts(rows.map(productFromDB));
    } catch (err) {
      console.error("[ProductsContext] fetchProducts error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Safety net: si fetchProducts tarda más de 8s, desbloquear la UI igual
    const timeout = setTimeout(() => setLoading(false), 8000);

    fetchProducts().finally(() => clearTimeout(timeout));

    // Real-time: sincronización multi-pestaña (opcional, no bloquea carga)
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      if (supabaseConfigurado) channel = supabase
        .channel("products-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, fetchProducts)
        .subscribe();
    } catch (err) {
      console.warn("[ProductsContext] realtime subscription failed:", err);
    }

    return () => {
      clearTimeout(timeout);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const addProduct = async (data: Omit<Product, "id">) => {
    const payload = productToDB(data);

    let { data: inserted, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    // Sin supabase/parches/columnas-faltantes.sql, esas dos columnas no existen
    if (error && faltaColumnaExtra(error.message)) {
      ({ data: inserted, error } = await supabase
        .from("products")
        .insert(sinExtras(payload))
        .select()
        .single());
    }

    if (error) {
      if (error.code === "42501" || error.message.includes("policy")) {
        throw new Error("Sin permisos. Verificá que tu usuario esté registrado como admin en Supabase.");
      }
      throw new Error(error.message);
    }

    setProducts((prev) => [productFromDB(inserted), ...prev]);
  };

  const updateProduct = async (product: Product) => {
    const payload = productToDB(product);

    let { data: updated, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", product.id)
      .select()
      .single();

    if (error && faltaColumnaExtra(error.message)) {
      ({ data: updated, error } = await supabase
        .from("products")
        .update(sinExtras(payload))
        .eq("id", product.id)
        .select()
        .single());
    }

    if (error) {
      if (error.code === "42501" || error.message.includes("policy")) {
        throw new Error("Sin permisos. Verificá que tu usuario esté registrado como admin en Supabase.");
      }
      throw new Error(error.message);
    }

    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? productFromDB(updated) : p))
    );
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      if (error.code === "42501" || error.message.includes("policy")) {
        throw new Error("Sin permisos. Verificá que tu usuario esté registrado como admin en Supabase.");
      }
      throw new Error(error.message);
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <ProductsContext.Provider value={{ products, loading, addProduct, updateProduct, deleteProduct }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts(): ProductsContextValue {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts debe usarse dentro de ProductsProvider");
  return ctx;
}
