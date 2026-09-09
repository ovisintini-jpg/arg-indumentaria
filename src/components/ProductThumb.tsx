"use client";

import { Icon, productIcon } from "@/components/Icons";
import { Product } from "@/types";

/* La caja de la foto de producto, en un solo lugar.
   La usan la tarjeta del catálogo, el carrito, el checkout y la ficha, y antes
   cada una repetía el mismo bloque con un fondo distinto: cuando cambiaba la
   proporción o el color había que tocar cuatro archivos.

   Dos decisiones que valen para toda la tienda:
   · La proporción por defecto es 3:4 (vertical). Es la de la fotografía de
     moda —una persona parada entra; un repuesto, no— y es la que usan
     Nordstrom, Zara, Adidas y prácticamente todo el rubro.
   · La foto va en `object-cover`, no `contain`: la prenda tiene que llenar la
     caja. Contain deja aire alrededor y la grilla se ve despareja. */
export default function ProductThumb({
  product,
  ratio = "3/4",
  className = "",
  sizes,
}: {
  product: Product;
  ratio?: string;
  className?: string;
  sizes?: string;
}) {
  const foto = product.image ?? product.images?.[0];

  return (
    <div
      className={`relative overflow-hidden bg-raise ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {foto ? (
        <img
          src={foto}
          alt={product.title}
          sizes={sizes}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-linehi">
          <Icon name={productIcon(product)} size="42%" />
        </span>
      )}
    </div>
  );
}
