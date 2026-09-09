import SectionHead from "@/components/SectionHead";

/* Ajustá esta lista a las marcas con las que trabajás de verdad.
   Van sólo los nombres: un logotipo ajeno mal recortado ensucia más de lo que
   suma, y además hay que tener permiso para usarlo. */
const MARCAS = [
  "Levi's", "Nike", "Adidas", "Vans",
  "Wrangler", "Topper", "Bensimon", "Cheeky",
  "Mimo & Co", "Prüne", "Caro Cuore", "Jansport",
];

export default function Brands() {
  return (
    <section
      id="marcas"
      className="mx-auto w-full max-w-[1320px] scroll-mt-[124px] px-4 py-12 md:scroll-mt-24 md:px-6 md:py-20 lg:px-14"
    >
      <SectionHead eyebrow="Marcas" title="Las marcas que vas a encontrar" />

      <div className="flex flex-wrap gap-px border border-line bg-line">
        {MARCAS.map((m) => (
          <span
            key={m}
            className="flex-1 basis-[125px] bg-ink px-3 py-6 text-center font-display text-[0.95rem] font-bold uppercase tracking-[0.02em] text-mute transition-colors hover:bg-chalk hover:text-white md:basis-[150px] md:px-3.5 md:py-8 md:text-[1.05rem]"
          >
            {m}
          </span>
        ))}
      </div>
    </section>
  );
}
