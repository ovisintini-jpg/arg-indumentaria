"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Page, PageHead, StatRow, Stat, Btn, Field, Input, Select, Badge,
  TableWrap, THead, Td, Row, Empty, ErrorState, Loading, Modal, Confirm, Note, Msg,
  SIN_RESPUESTA, fmtDate,
} from "@/components/admin/ui";

interface Cliente {
  id:                   string;
  email:                string;
  full_name:            string | null;
  phone:                string | null;
  dni:                  string | null;
  address_street:       string | null;
  address_neighborhood: string | null;
  address_city:         string | null;
  address_province:     string | null;
  address_zip:          string | null;
  status:               "active" | "cancelled";
  created_at:           string;
}

const EMPTY_EDIT = {
  full_name: "", phone: "", dni: "",
  address_street: "", address_neighborhood: "",
  address_city: "", address_province: "", address_zip: "",
};

const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes",
  "Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones",
  "Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe",
  "Santiago del Estero","Tierra del Fuego","Tucumán",
];

export default function ClientesPage() {
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<"all" | "active" | "cancelled">("all");
  const [editing,       setEditing]       = useState<Cliente | null>(null);
  const [editForm,      setEditForm]      = useState(EMPTY_EDIT);
  const [saving,        setSaving]        = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");
  const [deleteTarget,  setDeleteTarget]  = useState<Cliente | null>(null);
  const [loadError,     setLoadError]     = useState("");

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_clients_view").select("*").order("created_at", { ascending: false });
      if (error) setLoadError(error.message);
      else if (data) { setClientes(data as Cliente[]); setLoadError(""); }
    } catch {
      setLoadError(SIN_RESPUESTA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); setLoadError(SIN_RESPUESTA); }, 10000);
    fetchClientes().finally(() => clearTimeout(t));
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const filtered = useMemo(() => {
    let list = clientes;
    if (filterStatus !== "all") list = list.filter((c) => c.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.dni ?? "").includes(q)
      );
    }
    return list;
  }, [clientes, search, filterStatus]);

  const openEdit = (c: Cliente) => {
    setEditing(c);
    setEditForm({
      full_name: c.full_name ?? "", phone: c.phone ?? "", dni: c.dni ?? "",
      address_street: c.address_street ?? "", address_neighborhood: c.address_neighborhood ?? "",
      address_city: c.address_city ?? "", address_province: c.address_province ?? "",
      address_zip: c.address_zip ?? "",
    });
    setSaveMsg("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true); setSaveMsg("");
    const { error } = await supabase.from("user_profiles").update(editForm).eq("id", editing.id);
    setSaving(false);
    if (error) {
      setSaveMsg("No se pudo guardar. Revisá que tu usuario tenga permisos de admin.");
    } else {
      setSaveMsg("Guardado.");
      setClientes((prev) => prev.map((c) => c.id === editing.id ? { ...c, ...editForm } : c));
      setTimeout(() => { setSaveMsg(""); setEditing(null); }, 1100);
    }
  };

  const toggleStatus = async (c: Cliente) => {
    const newStatus = c.status === "active" ? "cancelled" : "active";
    const { error } = await supabase.from("user_profiles").update({ status: newStatus }).eq("id", c.id);
    if (!error) setClientes((prev) => prev.map((x) => x.id === c.id ? { ...x, status: newStatus } : x));
  };

  const deleteCliente = async (id: string) => {
    const { error } = await supabase.from("user_profiles").delete().eq("id", id);
    if (!error) { setClientes((prev) => prev.filter((c) => c.id !== id)); setDeleteTarget(null); }
  };

  const set = (key: keyof typeof EMPTY_EDIT) =>
    (v: string) => setEditForm((f) => ({ ...f, [key]: v }));

  return (
    <Page>
      <PageHead
        title="Clientes"
        sub="Las cuentas registradas en la tienda, con sus datos de envío."
      />

      <StatRow cols={3}>
        <Stat label="Registrados" value={clientes.length} />
        <Stat label="Activos"     value={clientes.filter((c) => c.status === "active").length} tone="ok" />
        <Stat label="Cancelados"  value={clientes.filter((c) => c.status === "cancelled").length} tone="sale" />
      </StatRow>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, teléfono o DNI…"
          className="min-w-[260px] flex-1"
        />
        <div className="w-full sm:w-48">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="cancelled">Cancelados</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="border border-line bg-panel"><Loading label="Cargando clientes" /></div>
      ) : loadError && clientes.length === 0 ? (
        <div className="border border-line bg-panel"><ErrorState msg={loadError} /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-line bg-panel">
          <Empty
            title={clientes.length === 0 ? "Todavía no hay clientes registrados" : "Ningún cliente coincide"}
            sub={clientes.length === 0
              ? "Se cargan solos cuando alguien crea su cuenta en la tienda."
              : "Probá con otro término o cambiá el filtro."}
          />
        </div>
      ) : (
        <TableWrap>
          <THead cols={["Cliente", "Contacto", "Ubicación", "Alta", "Estado", ""]} />
          <tbody>
            {filtered.map((c) => (
              <Row key={c.id} dim={c.status === "cancelled"}>
                <Td>
                  <div className="flex max-w-[320px] items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-ink font-display text-sm font-extrabold text-acentohi">
                      {(c.full_name ?? c.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display text-[0.92rem] font-extrabold uppercase leading-tight">
                        {c.full_name ?? "Sin nombre"}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-light text-dim">{c.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <p className="ag-mono text-mute">{c.phone ?? "—"}</p>
                  <p className="ag-label mt-1">DNI {c.dni ?? "—"}</p>
                </Td>
                <Td>
                  <p className="font-light text-mute">
                    {c.address_city && c.address_province
                      ? `${c.address_city}, ${c.address_province}`
                      : c.address_province ?? c.address_city ?? "—"}
                  </p>
                </Td>
                <Td><span className="ag-mono whitespace-nowrap text-dim">{fmtDate(c.created_at)}</span></Td>
                <Td>
                  <Badge tone={c.status === "active" ? "ok" : "sale"}>
                    {c.status === "active" ? "Activo" : "Cancelado"}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <Btn size="xs" onClick={() => openEdit(c)}>Editar</Btn>
                    <Btn size="xs" onClick={() => toggleStatus(c)}>
                      {c.status === "active" ? "Cancelar" : "Reactivar"}
                    </Btn>
                    <Btn size="xs" variant="danger" onClick={() => setDeleteTarget(c)}>Borrar</Btn>
                  </div>
                </Td>
              </Row>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Note>{filtered.length} de {clientes.length} clientes</Note>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        eyebrow="Editar cliente"
        title={editing?.full_name ?? editing?.email ?? ""}
        sub={editing?.email}
        footer={
          <>
            <Btn variant="acento" size="md" onClick={saveEdit} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Btn>
            <Btn size="md" onClick={() => setEditing(null)}>Cancelar</Btn>
            {saveMsg && <Msg tone={saveMsg === "Guardado." ? "ok" : "sale"}>{saveMsg}</Msg>}
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Nombre completo" span>
            <Input value={editForm.full_name} onChange={(e) => set("full_name")(e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <Input type="tel" value={editForm.phone} onChange={(e) => set("phone")(e.target.value)} />
          </Field>
          <Field label="DNI / CUIL">
            <Input value={editForm.dni} onChange={(e) => set("dni")(e.target.value)} />
          </Field>

          <div className="border-t border-line pt-5 sm:col-span-2">
            <p className="ag-eyebrow">Dirección de envío</p>
          </div>

          <Field label="Calle y número" span>
            <Input value={editForm.address_street} onChange={(e) => set("address_street")(e.target.value)} />
          </Field>
          <Field label="Barrio" span>
            <Input
              value={editForm.address_neighborhood}
              onChange={(e) => set("address_neighborhood")(e.target.value)}
              placeholder="Ej: Nueva Córdoba, Villa Crespo…"
            />
          </Field>
          <Field label="Ciudad">
            <Input value={editForm.address_city} onChange={(e) => set("address_city")(e.target.value)} />
          </Field>
          <Field label="Provincia">
            <Select value={editForm.address_province} onChange={(e) => set("address_province")(e.target.value)}>
              <option value="">— Seleccioná —</option>
              {PROVINCIAS.map((pv) => <option key={pv} value={pv}>{pv}</option>)}
            </Select>
          </Field>
          <Field label="Código postal">
            <Input value={editForm.address_zip} onChange={(e) => set("address_zip")(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Confirm
        open={deleteTarget !== null}
        title="¿Eliminar el perfil?"
        body={`Se borra el perfil de ${deleteTarget?.full_name ?? deleteTarget?.email ?? ""} con sus datos de envío. Si solo querés desactivar la cuenta, usá «Cancelar».`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteCliente(deleteTarget.id)}
      />
    </Page>
  );
}
