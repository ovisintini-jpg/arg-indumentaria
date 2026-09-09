// src/app/pedido-especial/[token]/page.tsx
//
// La página privada de una pieza a pedido. Se llega SOLO por el link con
// token que le mandamos al cliente; no está en el catálogo, no está en el
// sitemap y acá abajo se le pide a los buscadores que no la indexen.
//
// Este archivo es de servidor a propósito: es el único lugar desde donde se
// puede exportar metadata. La pantalla en sí vive en _pieza-view.tsx, que es
// cliente porque necesita el carrito.
//
// Next 16: params es una Promise y hay que await-earla (ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md).

import type { Metadata } from "next";
import PiezaView from "../_pieza-view";

export const metadata: Metadata = {
  // La marca la agrega el `title.template` de app/layout.tsx.
  title: "Tu cotización",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PiezaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PiezaView token={token} />;
}
