import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  DEMO_LOGIN,
  DEMO_TOUR_PHASES,
  DEMO_TOUR_STEPS,
  totalTourDurationMin,
  type DemoTourStep,
} from "../data/demoTourScript";

export default function DemoTourPage() {
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const [stepIndex, setStepIndex] = useState(0);
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [rate, setRate] = useState(0.95);
  const [msg, setMsg] = useState("");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playingRef = useRef(false);

  const filteredSteps = useMemo(
    () => (phaseFilter === "all" ? DEMO_TOUR_STEPS : DEMO_TOUR_STEPS.filter((s) => s.phaseId === phaseFilter)),
    [phaseFilter]
  );

  const step: DemoTourStep = filteredSteps[stepIndex] ?? filteredSteps[0];
  const globalIndex = DEMO_TOUR_STEPS.findIndex((s) => s.id === step?.id);

  const stopVoice = useCallback(() => {
    window.speechSynthesis.cancel();
    utterRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      stopVoice();
      if (!voiceOn || !window.speechSynthesis) {
        onEnd?.();
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google"))
        || voices.find((v) => v.lang.startsWith("en"));
      if (preferred) u.voice = preferred;
      u.onend = () => {
        utterRef.current = null;
        onEnd?.();
      };
      u.onerror = () => onEnd?.();
      utterRef.current = u;
      window.speechSynthesis.speak(u);
    },
    [rate, stopVoice, voiceOn]
  );

  const playStep = useCallback(
    (idx: number, steps: DemoTourStep[]) => {
      const s = steps[idx];
      if (!s) return;
      speak(s.narration, () => {
        if (playingRef.current && autoAdvance && idx < steps.length - 1) {
          setTimeout(() => setStepIndex(idx + 1), 800);
        } else if (playingRef.current && idx >= steps.length - 1) {
          playingRef.current = false;
          setPlaying(false);
          setMsg("Tour complete");
        }
      });
    },
    [autoAdvance, speak]
  );

  useEffect(() => {
    if (playing && step) {
      playStep(stepIndex, filteredSteps);
    }
    return () => stopVoice();
  }, [playing, stepIndex, phaseFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStepIndex(0);
  }, [phaseFilter]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  function togglePlay() {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      stopVoice();
    } else {
      playingRef.current = true;
      setPlaying(true);
      playStep(stepIndex, filteredSteps);
    }
  }

  function exportScript() {
    const text = DEMO_TOUR_STEPS.map(
      (s, i) =>
        `## ${i + 1}. ${s.title} (${s.phaseName})\n` +
        `Route: ${s.route}\n\n` +
        `VOICE:\n${s.narration}\n\n` +
        `NAVIGATE:\n${s.navigate.map((n) => `- ${n}`).join("\n")}\n\n` +
        `ENTER DATA:\n${s.enterData.length ? s.enterData.map((n) => `- ${n}`).join("\n") : "- (view demo data)"}\n\n` +
        `DEMO DATA:\n${s.demoData.map((n) => `- ${n}`).join("\n")}\n`
    ).join("\n---\n\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "SUMAYA_Care_360_Demo_Video_Script.md";
    a.click();
  }

  if (!step) return null;

  return (
    <div className="demo-tour">
      <div className="demo-tour-hero card">
        <h1 className="page-title" style={{ marginTop: 0 }}>Voice demo tour</h1>
        <p className="muted">
          Full platform walkthrough · {DEMO_TOUR_STEPS.length} scenes · ~{totalTourDurationMin} min · browser voice narration
        </p>
        <div className="demo-tour-login">
          <strong>Login:</strong>{" "}
          <a href={DEMO_LOGIN.url} target="_blank" rel="noreferrer">{DEMO_LOGIN.url}</a>
          {" · "}{DEMO_LOGIN.email} / {DEMO_LOGIN.password} · tenant <code>{DEMO_LOGIN.tenant}</code>
        </div>
      </div>

      <div className="demo-tour-controls card">
        <div className="actions" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" onClick={togglePlay}>{playing ? "⏸ Pause voice" : "▶ Play voice tour"}</button>
          <button type="button" className="secondary" disabled={stepIndex <= 0} onClick={() => { setStepIndex((i) => i - 1); setPlaying(false); playingRef.current = false; stopVoice(); }}>← Previous</button>
          <button type="button" className="secondary" disabled={stepIndex >= filteredSteps.length - 1} onClick={() => { setStepIndex((i) => i + 1); setPlaying(false); playingRef.current = false; stopVoice(); }}>Next →</button>
          <button type="button" className="secondary" onClick={() => speak(step.narration)}>🔊 Replay scene</button>
          <Link to={`${prefix}${step.route}`} className="button-link secondary">Open this screen ↗</Link>
          <button type="button" className="secondary" onClick={exportScript}>Download video script</button>
        </div>
        <div className="grid-2" style={{ marginTop: "1rem" }}>
          <label className="field" style={{ margin: 0 }}>
            <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} /> Voice narration
          </label>
          <label className="field" style={{ margin: 0 }}>
            <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} /> Auto-advance scenes
          </label>
          <label className="field">
            Speech speed ({rate.toFixed(2)})
            <input type="range" min={0.7} max={1.2} step={0.05} value={rate} onChange={(e) => setRate(+e.target.value)} />
          </label>
          <label className="field">
            Chapter
            <select value={phaseFilter} onChange={(e) => { setPhaseFilter(e.target.value); setPlaying(false); playingRef.current = false; stopVoice(); }}>
              <option value="all">All chapters ({DEMO_TOUR_STEPS.length})</option>
              {DEMO_TOUR_PHASES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="demo-tour-progress">
          Scene {stepIndex + 1} of {filteredSteps.length}
          {globalIndex >= 0 && <span className="muted"> · global {globalIndex + 1}/{DEMO_TOUR_STEPS.length}</span>}
          <div className="demo-tour-bar"><div style={{ width: `${((stepIndex + 1) / filteredSteps.length) * 100}%` }} /></div>
        </div>
        {msg && <div className="success">{msg}</div>}
      </div>

      <div className="grid-2">
        <div className="card demo-tour-scene">
          <span className="badge">{step.phaseName}</span>
          <h2 style={{ marginTop: "0.5rem" }}>{step.title}</h2>
          <p className="demo-tour-narration">{step.narration}</p>
          <h4>How to navigate</h4>
          <ol>{step.navigate.map((n) => <li key={n}>{n}</li>)}</ol>
          {step.enterData.length > 0 && (
            <>
              <h4>Enter data (try this)</h4>
              <ol>{step.enterData.map((n) => <li key={n}>{n}</li>)}</ol>
            </>
          )}
        </div>
        <div className="card demo-tour-data">
          <h3 style={{ marginTop: 0 }}>Demo data loaded</h3>
          <ul>{step.demoData.map((d) => <li key={d}>{d}</li>)}</ul>
          <h4>Quick jump</h4>
          <div className="actions" style={{ flexWrap: "wrap" }}>
            {filteredSteps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={i === stepIndex ? "" : "secondary"}
                style={{ fontSize: "0.75rem" }}
                onClick={() => { setStepIndex(i); setPlaying(false); playingRef.current = false; stopVoice(); }}
              >
                {i + 1}. {s.title.slice(0, 22)}{s.title.length > 22 ? "…" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>How demo data is organized</h3>
        <div className="grid-2">
          <div>
            <h4>PostgreSQL layers</h4>
            <ul>
              <li><strong>Clinical core</strong> — patients, appointments, encounters, vitals, notes</li>
              <li><strong>Diagnostics</strong> — lab_orders, radiology_orders, pharmacy_dispenses</li>
              <li><strong>Inpatient</strong> — ipd_admissions, nursing_tasks, ot_procedures, triage</li>
              <li><strong>Finance</strong> — invoices, payments, insurance_claims</li>
              <li><strong>Platform</strong> — module_records (48 items), notifications, location, documents</li>
            </ul>
          </div>
          <div>
            <h4>Navigation structure</h4>
            <ul>
              <li><strong>10 phases</strong> in sidebar — Platform → Front office → Clinical → … → Analytics</li>
              <li><strong>36 modules</strong> each with route + API + submodule tabs</li>
              <li><strong>Care journey</strong> links patient → billing in order</li>
              <li><strong>Demo replay</strong> — Dashboard → Load demo data (8 patients, all modules)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
