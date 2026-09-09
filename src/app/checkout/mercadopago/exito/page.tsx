import { Suspense } from "react";
import EstadoPedido from "../_estado-pedido";

// useSearchParams() (adentro de EstadoPedido) exige un límite de Suspense en
// App Router — si no, "next build" corta con "useSearchParams() should be
// wrapped in a suspense boundary".
export default function ExitoMercadoPagoPage() {
  return (
    <Suspense fallback={null}>
      <EstadoPedido intent="exito" />
    </Suspense>
  );
}
