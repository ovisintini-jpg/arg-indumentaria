"use client";

interface LegalModalProps {
  isOpen:  boolean;
  onClose: () => void;
}

// Resalta los tramos [REEMPLAZAR: ...] para que sean imposibles de
// pasar por alto antes de publicar el sitio.
function renderWithPlaceholders(text: string) {
  const parts = text.split(/(\[REMPLAZAR:[^\]]+\])/g);
  return parts.map((part, i) =>
    part.startsWith("[REMPLAZAR:") ? (
      <span
        key={i}
        className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-1.5 py-0.5 font-black"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface Section {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface Part {
  label: string;
  sections: Section[];
}

const PARTS: Part[] = [
  {
    label: "Parte I \u2014 Disposiciones Generales y Acceso",
    sections: [
      {
        title: "1. Identificaci\u00f3n del Titular",
        paragraphs: [
          "Este sitio web es operado bajo la marca comercial ARG Indumentaria por [REMPLAZAR: Raz\u00f3n Social de la empresa o Nombre Completo del Titular] (en adelante, \"El Vendedor\"), con Clave \u00danica de Identificaci\u00f3n Tributaria (CUIT) N\u00b0 [REMPLAZAR: Tu CUIT], con domicilio legal constituido en [REMPLAZAR: Tu Direcci\u00f3n, Localidad, Provincia], Rep\u00fablica Argentina, y correo electr\u00f3nico de contacto oficial [REMPLAZAR: Correo de soporte].",
        ],
      },
      {
        title: "2. Aceptaci\u00f3n de los T\u00e9rminos y Modificaciones",
        paragraphs: [
          "Las Personas Usuarias aceptan estos T\u00e9rminos y Condiciones de manera vinculante al navegar por el sitio, registrar una cuenta o iniciar un proceso de compra en ARG Indumentaria. Los cambios en las condiciones operativas o tarifas de env\u00edo ser\u00e1n informados con diez (10) d\u00edas corridos de anticipaci\u00f3n en la plataforma para su revisi\u00f3n. Las Personas Usuarias podr\u00e1n finalizar la relaci\u00f3n cancelando su cuenta en cualquier momento, lo cual no extinguir\u00e1 las obligaciones o deudas pendientes generadas previamente con El Vendedor.",
        ],
      },
      {
        title: "3. Capacidad Legal para Contratar",
        paragraphs: [
          "Podr\u00e1n usar nuestros servicios y realizar compras las personas mayores de edad que tengan capacidad legal para contratar seg\u00fan el C\u00f3digo Civil y Comercial de la Naci\u00f3n. Los pedidos realizados a nombre de una empresa, un comercio, una institución o cualquier persona jurídica deber\u00e1n ser cursados por quien acredite facultades suficientes para obligarla.",
        ],
      },
      {
        title: "4. Registro y Seguridad de la Cuenta",
        paragraphs: [
          "Para procesar compras, el sitio puede requerir completar un formulario de registro de manera exacta, precisa y verdadera. La cuenta en ARG Indumentaria es personal, \u00fanica e intransferible. El acceso se realiza mediante una contrase\u00f1a confidencial bajo la exclusiva responsabilidad de la Persona Usuaria. Ante cualquier sospecha de uso no autorizado, deber\u00e1 notificarse inmediatamente a El Vendedor, que se reserva el derecho de rechazar solicitudes de registro o cancelar cuentas activas ante incumplimientos, fraudes o motivos fundados de riesgo t\u00e9cnico o legal.",
        ],
      },
    ],
  },
  {
    label: "Parte II \u2014 Catálogo, Talles y Composición",
    sections: [
      {
        title: "5. Naturaleza del Catálogo, Fotos y Colores",
        paragraphs: [
          "El catálogo publica, para cada artículo, su descripción, la composición textil declarada por el fabricante, los talles disponibles y los colores en que se ofrece. Esa información se toma de la ficha técnica del proveedor y se reproduce de buena fe.",
          "Las fotografías son ilustrativas. El color que se ve en pantalla depende del monitor, del navegador y de la iluminación con que se tomó la foto, por lo que puede haber diferencias razonables de tono respecto de la prenda física. Una diferencia de tono no constituye por sí sola un defecto, sin perjuicio del derecho de revocación previsto en la cláusula 11.",
          "El fabricante puede introducir cambios menores de diseño, avíos o etiquetado sin previo aviso, manteniendo el modelo, la composición y el talle informados.",
        ],
      },
      {
        title: "6. Talles y Guía de Medidas",
        paragraphs: [
          "La numeración de talles no está unificada entre marcas: un mismo talle puede calzar distinto según el fabricante, la línea y el país de origen de la prenda. Por eso cada ficha publica las medidas reales en centímetros, y el sitio pone a disposición una guía de talles con las equivalencias en la que la Persona Usuaria puede cotejar sus propias medidas antes de comprar.",
        ],
        bullets: [
          "El Vendedor pone a disposición sus canales de atención para asesorar sobre el talle antes de la compra. Ese asesoramiento es orientativo y no reemplaza la verificación de las medidas publicadas en la ficha.",
          "Si la prenda recibida no corresponde al talle, el color o el modelo informados por error de El Vendedor, corresponde el cambio o la devolución sin cargo alguno para el Consumidor, incluidos los costos de envío de ida y de vuelta.",
          "Si el talle elegido simplemente no le queda bien al Consumidor, el cambio se rige por la cláusula 12 y por el derecho de revocación de la cláusula 11, que no exige expresar causa alguna.",
        ],
      },
      {
        title: "7. Marcas, Composición y Cuidado de las Prendas",
        paragraphs: [
          "El catálogo puede incluir prendas de marcas de terceros, prendas de marca propia y artículos de temporada pasada identificados como tales. La composición textil, el país de origen y las instrucciones de lavado y planchado se declaran en la etiqueta de cada prenda conforme a la normativa vigente de identificación de productos textiles, y se reproducen en la ficha del producto cuando el fabricante los informa.",
          "Los artículos publicados en la sección Outlet corresponden a temporadas anteriores o a fin de serie. Se venden nuevos y sin uso, con la misma garantía legal que el resto del catálogo, y la disponibilidad se limita a los talles y colores en existencia.",
        ],
      },
    ],
  },
  {
    label: "Parte III \u2014 Condiciones Comerciales, Precios y Pagos",
    sections: [
      {
        title: "8. Tarifas, Precios y Facturaci\u00f3n",
        paragraphs: [
          "Los precios publicados en ARG Indumentaria est\u00e1n expresados en pesos argentinos ($ ARS) e incluyen el Impuesto al Valor Agregado (IVA) para Consumidor Final. Los costos de env\u00edo no est\u00e1n incluidos en el precio base del producto y se calculan de manera transparente y desagregada antes de que la Persona Usuaria confirme la transacci\u00f3n. Las facturas legales correspondientes (A o B) se emiten de conformidad con los datos fiscales provistos por el comprador.",
        ],
      },
      {
        title: "9. Medios de Pago y Financiaci\u00f3n",
        paragraphs: [
          "Las compras podr\u00e1n ser abonadas a trav\u00e9s de los medios de pago autorizados en la plataforma (tarjetas de cr\u00e9dito, d\u00e9bito, transferencias bancarias o pasarelas de pago electr\u00f3nico integradas).",
        ],
        bullets: [
          "Protecci\u00f3n Financiera: por razones de estricta seguridad, El Vendedor no almacena ni registra los datos de las tarjetas de cr\u00e9dito o d\u00e9bito de las Personas Usuarias. El procesamiento se realiza de forma encriptada a trav\u00e9s de pasarelas homologadas bajo est\u00e1ndares internacionales de seguridad (PCI-DSS).",
          "Intereses y Costos Financieros: cualquier cargo, inter\u00e9s o Costo Financiero Total (CFT) por compras en cuotas depende exclusivamente de la entidad emisora de la tarjeta o de la pasarela utilizada, y ser\u00e1 informado detalladamente al Consumidor previo al pago de conformidad con el Art. 4 de la Ley N\u00b0 24.240.",
          "Validaci\u00f3n de Transacciones: para prevenci\u00f3n de fraudes, El Vendedor se reserva la facultad de verificar la identidad del comprador previo al despacho de los productos.",
        ],
      },
      {
        title: "10. Stock, Pedidos por Encargo e Importación a Pedido",
        paragraphs: [
          "Las órdenes de compra están sujetas a la disponibilidad de stock físico por talle y color: que un modelo figure publicado no implica que todos sus talles estén disponibles. Determinados artículos se comercializan por encargo, lo que implica que El Vendedor los adquiere o importa especialmente para el Consumidor una vez aceptado el presupuesto. En esos casos, antes de confirmar la operación se informan por escrito el modelo, el talle, el color, el precio final y el plazo estimado de arribo.",
          "Se deja expresa constancia de que la modalidad de pedido por encargo no restringe ni condiciona el derecho de revocación previsto en la cláusula 11: los artículos comercializados son productos de catálogo de fabricación seriada y no prendas confeccionadas a medida conforme a especificaciones particulares del Consumidor, por lo que no se encuentran alcanzadas por las excepciones del artículo 1116 del Código Civil y Comercial de la Nación.",
          "Los plazos de entrega indicados son estimativos. Al recibir el paquete, el Consumidor debe verificar el estado exterior del embalaje antes de suscribir la recepción y dejar constancia de cualquier daño visible ante el transportista.",
        ],
        bullets: [
          "Confirmación previa: para evitar errores en los artículos que se traen especialmente, El Vendedor solicita al Consumidor la confirmación por escrito del modelo, el talle y el color antes de cursar el pedido al proveedor.",
          "Ventana de cancelación sin cargo: dentro de las veinticuatro (24) horas posteriores a la aceptación del presupuesto, y siempre que el pedido no haya sido aún cursado al proveedor, el Consumidor puede cancelar la operación con reintegro íntegro e inmediato del importe abonado.",
          "Señas y anticipos: los importes entregados en concepto de seña, reserva o anticipo se imputan al precio final de la operación y son reintegrables en su totalidad en todos los supuestos de revocación, cancelación por imposibilidad de conseguir el artículo o incumplimiento de los plazos informados.",
          "Imposibilidad de abastecimiento: si el artículo no pudiera conseguirse en el talle o el color pedidos, o su precio variara respecto del presupuestado, El Vendedor lo informará antes de avanzar y el Consumidor podrá aceptar la nueva condición o dejar sin efecto la compra con reintegro total.",
          "Reserva de talle: la reserva de un talle sin seña se mantiene por el plazo informado al Consumidor y vence automáticamente cumplido ese plazo, sin generar cargo alguno.",
        ],
      },
    ],
  },
  {
    label: "Parte IV \u2014 Devoluciones, Garant\u00edas y Responsabilidad",
    sections: [
      {
        title: "11. Derecho de Revocaci\u00f3n de la Aceptaci\u00f3n (Bot\u00f3n de Arrepentimiento)",
        paragraphs: [
          "En cumplimiento estricto del art\u00edculo 34 de la Ley N\u00b0 24.240 y la Resoluci\u00f3n 424/2020 de la Secretar\u00eda de Comercio Interior, el Consumidor tiene el derecho de revocar la aceptaci\u00f3n de la compra dentro de los diez (10) d\u00edas corridos contados a partir de la fecha de entrega del producto o de la celebraci\u00f3n del contrato, lo que ocurra \u00faltimo, sin penalidad alguna.",
        ],
        bullets: [
          "A tales efectos, el sitio web cuenta con un enlace visible y de acceso directo denominado \"Bot\u00f3n de Arrepentimiento\" en su p\u00e1gina de inicio, disponible en /arrepentimiento. Su uso no requiere registraci\u00f3n previa ni ning\u00fan tr\u00e1mite adicional.",
          "Recibida la solicitud, El Vendedor informa al Consumidor, por el mismo medio y dentro de las veinticuatro (24) horas, el c\u00f3digo de identificaci\u00f3n del tr\u00e1mite de arrepentimiento.",
          "El ejercicio de este derecho no exige expresar causa alguna ni habilita a El Vendedor a aplicar penalidad, cargo administrativo, retenci\u00f3n de se\u00f1a ni descuento de ninguna naturaleza sobre el importe abonado.",
          "La prenda deberá ser devuelta sin uso, sin lavar y con sus embalajes, precintos y etiquetas originales en perfectas condiciones.",
          "Los gastos de devoluci\u00f3n y retiro del producto corren en su totalidad por cuenta de El Vendedor. El Consumidor únicamente debe poner el producto a su disposición.",
          "El reintegro se realiza por el mismo medio de pago utilizado en la compra, sin costo para el Consumidor.",
        ],
      },
      {
        title: "12. Cambios de Talle y Condiciones Particulares de Devolución",
        paragraphs: [
          "Además del derecho de revocación de la cláusula 11, que se ejerce sin expresar causa dentro de los diez (10) días corridos, El Vendedor ofrece el cambio de talle o de color de cualquier prenda dentro de los treinta (30) días corridos desde la entrega, sujeto a disponibilidad de stock. El primer cambio no tiene costo de envío para el Consumidor.",
          "Para que proceda el cambio, la prenda debe estar sin uso, sin lavar, sin perfumar y con sus etiquetas y precintos originales colocados. Probarse la prenda no es usarla: lo que se pide es que vuelva en las mismas condiciones en que se entregó.",
          "Por razones de higiene, y sin que ello afecte la garantía legal por defectos de fabricación prevista en la cláusula 13 ni el derecho de revocación de la cláusula 11 cuando el producto se devuelve cerrado y sin abrir, no se aceptan cambios por talle de:",
        ],
        bullets: [
          "Ropa interior, lencería, bombachas, calzoncillos y bodies de bebé cuya etiqueta o precinto sanitario haya sido retirado.",
          "Trajes de baño y mallas a los que se les haya quitado la película protectora de higiene.",
          "Medias y pantimedias cuyo envase original haya sido abierto.",
          "Aros y accesorios de contacto directo con la piel perforada.",
          "Prendas con signos de uso, lavado, manchas, perfume, desodorante, maquillaje, olor a cigarrillo o pelo de mascota, o a las que se les hayan hecho arreglos, dobladillos o modificaciones de cualquier tipo.",
        ],
      },
      {
        title: "13. Garantía Legal por Defectos de Confección",
        paragraphs: [
          "De conformidad con el artículo 11 de la Ley N° 24.240, las prendas y el calzado nuevos comercializados en este sitio gozan de una garantía legal de seis (6) meses ante defectos o vicios de fabricación. Cuando el fabricante ofrezca una garantía comercial de mayor plazo o alcance, la misma se declara en la ficha del producto y se adiciona a la garantía legal. Los gastos de traslado del producto para el trámite de garantía corren por cuenta de El Vendedor.",
          "Para tramitar una garantía alcanza con la factura o el número de pedido. La prenda debe presentarse limpia, condición que hace posible revisar el defecto denunciado.",
        ],
        bullets: [
          "Quedan cubiertas las costuras que se abren sin esfuerzo, los cierres, botones y avíos que fallan, los desprendimientos de suela o de taco, las diferencias de talle respecto de las medidas publicadas y las prendas que destiñen o encogen habiéndose respetado las instrucciones de lavado de la etiqueta.",
          "No quedan cubiertos los daños derivados del uso indebido, del lavado o planchado en condiciones distintas de las indicadas en la etiqueta, del secado en secarropas cuando la etiqueta lo desaconseja, de arreglos hechos por terceros, de enganches, cortes, quemaduras o manchas producidas después de la entrega.",
          "El desgaste normal por el uso —el desgaste de la suela, el pilling de las lanas, el desteñido progresivo del denim, la pérdida de elasticidad de los puños— no constituye un defecto de fabricación.",
        ],
      },
      {
        title: "14. Cuidado de las Prendas y Limitación de Responsabilidad",
        paragraphs: [
          "El Vendedor comercializa indumentaria y calzado, y no presta servicios de arreglo, ajuste, teñido ni lavado. Se recomienda seguir las instrucciones de lavado, secado y planchado de la etiqueta de cada prenda, que son las que el fabricante declara para conservar el color, la forma y la fibra.",
          "En la medida permitida por la legislación vigente, y sin afectar los derechos irrenunciables reconocidos al Consumidor por la Ley N° 24.240, El Vendedor no responde por los daños derivados de arreglos o modificaciones hechos por terceros, ni por el deterioro producido por un lavado en condiciones distintas de las indicadas en la etiqueta.",
        ],
      },
    ],
  },
  {
    label: "Parte V \u2014 Propiedad Intelectual, Restricciones y Jurisdicci\u00f3n",
    sections: [
      {
        title: "15. Propiedad Intelectual y Marcas de Terceros",
        paragraphs: [
          "El Vendedor es propietario o licenciatario autorizado de todos los derechos de propiedad intelectual sobre el sitio web, su c\u00f3digo fuente, el nombre comercial, el isotipo y el logotipo de ARG Indumentaria, as\u00ed como im\u00e1genes propias, dise\u00f1os de la interfaz, textos descriptivos y bases de datos. Queda estrictamente prohibida su reproducci\u00f3n, uso o explotaci\u00f3n comercial sin autorizaci\u00f3n expresa.",
          "Las marcas, logotipos y nombres comerciales de los fabricantes de indumentaria y calzado pertenecen a sus respectivos titulares y se mencionan exclusivamente con fines descriptivos e informativos, para identificar el origen de un artículo del catálogo. Su mención no implica vinculación, patrocinio, representación oficial ni afiliación alguna con dichos titulares, salvo que se declare expresamente en la ficha del producto.",
        ],
      },
      {
        title: "16. Uso Automatizado Prohibido del Sitio",
        paragraphs: [
          "Queda terminantemente prohibido el uso de sistemas automatizados (como bots, spiders, scrapers o crawlers) para acceder, indexar, extraer de manera sistem\u00e1tica, copiar o reutilizar el catálogo de productos, las tablas de talles, las listas de precios, las im\u00e1genes, los textos o los datos personales alojados en ARG Indumentaria sin autorizaci\u00f3n por escrito. El incumplimiento facultar\u00e1 a El Vendedor a dar de baja de forma inmediata la cuenta de la Persona Usuaria y ejercer las acciones t\u00e9cnico-legales pertinentes.",
        ],
      },
      {
        title: "17. Jurisdicci\u00f3n y Ley Aplicable",
        paragraphs: [
          "Estos T\u00e9rminos y Condiciones se rigen por las leyes vigentes de la Rep\u00fablica Argentina. Cualquier controversia o reclamo derivado del uso del sitio o de las transacciones comerciales ser\u00e1 resuelto ante los tribunales nacionales ordinarios competentes en materia de consumo correspondientes al domicilio del Consumidor.",
        ],
      },
    ],
  },
];

export default function LegalModal({ isOpen, onClose }: LegalModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60]" onClick={onClose} />

      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 pointer-events-none">
        <div className="w-full max-w-4xl max-h-[88dvh] bg-[#101317] border border-acento/20 rounded-2xl shadow-[0_0_80px_rgba(22,104,214,0.08)] pointer-events-auto flex flex-col overflow-hidden">

          {/* Cabecera */}
          <div className="flex items-start justify-between gap-4 px-8 md:px-12 py-7 border-b border-line shrink-0">
            <div>
              <p
                className="text-xs font-bold tracking-[0.3em] uppercase text-[#3D8BF0]/60 mb-2"
                style={{ fontFamily: "var(--font-archivo), sans-serif" }}
              >
                Legales
              </p>
              <h2
                className="text-xl md:text-2xl font-black tracking-wide text-white uppercase leading-snug"
                style={{ fontFamily: "var(--font-archivo), sans-serif" }}
              >
                Términos y Condiciones de Uso y Venta
              </h2>
              <p className="text-sm text-mute mt-1">
                ARG Indumentaria · Argentina
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 w-10 h-10 flex items-center justify-center border border-line hover:border-acento/50 text-mute hover:text-acentohi rounded-lg transition-all text-lg font-black"
            >
              ✕
            </button>
          </div>

          {/* Contenido — texto grande, mucho aire, para que se lea sin esfuerzo */}
          <div className="overflow-y-auto flex-1 px-8 md:px-12 py-8">
            <p className="text-[19px] leading-relaxed text-gray-300 mb-8 pb-8 border-b border-line">
              El presente documento constituye el contrato marco legal, básico y obligatorio que regula el acceso,
              navegación y transacciones comerciales de bienes tangibles realizadas en este sitio web, de plena
              conformidad con la <strong className="text-white">Ley de Defensa del Consumidor (N° 24.240)</strong>,
              el <strong className="text-white">Código Civil y Comercial de la Nación</strong>, la{" "}
              <strong className="text-white">Ley de Protección de Datos Personales (N° 25.326)</strong> y las
              normativas vigentes de la Secretaría de Comercio de la República Argentina.
            </p>

            <div className="flex flex-col gap-10">
              {PARTS.map((part) => (
                <div key={part.label}>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-1 h-5 bg-acento rounded-sm shrink-0" />
                    <h3
                      className="text-[16px] md:text-[17px] font-black tracking-widest text-white uppercase"
                      style={{ fontFamily: "var(--font-archivo), sans-serif" }}
                    >
                      {part.label}
                    </h3>
                  </div>

                  <div className="flex flex-col gap-7 pl-4">
                    {part.sections.map((s) => (
                      <section key={s.title}>
                        <h4
                          className="text-[18px] font-black tracking-widest text-[#3D8BF0] uppercase mb-3"
                          style={{ fontFamily: "var(--font-archivo), sans-serif" }}
                        >
                          {s.title}
                        </h4>
                        {s.paragraphs.map((para, i) => (
                          <p key={i} className="text-[19px] leading-relaxed text-gray-300 mb-3 last:mb-0">
                            {renderWithPlaceholders(para)}
                          </p>
                        ))}
                        {s.bullets && (
                          <ul className="mt-3 flex flex-col gap-2.5">
                            {s.bullets.map((b, i) => (
                              <li key={i} className="text-[19px] leading-relaxed text-gray-300 pl-4 relative">
                                <span className="absolute left-0 top-[0.6em] w-1.5 h-1.5 rounded-full bg-acento/60" />
                                {renderWithPlaceholders(b)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[18px] leading-relaxed text-mute mt-10 pt-8 border-t border-line">
              En cumplimiento de las normativas de la República Argentina, se informa el enlace de acceso directo
              al portal de reclamos de la Dirección Nacional de Defensa del Consumidor:{" "}
              <a
                href="https://autogestion.produccion.gob.ar/consumidores"
                target="_blank"
                rel="noopener noreferrer"
                className="text-acentohi hover:text-acentohi underline"
              >
                autogestion.produccion.gob.ar/consumidores
              </a>
            </p>
          </div>

          {/* Footer */}
          <div className="px-8 md:px-12 py-5 border-t border-line shrink-0 flex justify-end">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-acento hover:bg-acentohi text-[17px] font-black tracking-widest text-[#0A0B0D] rounded-lg transition-all uppercase shadow-[0_0_20px_rgba(22,104,214,0.2)]"
            >
              Entendido
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
