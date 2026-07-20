import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fetchPatients } from "../../api/list";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import ClinicalProfileFields, { createClinicalProfile } from "../../components/ClinicalProfileFields";

type Admission = {
  id: string;
  admission_no: string;
  bed_code: string;
  status: string;
  patient_id: string;
};

export default function InpatientPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", bed_code: "", ward_code: "GEN", diagnosis_code: "" });
  const [admissionProfile, setAdmissionProfile] = useState(() => createClinicalProfile("ipd"));

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, b, ip] = await Promise.all([
      fetchPatients(),
      api<any[]>("/admin/beds"),
      api<Admission[]>("/clinical/ipd-admissions"),
    ]);
    setPatients(p);
    setBeds(b.filter((x) => x.status === "available"));
    setAdmissions(ip);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function admit(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/ipd-admissions", {
      method: "POST",
      body: JSON.stringify({ ...form, admission_profile: admissionProfile }),
    });
    setMsg("Patient admitted");
    setForm({ patient_id: "", bed_code: "", ward_code: "GEN", diagnosis_code: "" });
    await load();
    setAdmissionProfile(createClinicalProfile("ipd"));
  }

  async function discharge(id: string) {
    const res = await api<{ invoice: { invoice_no: string; total: number } }>(`/clinical/ipd-admissions/${id}/discharge`, { method: "POST" });
    setMsg(`Discharged — invoice ${res.invoice.invoice_no} (₹${res.invoice.total}). Bed released.`);
    await load();
  }

  const active = admissions.filter((a) => a.status !== "discharged");

  return (
    <div>
      <ModuleFlowBar moduleCode="ipd-admission-and-ward-management" compact />
      <h1 className="page-title">Inpatient admissions</h1>
      <p className="muted">Bed allocation from masters · admission · discharge with auto-billing</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/administration" className="secondary button-link">Bed administration</Link>
        <Link to="/billing" className="secondary button-link">Billing</Link>
        <Link to="/clinical-hub" className="secondary button-link">Clinical hub</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="grid-2">
        <form className="card" onSubmit={(e) => admit(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>New admission</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.mrn} — {p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Bed (available)</label>
            <select required value={form.bed_code} onChange={(e) => setForm({ ...form, bed_code: e.target.value })}>
              <option value="">Select</option>
              {beds.map((b) => (
                <option key={b.id} value={b.bed_code}>{b.bed_code} · {b.room_code}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ward</label>
            <input value={form.ward_code} onChange={(e) => setForm({ ...form, ward_code: e.target.value })} />
          </div>
          <div className="field">
            <label>Diagnosis code</label>
            <input value={form.diagnosis_code} onChange={(e) => setForm({ ...form, diagnosis_code: e.target.value })} placeholder="Optional ICD / disease code" />
          </div>
          <button type="submit">Admit patient</button>
        <ClinicalProfileFields type="ipd" values={admissionProfile} onChange={setAdmissionProfile} />
        </form>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Ward summary</h3>
          <p><strong>{active.length}</strong> active admissions</p>
          <p><strong>{beds.length}</strong> beds available</p>
          <p className="muted">Discharge generates an IPD invoice and releases the bed automatically.</p>
        </div>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Admissions</h3>
        <table>
          <thead>
            <tr><th>Admission</th><th>Patient</th><th>Bed</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {admissions.map((a) => (
              <tr key={a.id}>
                <td>{a.admission_no}</td>
                <td>{patientMap.get(a.patient_id) || a.patient_id.slice(0, 8)}</td>
                <td>{a.bed_code}</td>
                <td><span className="badge">{a.status}</span></td>
                <td>
                  {a.status !== "discharged" && (
                    <button type="button" className="secondary" onClick={() => discharge(a.id).catch((e) => setError(e.message))}>
                      Discharge & bill
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

