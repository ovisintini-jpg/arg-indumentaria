"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useCatalogCategories } from "@/context/CatalogCategoriesContext";
import {
  Page, PageHead, StatRow, Stat, Panel, TableWrap, THead, Td, Row,
  Empty, ErrorState, Loading, Note, SIN_RESPUESTA, fmtARS,
} from "@/components/admin/ui";

interface RevenueRow {
  month:           string;
  total_orders:    number;
  revenue:         number;
  avg_ticket:      number;
  cancelled_count: number;
}

interface PaymentBreakdown {
  payment_method: string;
  total:          number;
  count:          number;
}

interface CategoryStat {
  id: string; units: number; revenue: number; cost: number;
}

const MESES_ES: Record<number, string> = {
  1:"Ene",2:"Feb",3:"Mar",4:"Abr",5:"May",6:"Jun",
  7:"Jul",8:"Ago",9:"Sep",10:"Oct",11:"Nov",12:"Dic",
};

const METHOD_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  efectivo:      "Efectivo",
  mercadopago:   "MercadoPago",
  tiendanube:    "Tienda Nube",
};

/* Rampa de marca: acentoes de la firma + grises del taller. Un solo mundo de
   color, para que los gráficos no compitan con el acento de la tienda. */
const RAMP = ["#3D8BF0", "#1668D6", "#0A3B84", "#8C939E", "#5B626C", "#333A45"];
const rampAt = (i: number) => RAMP[i % RAMP.length];

