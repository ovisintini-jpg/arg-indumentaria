"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Page, PageHead, StatRow, Stat, Btn, StatusSelect, TableWrap, THead, Td, Row,
  Empty, ErrorState, Loading, Confirm, Note, Tone, SIN_RESPUESTA, fmtDate,
} from "@/components/admin/ui";

interface ReviewRow {
  id:            string;
  order_id:      string;
  customer_name: string;
  stars:         number;
  body:          string;
  status:        "pending" | "verified" | "blocked";
  created_at:    string;
  orders:        { order_number: string } | { order_number: string }[] | null;
}

const STATUS_LABEL: Record<ReviewRow["status"], string> = {
  pending:  "Pendiente",
  verified: "Publicada",
  blocked:  "Bloqueada",
};

const STATUS_TONE: Record<ReviewRow["status"], Tone> = {
  pending: "warn", verified: "ok", blocked: "sale",
};

function orderNumberOf(row: ReviewRow): string {
  const rel = row.orders;
  if (!rel) return "—";
  return Array.isArray(rel) ? (rel[0]?.order_number ?? "—") : rel.order_number;
}

function Stars({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap" aria-label={`${n} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? "text-acentohi" : "text-line"}>★</span>
      ))}
    </span>
  );
}

export default function ResenasPage() {
  const [reviews,       setReviews]       = useState<ReviewRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<ReviewRow | null>(null);
  const [filter,        setFilter]        = useState<"all" | ReviewRow["status"]>("all");
  const [loadError,     setLoadError]     = useState("");

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, order_id, customer_name, stars, body, status, created_at, orders(order_number)")
        .order("created_at", { ascending: false });
      if (error) setLoadError(error.message);
      else if (data) { setReviews(data as unknown as ReviewRow[]); setLoadError(""); }
    } catch {
      setLoadError(SIN_RESPUESTA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); setLoadError(SIN_RESPUESTA); }, 10000);
    fetchReviews().finally(() => clearTimeout(t));
    const channel = supabase
      .channel("reviews-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, fetchReviews)
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (id: string, status: ReviewRow["status"]) => {
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    await supabase.from("reviews").update({ status }).eq("id", id);
  };

  const deleteReview = async (id: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    setConfirmDelete(null);
    await supabase.from("reviews").delete().eq("id", id);
  };

  const visible = useMemo(
    () => filter === "all" ? reviews : reviews.filter((r) => r.status === filter),
    [reviews, filter]
  );

  const pendientes = reviews.filter((r) => r.status === "pending").length;
  const publicadas = reviews.filter((r) => r.status === "verified").length;
  const promedio   = reviews.length
    ? reviews.reduce((a, r) => a + r.stars, 0) / reviews.length
    : 0;

  const FILTERS: { key: "all" | ReviewRow["status"]; label: string }[] = [
    { key: "all",      label: "Todas" },
    { key: "pending",  label: "Pendientes" },
    { key: "verified", label: "Publicadas" },
    { key: "blocked",  label: "Bloqueadas" },
  ];

  return (
    <Page>
      <PageHead
        title="Reseñas"
        sub="Solo las publicadas se ven en la tienda. Las nuevas entran como pendientes."
      />

      <StatRow>
        <Stat label="Reseñas"    value={reviews.length} />
        <Stat label="Pendientes" value={pendientes} hint={pendientes ? "esperan tu revisión" : "nada por revisar"} tone={pendientes ? "warn" : "mute"} />
        <Stat label="Publicadas" value={publicadas} tone="ok" />
        <Stat label="Promedio"   value={reviews.length ? `${promedio.toFixed(1)} ★` : "—"} tone="acento" />
      </StatRow>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Btn
            key={f.key}
            size="sm"
            variant={filter === f.key ? "acento" : "ghost"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Btn>
        ))}
      </div>

      {loading ? (
        <div className="border border-line bg-panel"><Loading label="Cargando reseñas" /></div>
      ) : loadError && reviews.length === 0 ? (
        <div className="border border-line bg-panel"><ErrorState msg={loadError} /></div>
      ) : visible.length === 0 ? (
        <div className="border border-line bg-panel">
          <Empty
            title={reviews.length === 0 ? "Todavía no hay reseñas" : "Ninguna reseña en este estado"}
            sub={reviews.length === 0
              ? "El cliente puede dejar una desde «Mi cuenta» cuando su pedido pasa a entregado."
              : undefined}
          />
        </div>
      ) : (
        <TableWrap>
          <THead cols={["Cliente", "Pedido", "Puntaje", "Reseña", "Estado", "Fecha", ""]} />
          <tbody>
            {visible.map((r) => (
              <Row key={r.id}>
                <Td>
                  <p className="whitespace-nowrap font-display text-[0.92rem] font-extrabold uppercase leading-tight">
                    {r.customer_name}
                  </p>
                </Td>
                <Td><span className="ag-mono whitespace-nowrap text-acentohi">{orderNumberOf(r)}</span></Td>
                <Td><Stars n={r.stars} /></Td>
                <Td className="max-w-md">
                  <p className="font-light leading-relaxed text-mute">{r.body}</p>
                </Td>
                <Td>
                  <StatusSelect
                    tone={STATUS_TONE[r.status]}
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value as ReviewRow["status"])}
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v} className="bg-panel text-chalk">{l}</option>
                    ))}
                  </StatusSelect>
                </Td>
                <Td><span className="ag-mono whitespace-nowrap text-dim">{fmtDate(r.created_at)}</span></Td>
                <Td className="text-right">
                  <button
                    onClick={() => setConfirmDelete(r)}
                    title="Eliminar reseña"
                    className="px-1 text-dim transition-colors hover:text-sale"
                  >
                    ✕
                  </button>
                </Td>
              </Row>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Note>
        Bloquear una reseña la saca de la tienda sin borrarla — queda el registro por si hay
        que revisarla después
      </Note>

      <Confirm
        open={confirmDelete !== null}
        title="¿Eliminar la reseña?"
        body={`Se borra la reseña de ${confirmDelete?.customer_name ?? ""}. Si solo querés que deje de verse en la tienda, alcanza con pasarla a «Bloqueada».`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteReview(confirmDelete.id)}
      />
    </Page>
  );
}
