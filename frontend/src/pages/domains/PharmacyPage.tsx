import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { apiList, fetchPatients } from "../../api/list";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type RxQueue = {
  id: string;
  patient_id: string;
  status: string;
  lines: { medicine_code: string; medicine_name: string; dose?: string; frequency?: string }[];
};

type Dispense = {
  id: string;
  dispense_no: string;
  patient_id: string;
  medicine_code: string;
  qty: number;
  status: string;
};

const NEXT: Record<string, string> = { queued: "verified", pending: "verified", verified: "dispensed" };

export default function PharmacyPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [queue, setQueue] = useState<RxQueue[]>([]);
  const [dispenses, setDispenses] = useState<Dispense[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", medicine_code: "", qty: "1" });

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, med, q, d] = await Promise.all([
      fetchPatients(),
      api<any[]>("/masters/medicines"),
      api<RxQueue[]>("/clinical/prescriptions"),
      apiList<Dispense>("/clinical/pharmacy-dispenses", { page: 1, page_size: 200 }).then((r) => r.items),
    ]);
    setPatients(p);
    setMedicines(med);
    setQueue(q);
    setDispenses(d);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function queueFromRx(rxId: string) {
    await api("/clinical/pharmacy-dispenses/from-prescription", {
      method: "POST",
      body: JSON.stringify({ prescription_id: rxId }),
    });
    setMsg("Prescription lines queued for dispensing");
    await load();
  }

  async function manualDispense(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/pharmacy-dispenses", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id,
        medicine_code: form.medicine_code,
        qty: Number(form.qty),
      }),
    });
    setMsg("Dispense queued — stock checked");
    await load();
  }

  async function advanceStatus(d: Dispense) {
    const next = NEXT[d.status];
    if (!next) return;
    await api(`/clinical/pharmacy-dispenses/${d.id}/status?status=${next}`, { method: "PATCH" });
    setMsg(`${d.dispense_no} → ${next}`);
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="pharmacy-management" compact />
      <h1 className="page-title">Pharmacy</h1>
      <p className="muted">queued → verified → dispensed (stock deducted on dispense)</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/encounters" className="secondary button-link">Encounters (Rx source)</Link>
        <Link to="/masters" className="secondary button-link">Medicine masters</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="grid-2">
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Prescription queue ({queue.length})</h3>
          <table>
            <thead><tr><th>Patient</th><th>Lines</th><th></th></tr></thead>
            <tbody>
              {queue.map((rx) => (
                <tr key={rx.id}>
                  <td>{patientMap.get(rx.patient_id) || "—"}</td>
                  <td>{rx.lines.map((ln) => <div key={ln.medicine_code}>{ln.medicine_name}</div>)}</td>
                  <td>
                    <button type="button" className="secondary" onClick={() => queueFromRx(rx.id).catch((e) => setError(e.message))}>
                      Queue dispense
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="card" onSubmit={(e) => manualDispense(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Walk-in dispense</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Medicine</label>
            <select required value={form.medicine_code} onChange={(e) => setForm({ ...form, medicine_code: e.target.value })}>
              <option value="">Select</option>
              {medicines.map((m) => <option key={m.code} value={m.code}>{m.name} — stock {m.stock_qty ?? "?"}</option>)}
            </select>
          </div>
          <button type="submit">Queue dispense</button>
        </form>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Dispense records</h3>
        <table>
          <thead><tr><th>No</th><th>Patient</th><th>Medicine</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {dispenses.map((d) => (
              <tr key={d.id}>
                <td>{d.dispense_no}</td>
                <td>{patientMap.get(d.patient_id) || "—"}</td>
                <td>{d.medicine_code}</td>
                <td><span className="badge">{d.status}</span></td>
                <td>
                  {NEXT[d.status] && (
                    <button type="button" className="secondary" onClick={() => advanceStatus(d).catch((e) => setError(e.message))}>
                      → {NEXT[d.status]}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