/* ── Donut ─────────────────────────────────────────────────────── */
function DonutChart({ segments }: { segments: { pct: number; stroke: string }[] }) {
  const R = 60, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
      <circle cx="80" cy="80" r={R} fill="none" stroke="#1A1E25" strokeWidth="20" />
      {segments.map((s, i) => {
        const dash = (s.pct / 100) * C;
        const el = (
          <circle
            key={i} cx="80" cy="80" r={R} fill="none"
            stroke={s.stroke} strokeWidth="20"
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

export default function FinanzasPage() {
  const { categories } = useCatalogCategories();

  const [data,          setData]          = useState<RevenueRow[]>([]);
  const [breakdown,     setBreakdown]     = useState<PaymentBreakdown[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [totalUnits,    setTotalUnits]    = useState(0);
  const [totalCost,     setTotalCost]     = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState("");

  useEffect(() => {
    // Red de seguridad: si la base no contesta, la pantalla no queda girando
    const t = setTimeout(() => { setLoading(false); setLoadError(SIN_RESPUESTA); }, 10000);

    const fetchAll = async () => {
      try {
        const { data: rows } = await supabase.from("revenue_by_month").select("*").limit(12);
        if (rows) setData(rows as RevenueRow[]);

        const { data: activeOrders } = await supabase
          .from("orders").select("id, payment_method, total").neq("status", "cancelled");

        if (activeOrders) {
          const map: Record<string, PaymentBreakdown> = {};
          for (const o of activeOrders) {
            const m = o.payment_method ?? "otros";
            if (!map[m]) map[m] = { payment_method: m, total: 0, count: 0 };
            map[m].total += Number(o.total);
            map[m].count += 1;
          }
          setBreakdown(Object.values(map).sort((a, b) => b.total - a.total));

          const activeIds = activeOrders.map((o) => o.id);
          if (activeIds.length > 0) {
            const { data: items } = await supabase
              .from("order_items")
              .select("quantity, price, products(category_id, cost_price)")
              .in("order_id", activeIds);

            if (items) {
              setTotalUnits(items.reduce((a, i) => a + Number(i.quantity), 0));
              setTotalCost(items.reduce((a, i) => {
                const cp = (i.products as { cost_price?: number } | null)?.cost_price ?? 0;
                return a + cp * Number(i.quantity);
              }, 0));

              const catMap: Record<string, { units: number; revenue: number; cost: number }> = {};
              for (const item of items) {
                const prod  = item.products as { category_id?: string; cost_price?: number } | null;
                const catId = prod?.category_id ?? "sin-categoria";
                const cp    = prod?.cost_price  ?? 0;
                if (!catMap[catId]) catMap[catId] = { units: 0, revenue: 0, cost: 0 };
                catMap[catId].units   += Number(item.quantity);
                catMap[catId].revenue += Number(item.price) * Number(item.quantity);
                catMap[catId].cost    += cp * Number(item.quantity);
              }

              setCategoryStats(
                Object.entries(catMap)
                  .map(([id, s]) => ({ id, ...s }))
                  .sort((a, b) => b.revenue - a.revenue)
              );
            }
          }
        }

      } catch {
        setLoadError(SIN_RESPUESTA);
      } finally {
        setLoading(false);
      }
    };

    fetchAll().finally(() => clearTimeout(t));
    return () => clearTimeout(t);
  }, []);

  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? (id === "sin-categoria" ? "Sin categoría" : id);

  const total          = data.reduce((a, r) => a + Number(r.revenue), 0);
  const promedio       = data.length ? total / data.length : 0;
  const max            = data.length ? Math.max(...data.map((r) => Number(r.revenue))) : 1;
  const totalOrders    = data.reduce((a, r) => a + Number(r.total_orders), 0);
  const breakdownTotal = breakdown.reduce((a, b) => a + b.total, 0);
  const maxCatUnits    = categoryStats.length ? Math.max(...categoryStats.map((c) => c.units)) : 1;
  const maxCatRevenue  = categoryStats.length ? Math.max(...categoryStats.map((c) => c.revenue)) : 1;
  const catRevenueSum  = categoryStats.reduce((a, c) => a + c.revenue, 0);
  const netProfit      = total - totalCost;
  const margin         = total > 0 ? (netProfit / total) * 100 : 0;
  const hasCostData    = totalCost > 0;

  const formatMonth = (iso: string) => {
    const d = new Date(iso);
    return `${MESES_ES[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`;
  };

  const sinDatos = !loading && data.length === 0 && breakdown.length === 0;

  return (
    <Page>
      <PageHead
        title="Finanzas"
        sub="Se arma sola con los pedidos no cancelados. El margen aparece cuando cargás precios de costo en los productos."
      />

      {loading ? (
        <div className="border border-line bg-panel"><Loading label="Calculando" /></div>
      ) : loadError ? (
        <div className="border border-line bg-panel"><ErrorState msg={loadError} /></div>
      ) : sinDatos ? (
        <div className="border border-line bg-panel">
          <Empty
            title="Sin ventas todavía"
            sub="En cuanto entre el primer pedido vas a ver acá los ingresos, el margen y qué categorías se mueven."
          />
        </div>
      ) : (
        <>
          <StatRow cols={5}>
            <Stat label="Ingresos"        value={fmtARS(total)}    hint="acumulado" tone="acento" />
            <Stat label="Promedio mensual" value={fmtARS(promedio)} hint="por mes" />
            <Stat label="Pedidos"          value={totalOrders}      hint="sin cancelados" tone="ok" />
            <Stat label="Unidades"         value={totalUnits}       hint="prendas vendidas" />
            <Stat label="Mejor mes"        value={fmtARS(max)}      hint="récord" />
          </StatRow>

          <StatRow>
            <Stat
              label="Costo de la mercadería"
              value={hasCostData ? fmtARS(totalCost) : "—"}
              hint={hasCostData ? "acumulado" : "cargá precios de costo"}
              tone={hasCostData ? "warn" : "mute"}
            />
            <Stat
              label="Ganancia neta"
              value={hasCostData ? fmtARS(netProfit) : "—"}
              hint={hasCostData ? "ingresos − costos" : "requiere precios de costo"}
              tone={hasCostData ? (netProfit >= 0 ? "ok" : "sale") : "mute"}
            />
            <Stat
              label="Margen bruto"
              value={hasCostData ? `${margin.toFixed(1)}%` : "—"}
              hint={hasCostData ? "sobre ingresos" : "requiere precios de costo"}
              tone={hasCostData ? "acento" : "mute"}
            />
            <div className="bg-panel px-6 py-6">
              <p className="ag-label">Rentabilidad</p>
              {hasCostData ? (
                <>
                  <div className="mt-4 h-2 w-full overflow-hidden bg-raise">
                    <div
                      className={`h-full ${margin >= 30 ? "bg-ok" : margin >= 15 ? "bg-warn" : "bg-sale"}`}
                      style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }}
                    />
                  </div>
                  <p className={`ag-label mt-3 ${margin >= 30 ? "text-ok" : margin >= 15 ? "text-warn" : "text-sale"}`}>
                    {margin >= 30 ? "Saludable" : margin >= 15 ? "Ajustado" : "Bajo"}
                  </p>
                </>
              ) : (
                <p className="ag-label mt-4 normal-case tracking-[0.08em]">
                  Se activa cuando cargás el costo de al menos un producto vendido.
                </p>
              )}
            </div>
          </StatRow>

          {/* Métodos de pago */}
          {breakdown.length > 0 && (
            <Panel title="Ingresos por medio de pago" className="mb-6">
              <div className="flex flex-wrap items-center gap-10">
                <div className="relative shrink-0">
                  <DonutChart
                    segments={breakdown.map((b, i) => ({
                      pct: breakdownTotal > 0 ? (b.total / breakdownTotal) * 100 : 0,
                      stroke: rampAt(i),
                    }))}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="ag-label">Total</p>
                    <p className="ag-num mt-1 font-display text-sm font-extrabold">{fmtARS(breakdownTotal)}</p>
                  </div>
                </div>

                <div className="min-w-[260px] flex-1 space-y-4">
                  {breakdown.map((b, i) => {
                    const pct = breakdownTotal > 0 ? (b.total / breakdownTotal) * 100 : 0;
                    return (
                      <div key={b.payment_method}>
                        <div className="mb-1.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 shrink-0" style={{ background: rampAt(i) }} />
                            <span className="ag-label text-mute">
                              {METHOD_LABEL[b.payment_method] ?? b.payment_method}
                            </span>
                            <span className="ag-label">· {b.count} pedidos</span>
                          </div>
                          <span className="ag-num font-display font-extrabold">{fmtARS(b.total)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden bg-raise">
                          <div className="h-full" style={{ width: `${pct}%`, background: rampAt(i) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}

          {/* Ventas por categoría */}
          {categoryStats.length > 0 && (
            <Panel title="Ventas por categoría" className="mb-6">
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <div>
                  <p className="ag-eyebrow mb-4">Unidades vendidas</p>
                  <div className="space-y-3.5">
                    {categoryStats.map((c, i) => (
                      <div key={c.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-4">
                          <span className="ag-label text-mute">{catName(c.id)}</span>
                          <span className="ag-num text-sm">{c.units} u.</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden bg-raise">
                          <div
                            className="h-full"
                            style={{ width: `${maxCatUnits ? (c.units / maxCatUnits) * 100 : 0}%`, background: rampAt(i) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="ag-eyebrow mb-4">Ingresos por categoría</p>
                  <div className="space-y-3.5">
                    {categoryStats.map((c, i) => (
                      <div key={c.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-4">
                          <span className="ag-label text-mute">{catName(c.id)}</span>
                          <span className="ag-num text-sm">{fmtARS(c.revenue)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden bg-raise">
                          <div
                            className="h-full"
                            style={{ width: `${maxCatRevenue ? (c.revenue / maxCatRevenue) * 100 : 0}%`, background: rampAt(i) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-9 overflow-x-auto border-t border-line pt-6">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="ag-label pb-3 pr-4 text-left font-semibold">Categoría</th>
                      <th className="ag-label pb-3 pr-4 text-left font-semibold">Unidades</th>
                      <th className="ag-label pb-3 pr-4 text-left font-semibold">Ingresos</th>
                      {hasCostData && <th className="ag-label pb-3 pr-4 text-left font-semibold">Ganancia</th>}
                      {hasCostData && <th className="ag-label pb-3 pr-4 text-left font-semibold">Margen</th>}
                      <th className="ag-label pb-3 text-left font-semibold">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryStats.map((c, i) => {
                      const pct       = catRevenueSum > 0 ? (c.revenue / catRevenueSum) * 100 : 0;
                      const catProfit = c.revenue - c.cost;
                      const catMargin = c.revenue > 0 ? (catProfit / c.revenue) * 100 : 0;
                      return (
                        <tr key={c.id} className="border-b border-line/70">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 shrink-0" style={{ background: rampAt(i) }} />
                              <span className="font-display text-[0.88rem] font-extrabold uppercase">{catName(c.id)}</span>
                            </div>
                          </td>
                          <td className="ag-num py-3 pr-4 text-sm text-mute">{c.units} u.</td>
                          <td className="ag-num py-3 pr-4 text-sm font-semibold text-acentohi">{fmtARS(c.revenue)}</td>
                          {hasCostData && <td className="ag-num py-3 pr-4 text-sm text-ok">{fmtARS(catProfit)}</td>}
                          {hasCostData && (
                            <td className="py-3 pr-4">
                              <span className={`ag-num text-sm ${catMargin >= 30 ? "text-ok" : catMargin >= 15 ? "text-warn" : "text-sale"}`}>
                                {catMargin.toFixed(1)}%
                              </span>
                            </td>
                          )}
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 w-20 overflow-hidden bg-raise">
                                <div className="h-full" style={{ width: `${pct}%`, background: rampAt(i) }} />
                              </div>
                              <span className="ag-num text-xs text-mute">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* Barras mensuales */}
          {data.length > 0 && (
            <Panel title="Ventas mensuales" className="mb-6">
              <div className="flex h-52 items-end gap-3">
                {[...data].reverse().map((r, i) => {
                  const pct   = max > 0 ? (Number(r.revenue) / max) * 100 : 0;
                  const isMax = Number(r.revenue) === max;
                  return (
                    <div key={i} className="group flex flex-1 flex-col items-center gap-2">
                      <span className="ag-num text-xs text-dim transition-colors group-hover:text-acentohi">
                        {(Number(r.revenue) / 1000).toFixed(0)}k
                      </span>
                      <div
                        className={`w-full transition-colors ${isMax ? "bg-acento" : "bg-acentodp group-hover:bg-acento"}`}
                        style={{ height: `${pct}%`, minHeight: "4px" }}
                      />
                      <span className="ag-label">{formatMonth(r.month).split(" ")[0]}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* Tabla mensual */}
          {data.length > 0 && (
            <TableWrap>
              <THead cols={["Mes", "Ingresos", "Pedidos", "Ticket promedio", "Cancelados"]} />
              <tbody>
                {data.map((r, i) => (
                  <Row key={i}>
                    <Td><span className="font-display text-[0.9rem] font-extrabold uppercase">{formatMonth(r.month)}</span></Td>
                    <Td><span className="ag-num font-display font-extrabold text-acentohi">{fmtARS(Number(r.revenue))}</span></Td>
                    <Td><span className="ag-num text-mute">{r.total_orders}</span></Td>
                    <Td><span className="ag-num text-mute">{fmtARS(Number(r.avg_ticket))}</span></Td>
                    <Td><span className="ag-num text-sale">{r.cancelled_count}</span></Td>
                  </Row>
                ))}
              </tbody>
            </TableWrap>
          )}

          <Note>Los pedidos cancelados quedan fuera de todos los totales de esta pantalla</Note>
        </>
      )}
    </Page>
  );
}
