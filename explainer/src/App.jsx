import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Download,
  HardDrive,
  Search,
  ShieldCheck
} from 'lucide-react';
import BootFlow from './components/BootFlow.jsx';
import ContentionChart from './components/ContentionChart.jsx';
import { citations, evidence, pipelineStages } from './data/evidence.js';

const READONLY_DIAGNOSTICS_CODE = `# READ-ONLY DIAGNOSTICS — performs no block device writes or unmounts.
lsblk --json --output NAME,PATH,TYPE,SIZE,MODEL,SERIAL,TRAN,RM,MOUNTPOINTS
udevadm info --query=property --name=/dev/sdX
findmnt --real --output SOURCE,TARGET,FSTYPE,OPTIONS
sqlite3 .audit-explainer-state/evidence.sqlite3 "PRAGMA journal_mode; PRAGMA busy_timeout;"`;

function CodeSample() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(READONLY_DIAGNOSTICS_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([READONLY_DIAGNOSTICS_CODE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'readonly-audit-diagnostics.sh';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="codebox">
      <div className="code-actions">
        <button type="button" onClick={handleCopy}>
          <Copy size={15} /> {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={handleDownload}>
          <Download size={15} /> Download
        </button>
      </div>
      <pre><code>{READONLY_DIAGNOSTICS_CODE}</code></pre>
    </div>
  );
}

function BackendPanel() {
  const [status, setStatus] = useState({
    state: 'checking',
    detail: 'Checking local Docker backend at http://127.0.0.1:8765/api/health…'
  });
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('audit');
  const [severity, setSeverity] = useState('info');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadEvents = async (searchTerm = '') => {
    const url = searchTerm.trim()
      ? `http://127.0.0.1:8765/api/search?q=${encodeURIComponent(searchTerm.trim())}`
      : 'http://127.0.0.1:8765/api/events?limit=20';
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    setEvents(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let active = true;

    const probe = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8765/api/health', {
          signal: AbortSignal.timeout(1800)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!active) return;
        setStatus({
          state: 'online',
          detail: `Docker backend online · SQLite ${data.sqlite} · FTS5 ${data.fts5 ? 'enabled' : 'unavailable'}`
        });
        await loadEvents();
      } catch {
        if (!active) return;
        setStatus({
          state: 'offline',
          detail: 'No local backend detected. Static explainer mode is active and complete.'
        });
      }
    };

    probe();
    const timer = setInterval(probe, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const submitEvent = async (e) => {
    e.preventDefault();
    setFeedback('');
    if (!message.trim()) return;
    try {
      const res = await fetch('http://127.0.0.1:8765/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category.trim() || 'audit',
          severity,
          message: message.trim()
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      setMessage('');
      setFeedback('Recorded event in SQLite WAL/FTS5.');
      await loadEvents(query);
    } catch (err) {
      setFeedback(`Error: ${err.message}`);
    }
  };

  const submitSearch = async (e) => {
    e.preventDefault();
    setFeedback('');
    try {
      await loadEvents(query);
    } catch (err) {
      setFeedback(`Search error: ${err.message}`);
    }
  };

  const isPagesHttps =
    window.location.protocol === 'https:' && window.location.hostname.endsWith('github.io');

  return (
    <div className="backend-wrap">
      <div className={`backend ${status.state}`}>
        <span className="pulse" />
        <div>
          <strong>Local backend: {status.state}</strong>
          <p>{status.detail}</p>
          {isPagesHttps && status.state === 'offline' && (
            <p>
              HTTPS GitHub Pages may block loopback HTTP probes under browser local-network
              policy. For local Docker SQLite API interaction, open{' '}
              <a className="local-link" href="http://127.0.0.1:5173/">http://127.0.0.1:5173 ↗</a>
            </p>
          )}
        </div>
      </div>

      {status.state === 'online' && (
        <div className="panel backend-tools">
          <h3>SQLite WAL + FTS5 Evidence Ledger</h3>
          <form className="event-form" onSubmit={submitEvent}>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="category"
              aria-label="Event category"
            />
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              aria-label="Event severity"
            >
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Record evidence note..."
              aria-label="Event message"
            />
            <button type="submit">Log Event</button>
          </form>

          <form className="search-form" onSubmit={submitSearch}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FTS5 index..."
              aria-label="Search FTS5 events"
            />
            <button type="submit"><Search size={15} /> Search</button>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                loadEvents('').catch(() => {});
              }}
            >
              Reset
            </button>
          </form>

          {feedback && <p className="feedback">{feedback}</p>}

          <ul className="event-list">
            {events.map((ev) => (
              <li key={ev.id}>
                <code>[{ev.severity}] {ev.category}</code> — {ev.message}{' '}
                <small>({ev.created_at})</small>
              </li>
            ))}
            {events.length === 0 && <li>No matching events recorded yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <main>
      <header className="hero">
        <div className="eyebrow">
          <ShieldCheck size={16} /> SYSTEMS &amp; EVIDENCE AUDIT EXPLAINER
        </div>
        <h1>Evidence before <span>write.</span></h1>
        <p className="lede">
          A systems explainer covering USB imaging verification gates, Dual-Wi-Fi and SQLite
          contention evidence, and an optional local Docker + SQLite WAL/FTS5 ledger.
        </p>
        <BackendPanel />
        <BootFlow />
        <div className="flow-labels">
          <span>Identity &amp; ISO</span>
          <span>Preflight guards</span>
          <span>Explicit write</span>
          <span>Read-back &amp; WAL</span>
        </div>
      </header>

      <section className="section">
        <div className="section-heading">
          <span>01 / RECORDED AUDIT BASELINE</span>
          <h2>Verified facts vs. unverified claims</h2>
        </div>
        <div className="evidence-grid">
          <article className="panel">
            <small>HOST ENVIRONMENT</small>
            <h3>{evidence.host}</h3>
            <p>Recorded host operating system from the prior audit session.</p>
          </article>
          <article className="panel">
            <small>HISTORICAL USB REFERENCE</small>
            <h3>{evidence.usbTarget.historicalNode}</h3>
            <p>{evidence.usbTarget.model} · serial <code>{evidence.usbTarget.serial}</code></p>
            <p className="warning">
              <AlertTriangle size={15} /> {evidence.usbTarget.warning}
            </p>
          </article>
          <article className="panel">
            <small>ISO ARTIFACT STATE</small>
            <h3>Partial / Unconfirmed</h3>
            <p>{evidence.isoAudit.status}</p>
            <code>{evidence.isoAudit.sha256}</code>
          </article>
          <article className="panel">
            <small>WRITE &amp; BOOT STATUS</small>
            <h3 className="amber">Not Established</h3>
            <p>A completed block write and verified boot test were not established in the log.</p>
          </article>
        </div>

        <div className="evidence-grid two spaced-grid">
          {evidence.contentionNotes.map((item) => (
            <article className="panel" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>

        <p className="callout">
          <CheckCircle2 size={18} /> Command syntax checks and single-step checks do not replace
          device re-identification, read-back verification, or boot testing.
        </p>
      </section>

      <section className="section">
        <div className="section-heading">
          <span>02 / PIPELINE STAGES</span>
          <h2>Six verification gates</h2>
        </div>
        <div className="stages">
          {pipelineStages.map((stage, idx) => (
            <article className="stage" key={stage.id}>
              <div className="stage-num">0{idx + 1}</div>
              <div>
                <h3>{stage.title}</h3>
                <p>{stage.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span>03 / READ-ONLY DIAGNOSTICS</span>
          <h2>Inspect before acting</h2>
        </div>
        <p className="lede small">
          Read-only inventory commands only; no partition unmounts or block device writes.
        </p>
        <CodeSample />
        <div className="note">
          <AlertTriangle size={18} />
          <p>
            <strong>Destructive operation warning:</strong> flashing overwrites target partitions and
            data irreversibly. Always confirm whole-disk identity, unmount target partitions cleanly,
            check disk size, and verify read-back results.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span>04 / SQLITE &amp; DUAL-WI-FI CONTENTION</span>
          <h2>Managing serialized writes and shared resources</h2>
        </div>
        <p>
          Shared wireless spectrum and serialized SQLite writes both experience contention spikes under
          load. WAL mode allows concurrent readers alongside a single writer, while{' '}
          <code>busy_timeout</code> and short transactions keep lock handling predictable.
        </p>
        <div className="panel chart-panel">
          <div className="chart-title">
            <Activity size={18} /> Illustrative contention latency series
            <small>SYNTHETIC DATA — NOT LIVE TELEMETRY</small>
          </div>
          <ContentionChart />
        </div>
        <div className="evidence-grid two spaced-grid">
          <article className="panel">
            <Database size={20} />
            <h3>WAL + Triggered FTS5</h3>
            <p>Keeps full-text search synchronized across inserts, updates, and deletes inside transactions.</p>
          </article>
          <article className="panel">
            <HardDrive size={20} />
            <h3>Docker Volume Persistence</h3>
            <p>Persists SQLite data in a named volume while binding strictly to 127.0.0.1:8765.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span>05 / ARCHITECTURE</span>
          <h2>Static GitHub Pages + optional local Docker API</h2>
        </div>
        <div className="panel">
          <h3>Service Topology</h3>
          <pre className="tree">{`Browser (GitHub Pages or localhost)
  └── optional http://127.0.0.1:8765
        └── FastAPI service
              └── SQLite database (/data volume)
                    ├── WAL journal mode
                    ├── FTS5 virtual table + triggers
                    └── indexed audit events`}</pre>
        </div>
      </section>

      <section className="section references">
        <div className="section-heading">
          <span>06 / REFERENCES</span>
          <h2>Primary documentation and upstream sources</h2>
        </div>
        <ol>
          {citations.map((c) => (
            <li key={c.url}>
              <a href={c.url} target="_blank" rel="noreferrer">{c.label}</a>
            </li>
          ))}
        </ol>
      </section>

      <footer>
        Audit USB Flasher &amp; Contention Evidence Explainer · Educational material; verify hardware and storage state directly.
      </footer>
    </main>
  );
}
