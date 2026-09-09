"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { Consulta, ConsultaEstado } from "@/types";
import {
  Page, PageHead, StatRow, Stat, Btn, Field, Input, Select, StatusSelect, Badge,
  TableWrap, THead, Td, Empty, ErrorState, Loading, Confirm, Note, Msg, Tone,
  SIN_RESPUESTA, fmtARS, fmtDate,
} from "@/components/admin/ui";

const ESTADO_LABEL: Record<ConsultaEstado, string> = {
  nueva:      "Nueva",
  en_proceso: "Buscando",
  cotizada:   "Cotizada",
  cerrada:    "Cerrada",
  perdida:    "Perdida",
};

const ESTADO_TONE: Record<ConsultaEstado, Tone> = {
  nueva:      "warn",
  en_proceso: "acento",
  cotizada:   "acento",
  cerrada:    "ok",
  perdida:    "sale",
};

export default function ConsultasPage() {
  const [consultas,    setConsultas]    = useState<Consulta[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState("");
  const [search,       setSearch]       = useState("");
  const [filtro,       setFiltro]       = useState<"all" | ConsultaEstado>("all");
  const [expandida,    setExpandida]    = useState<string | null>(null);
  const [borrar,       setBorrar]       = useState<Consulta | null>(null);

  // Respuesta que está editando el admin
  const [precio, setPrecio] = useState("");
  const [plazo,  setPlazo]  = useState("");
  const [notas,  setNotas]  = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado,  setGuardado]  = useState("");

  const fetchConsultas = async () => {
    try {
      const { data, error } = await supabase
        .from("consultas").select("*").order("created_at", { ascending: false });
      if (error) setLoadError(error.message);
      else if (data) { setConsultas(data as Consulta[]); setLoadError(""); }
    } catch {
      setLoadError(SIN_RESPUESTA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); setLoadError(SIN_RESPUESTA); }, 10000);
    fetchConsultas().finally(() => clearTimeout(t));

    const channel = supabase
      .channel("consultas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultas" }, fetchConsultas)
      .subscribe();

    return () => { clearTimeout(t); supabase.removeChannel(channel); };
  }, []);

  const abrir = (c: Consulta) => {
    if (expandida === c.id) { setExpandida(null); return; }
    setExpandida(c.id);
    setPrecio(c.precio_cotizado ? String(c.precio_cotizado) : "");
    setPlazo(c.plazo_estimado ?? "");
    setNotas(c.notas_internas ?? "");
    setGuardado("");
  };

  const cambiarEstado = async (id: string, estado: ConsultaEstado) => {
    setConsultas((prev) => prev.map((c) => c.id === id ? { ...c, estado } : c));
    await supabase.from("consultas").update({ estado }).eq("id", id);
  };

  const guardarRespuesta = async (c: Consulta) => {
    setGuardando(true); setGuardado("");
    const cambios = {
      precio_cotizado: precio ? parseFloat(precio) : null,
      plazo_estimado:  plazo || null,
      notas_internas:  notas || null,
      // Cargar la cotización mueve el estado sola: si ya le pusiste precio,
      // la consulta está cotizada.
      estado: (precio || plazo) && c.estado === "nueva" ? "cotizada" as ConsultaEstado : c.estado,
    };
    const { error } = await supabase.from("consultas").update(cambios).eq("id", c.id);
    setGuardando(false);
    if (error) { setGuardado("error"); return; }
    setConsultas((prev) => prev.map((x) => x.id === c.id ? { ...x, ...cambios } : x));
    setGuardado("ok");
    setTimeout(() => setGuardado(""), 2500);
  };

  const eliminar = async (id: string) => {
    setConsultas((prev) => prev.filter((c) => c.id !== id));
    setBorrar(null);
    if (expandida === id) setExpandida(null);
    await supabase.from("consultas").delete().eq("id", id);
  };

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consultas.filter((c) => {
      if (filtro !== "all" && c.estado !== filtro) return false;
      if (!q) return true;
      return [
        c.numero, c.marca_buscada, c.talle_buscado, c.color_buscado,
        c.producto_buscado, c.codigo, c.nombre, c.email, c.referencia,
      ].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [consultas, search, filtro]);

  const nuevas = consultas.filter((c) => c.estado === "nueva").length;
  const abiertas = consultas.filter((c) => ["nueva", "en_proceso", "cotizada"].includes(c.estado)).length;
  const cerradas = consultas.filter((c) => c.estado === "cerrada").length;

  /* El resumen de la variante que pidió: marca, talle y color en una línea.
     Es lo que se lee de un vistazo en la tabla. */
  const varianteDe = (c: Consulta) =>
    [c.marca_buscada, c.talle_buscado && `Talle ${c.talle_buscado}`, c.color_buscado]
      .filter(Boolean).join(" · ");

  return (
    <Page>
      <PageHead
        title="Consultas"
        sub="Los pedidos de cotización que entran desde la tienda. Se actualiza sola."
      />

      <StatRow>
        <Stat label="Total"      value={consultas.length} />
        <Stat
          label="Sin responder" value={nuevas}
          hint={nuevas ? "hay gente esperando" : "todo respondido"}
          tone={nuevas ? "warn" : "mute"}
        />
        <Stat label="Abiertas"   value={abiertas} hint="en juego" tone="acento" />
        <Stat label="Cerradas"   value={cerradas} tone="ok" />
      </StatRow>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por N.º, prenda, marca, código, cliente o email…"
          className="min-w-[260px] flex-1"
        />
        <div className="w-full sm:w-52">
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="all">Todas</option>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="border border-line bg-panel"><Loading label="Cargando consultas" /></div>
      ) : loadError && consultas.length === 0 ? (
        <div className="border border-line bg-panel"><ErrorState msg={loadError} /></div>
      ) : visibles.length === 0 ? (
        <div className="border border-line bg-panel">
          <Empty
            title={consultas.length === 0 ? "Todavía no entró ninguna consulta" : "Ninguna consulta coincide"}
            sub={consultas.length === 0
              ? "Cuando alguien pida una cotización desde la tienda, va a aparecer acá al instante."
              : "Probá con otro término o cambiá el filtro."}
          />
        </div>
      ) : (
        <TableWrap>
          <THead cols={["N.º", "Marca y talle", "Prenda", "Cliente", "Fecha", "Estado", ""]} />
          <tbody>
            {visibles.map((c) => {
              const abierta = expandida === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className={`border-b border-line/70 transition-colors ${abierta ? "bg-raise" : "hover:bg-raise/50"}`}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => abrir(c)}
                          title={abierta ? "Cerrar" : "Ver la consulta"}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[0.6rem] transition-colors ${
                            abierta ? "border-acento text-acentohi" : "border-line text-dim hover:border-linehi hover:text-mute"
                          }`}
                        >
                          {abierta ? "▼" : "▶"}
                        </button>
                        <span className="ag-mono whitespace-nowrap font-semibold text-acentohi">{c.numero}</span>
                      </div>
                    </Td>

                    <Td>
                      <div className="max-w-[220px]">
                        <p className="truncate font-display text-[0.9rem] font-extrabold uppercase leading-tight">
                          {varianteDe(c) || "—"}
                        </p>
                        {c.referencia && <p className="ag-mono mt-1 truncate text-[0.72rem] text-dim">{c.referencia}</p>}
                      </div>
                    </Td>

                    <Td>
                      <div className="max-w-[260px]">
                        <p className="truncate font-light text-mute">{c.producto_buscado}</p>
                        {c.codigo && <p className="ag-mono mt-1 text-[0.72rem] text-acentohi">{c.codigo}</p>}
                      </div>
                    </Td>

                    <Td>
                      <div className="max-w-[180px]">
                        <p className="truncate font-display text-[0.88rem] font-extrabold uppercase">{c.nombre}</p>
                        <p className="mt-0.5 truncate text-sm font-light text-dim">{c.email}</p>
                      </div>
                    </Td>

                    <Td><span className="ag-mono whitespace-nowrap text-dim">{fmtDate(c.created_at)}</span></Td>

                    <Td>
                      <StatusSelect
                        tone={ESTADO_TONE[c.estado]}
                        value={c.estado}
                        onChange={(e) => cambiarEstado(c.id, e.target.value as ConsultaEstado)}
                      >
                        {Object.entries(ESTADO_LABEL).map(([v, l]) => (
                          <option key={v} value={v} className="bg-panel text-chalk">{l}</option>
                        ))}
                      </StatusSelect>
                    </Td>

                    <Td className="text-right">
                      <button
                        onClick={() => setBorrar(c)}
                        title="Eliminar consulta"
                        className="px-1 text-dim transition-colors hover:text-sale"
                      >
                        ✕
                      </button>
                    </Td>
                  </tr>

                  {abierta && (
                    <tr className="border-b border-line bg-ink/60">
                      <td colSpan={7} className="px-5 py-6">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

                          {/* Lo que pidió */}
                          <div className="space-y-5">
                            <div>
                              <p className="ag-eyebrow mb-2.5">Qué necesita</p>
                              <p className="whitespace-pre-line font-light leading-relaxed text-mute">
                                {c.producto_buscado}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                              {varianteDe(c) && <Badge tone="acento">{varianteDe(c)}</Badge>}
                              {c.codigo && <Badge tone="ok">SKU {c.codigo}</Badge>}
                            </div>

                            {c.referencia && (
                              <div className="border border-line bg-panel px-4 py-3">
                                <p className="ag-label mb-1">Link de referencia</p>
                                <p className="ag-mono break-all text-[0.95rem] text-chalk">{c.referencia}</p>
                              </div>
                            )}

                            {c.fotos && c.fotos.length > 0 && (
                              <div>
                                <p className="ag-eyebrow mb-2.5">Fotos que mandó</p>
                                <div className="flex flex-wrap gap-2">
                                  {c.fotos.map((url, i) => (
                                    <a
                                      key={url} href={url} target="_blank" rel="noopener noreferrer"
                                      className="block h-24 w-24 border border-line transition-colors hover:border-acento"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Contacto y respuesta */}
                          <div className="space-y-px">
                            <div className="border border-line bg-panel p-5">
                              <p className="ag-eyebrow mb-3">Contacto</p>
                              <p className="font-display text-[0.95rem] font-extrabold uppercase">{c.nombre}</p>
                              <div className="mt-3 space-y-2">
                                <a href={`mailto:${c.email}`} className="block text-sm text-acentohi hover:text-chalk">
                                  {c.email}
                                </a>
                                {c.whatsapp && (
                                  <a
                                    href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="block text-sm text-acentohi hover:text-chalk"
                                  >
                                    WhatsApp {c.whatsapp}
                                  </a>
                                )}
                              </div>
                              <p className="ag-label mt-3">
                                Prefiere {c.contacto_preferido === "whatsapp" ? "WhatsApp" : "email"}
                              </p>
                            </div>

                            <div className="border border-line bg-panel p-5">
                              <p className="ag-eyebrow mb-4">Tu cotización</p>
                              <div className="space-y-4">
                                <Field label="Precio (ARS)">
                                  <Input
                                    type="number" min={0} value={precio}
                                    onChange={(e) => setPrecio(e.target.value)}
                                    placeholder="0"
                                  />
                                </Field>
                                <Field label="Plazo">
                                  <Input
                                    value={plazo} onChange={(e) => setPlazo(e.target.value)}
                                    placeholder="Ej.: 10 a 15 días"
                                  />
                                </Field>
                                <Field label="Notas internas" hint="No las ve el cliente">
                                  <Input
                                    value={notas} onChange={(e) => setNotas(e.target.value)}
                                    placeholder="Proveedor, costo, alternativas…"
                                  />
                                </Field>

                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                  <Btn variant="acento" size="sm" onClick={() => guardarRespuesta(c)} disabled={guardando}>
                                    {guardando ? "Guardando…" : "Guardar"}
                                  </Btn>
                                  {guardado === "ok"    && <Msg tone="ok">Guardado</Msg>}
                                  {guardado === "error" && <Msg tone="sale">No se pudo guardar</Msg>}
                                </div>

                                {c.precio_cotizado != null && (
                                  <p className="ag-label border-t border-line pt-3">
                                    Cotizada en {fmtARS(c.precio_cotizado)}
                                    {c.plazo_estimado ? ` · ${c.plazo_estimado}` : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <Note>
        {visibles.length} de {consultas.length} consultas · las nuevas aparecen solas, sin recargar
      </Note>

      <Confirm
        open={borrar !== null}
        title="¿Eliminar la consulta?"
        body={`Se borra ${borrar?.numero ?? "la consulta"} con todo lo que mandó el cliente. Si la venta no salió, conviene pasarla a «Perdida» y conservar el registro.`}
        onCancel={() => setBorrar(null)}
        onConfirm={() => borrar && eliminar(borrar.id)}
      />
    </Page>
  );
}
