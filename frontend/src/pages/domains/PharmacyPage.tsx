import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type RxQueue = {
  id: string;
  patient_id: string;
  status: string;
  notes?: string;
  lines: { medicine_code: string; medicine_name: string; dose?: string; frequency?: string }[];
  dispensed_count: number;
  line_count: number;
};

type Dispense = {
  id: string;
  dispense_no: string;
  patient_id: string;
  medicine_code: string;
  qty: number;
  status: string;
  prescription_id?: string;
  substitution_code?: string;
};

export default function PharmacyPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [queue, setQueue] = useState<RxQueue[]>([]);
  const [dispenses, setDispenses] = useState<Dispense[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", medicine_code: "", qty: "1", prescription_id: "" });

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, med, q, d] = await Promise.all([
      api<any[]>("/patients"),
      api<any[]>("/masters/medicines"),
      api<RxQueue[]>("/clinical/prescriptions"),
      api<Dispense[]>("/clinical/pharmacy-dispenses"),
    ]);
    setPatients(p);
    setMedicines(med);
    setQueue(q);
    setDispenses(d);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function dispenseFromQueue(rx: RxQueue, medicineCode: string) {
    const q = new URLSearchParams({
      patient_id: rx.patient_id,
      medicine_code: medicineCode,
      qty: "1",
      prescription_id: rx.id,
    });
    await api(`/clinical/pharmacy-dispenses?${q}`, { method: "POST" });
    setMsg(`Dispense queued for ${medicineCode}`);
    await load();
  }

  async function manualDispense(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      patient_id: form.patient_id,
      medicine_code: form.medicine_code,
      qty: form.qty,
    });
    if (form.prescription_id) q.set("prescription_id", form.prescription_id);
    await api(`/clinical/pharmacy-dispenses?${q}`, { method: "POST" });
    setMsg("Dispense record created");
    await load();
  }

  async function markDispensed(id: string) {
    await api(`/clinical/pharmacy-dispenses/${id}?status=dispensed`, { method: "PATCH" });
    setMsg("Marked dispensed");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="pharmacy-management" compact />
      <h1 className="page-title">Pharmacy</h1>
      <p className="muted">Prescription queue from encounters · dispense · substitution tracking</p>
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
            <thead>
              <tr><th>Patient</th><th>Medicines</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {queue.map((rx) => (
                <tr key={rx.id}>
                  <td>{patientMap.get(rx.patient_id) || rx.patient_id.slice(0, 8)}</td>
                  <td>
                    {rx.lines.map((ln) => (
                      <div key={ln.medicine_code}>{ln.medicine_name} ({ln.dose} {ln.frequency})</div>
                    ))}
                  </td>
                  <td>
                    <span className="badge">{rx.status}</span>
                    <span className="muted" style={{ marginLeft: "0.25rem" }}>{rx.dispensed_count}/{rx.line_count}</span>
                  </td>
                  <td className="actions">
                    {rx.lines.map((ln) => (
                      <button
                        key={ln.medicine_code}
                        type="button"
                        className="secondary"
                        onClick={() => dispenseFromQueue(rx, ln.medicine_code).catch((e) => setError(e.message))}
                      >
                        Dispense {ln.medicine_code}
                      </button>
                    ))}
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr><td colSpan={4} className="muted">No pending prescriptions — issue Rx from an encounter first.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <form className="card" onSubmit={(e) => manualDispense(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Manual dispense</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Medicine (master)</label>
            <select required value={form.medicine_code} onChange={(e) => setForm({ ...form, medicine_code: e.target.value })}>
              <option value="">Select</option>
              {medicines.map((m) => (
                <option key={m.code} value={m.code}>{m.name} — {m.strength}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Qty</label>
            <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </div>
          <button type="submit">Create dispense</button>
        </form>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Dispense records</h3>
        <table>
          <thead>
            <tr><th>Dispense</th><th>Patient</th><th>Medicine</th><th>Qty</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {dispenses.map((d) => (
              <tr key={d.id}>
                <td>{d.dispense_no}</td>
                <td>{patientMap.get(d.patient_id) || d.patient_id.slice(0, 8)}</td>
                <td>{d.medicine_code}</td>
                <td>{d.qty}</td>
                <td><span className="badge">{d.status}</span></td>
                <td>
                  {d.status === "pending" && (
                    <button type="button" className="secondary" onClick={() => markDispensed(d.id).catch((e) => setError(e.message))}>
                      Mark dispensed
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
