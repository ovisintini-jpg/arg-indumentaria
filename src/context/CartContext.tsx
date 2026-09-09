"use client";

import { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import { CartItem, Product, lineIdDe, variantKey } from "@/types";

/* ───────────────────────────────────────────────────────────────────────────
   EL CARRITO, CON TALLE Y COLOR

   La diferencia con la versión de autopartes: un producto ya no es un renglón.
   Dos remeras iguales en talle S y talle L son DOS renglones distintos, con su
   propio stock y su propia cantidad. Por eso todo se identifica por `lineId`
   (producto + talle + color) y no por el id del producto.

   El tope de cada renglón es el stock de ESA variante cuando el producto trae
   el detalle cargado (`stock_variantes`), y el stock general del producto
   cuando no lo trae. Así una tienda que todavía no cargó el detalle sigue
   funcionando igual que antes.
   ─────────────────────────────────────────────────────────────────────────── */

/** Stock disponible de una variante concreta. Si el producto no tiene el
 *  detalle cargado, vale el stock general. */
export function stockDeVariante(
  product: Product,
  size?: string,
  color?: string,
): number {
  const detalle = product.stock_variantes;
  if (detalle && Object.keys(detalle).length > 0) {
    const v = detalle[variantKey(size, color)];
    return typeof v === "number" ? v : 0;
  }
  return product.stock ?? 0;
}

/** ¿Este producto obliga a elegir algo antes de agregarlo al carrito? */
export function necesitaVariante(product: Product): boolean {
  const talles = product.sizes?.length ?? 0;
  const colores = product.colors?.length ?? 0;
  return talles > 1 || colores > 1;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

const STORAGE_KEY = "argindumentaria-cart";

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as CartItem[];
    // Los carritos guardados antes de que existieran los talles no tienen
    // lineId. Se les arma uno para que no rompan al hidratar.
    return items
      .filter((i) => i && i.product)
      .map((i) => ({
        ...i,
        lineId: i.lineId ?? lineIdDe(i.product.id, i.size, i.color),
      }));
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded — silently ignore
  }
}

const initialState: CartState = {
  items: [],
  isOpen: false,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

interface AddOpts {
  size?:  string;
  color?: string;
  qty?:   number;
}

type CartAction =
  | { type: "ADD_ITEM"; product: Product; opts: AddOpts }
  | { type: "REMOVE_ITEM"; lineId: string }
  | { type: "INCREMENT"; lineId: string }
  | { type: "DECREMENT"; lineId: string }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] }
  | { type: "TOGGLE_PANEL" }
  | { type: "OPEN_PANEL" }
  | { type: "CLOSE_PANEL" };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, items: action.items };

    case "ADD_ITEM": {
      const { product, opts } = action;
      const size  = opts.size  ?? product.sizes?.[0];
      const color = opts.color ?? product.colors?.[0]?.name;
      const qty   = Math.max(1, opts.qty ?? 1);
      const lineId = lineIdDe(product.id, size, color);
      const tope = stockDeVariante(product, size, color);

      if (tope <= 0) return state; // sin stock en esa variante

      const existente = state.items.find((i) => i.lineId === lineId);
      if (existente) {
        if (existente.quantity >= tope) return { ...state, isOpen: true };
        return {
          ...state,
          isOpen: true,
          items: state.items.map((i) =>
            i.lineId === lineId
              ? { ...i, quantity: Math.min(i.quantity + qty, tope) }
              : i,
          ),
        };
      }

      return {
        ...state,
        isOpen: true,
        items: [
          ...state.items,
          { product, quantity: Math.min(qty, tope), size, color, lineId },
        ],
      };
    }

    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.lineId !== action.lineId) };

    case "INCREMENT":
      return {
        ...state,
        items: state.items.map((i) =>
          i.lineId === action.lineId
            ? {
                ...i,
                quantity: Math.min(
                  i.quantity + 1,
                  stockDeVariante(i.product, i.size, i.color),
                ),
              }
            : i,
        ),
      };

    case "DECREMENT":
      return {
        ...state,
        items: state.items
          .map((i) => (i.lineId === action.lineId ? { ...i, quantity: i.quantity - 1 } : i))
          .filter((i) => i.quantity > 0),
      };

    case "CLEAR":
      return { ...state, items: [] };
    case "TOGGLE_PANEL":
      return { ...state, isOpen: !state.isOpen };
    case "OPEN_PANEL":
      return { ...state, isOpen: true };
    case "CLOSE_PANEL":
      return { ...state, isOpen: false };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  totalItems: number;
  totalPrice: number;
  addItem: (product: Product, opts?: AddOpts) => void;
  removeItem: (lineId: string) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  clearCart: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Hidratación: leer localStorage solo en el cliente (post-SSR)
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved.length > 0) dispatch({ type: "HYDRATE", items: saved });
  }, []);

  // Persistencia: guardar cada vez que cambian los items
  useEffect(() => {
    saveToStorage(state.items);
  }, [state.items]);

  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const value: CartContextValue = {
    items: state.items,
    isOpen: state.isOpen,
    totalItems,
    totalPrice,
    addItem:    (product, opts = {}) => dispatch({ type: "ADD_ITEM", product, opts }),
    removeItem: (lineId) => dispatch({ type: "REMOVE_ITEM", lineId }),
    increment:  (lineId) => dispatch({ type: "INCREMENT",   lineId }),
    decrement:  (lineId) => dispatch({ type: "DECREMENT",   lineId }),
    clearCart:  ()       => dispatch({ type: "CLEAR" }),
    openPanel:  ()       => dispatch({ type: "OPEN_PANEL" }),
    closePanel: ()       => dispatch({ type: "CLOSE_PANEL" }),
    togglePanel:()       => dispatch({ type: "TOGGLE_PANEL" }),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
