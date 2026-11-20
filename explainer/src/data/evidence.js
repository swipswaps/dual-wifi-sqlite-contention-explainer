export const evidence = {
  project: 'Audit USB Flasher & Dual-Wi-Fi / SQLite Contention Evidence',
  host: 'Fedora Linux 45',
  usbTarget: {
    historicalNode: '/dev/sdc',
    model: 'Lexar USB storage',
    serial: 'AA965P4BXZF7RLA1',
    warning: 'Historical node only; re-verify serial, model, size, and transport before any write.'
  },
  isoAudit: {
    artifact: 'omarchy-4.5.0-x86.iso',
    sha256: '5d6288bc…6978b00f',
    status: 'Digest matched expected value; complete acquisition, block write, and bootability were not confirmed.'
  },
  contentionNotes: [
    {
      title: 'Dual-Wi-Fi Contention',
      detail: 'Concurrent wireless operation across shared RF channels, antenna paths, or driver queues can introduce latency spikes and retries.'
    },
    {
      title: 'SQLite WAL Serialization',
      detail: 'Write-Ahead Logging permits concurrent readers with one writer; writers remain serialized and long read transactions can delay checkpoints.'
    },
    {
      title: 'Exit Status vs. Verified Outcome',
      detail: 'A zero exit status proves a command returned without error—not that target media boots or read-back bytes match.'
    },
    {
      title: 'Static Pages + Local Docker API',
      detail: 'GitHub Pages serves static files only; an optional local FastAPI + SQLite WAL/FTS5 service runs at http://127.0.0.1:8765.'
    }
  ]
};

export const pipelineStages = [
  { id: 'discover', title: '1. Whole-Disk Identity', detail: 'Inspect block devices via lsblk and udevadm by serial, model, capacity, and transport; never trust /dev/sdX names across sessions.' },
  { id: 'digest', title: '2. Source Provenance', detail: 'Confirm complete image download and compare SHA-256 against an independently published official checksum.' },
  { id: 'preflight', title: '3. Preflight & Mount Guards', detail: 'Block root/system disks, active swap, and mounted descendants; re-verify block type and byte capacity immediately before write.' },
  { id: 'write', title: '4. Explicit Destructive Write', detail: 'Require explicit confirmation and pass the verified target explicitly without --force bypasses.' },
  { id: 'readback', title: '5. Read-Back & Boot Test', detail: 'Verify read-back integrity and test booting on target hardware rather than inferring bootability from exit codes.' },
  { id: 'ledger', title: '6. WAL + FTS5 Audit Ledger', detail: 'Persist structured audit events in SQLite WAL mode with bounded busy_timeout and synchronized FTS5 search.' }
];

export const citations = [
  { label: 'Caligula Upstream Repository (ifd3f/caligula)', url: 'https://github.com/ifd3f/caligula' },
  { label: 'Linux Kernel Block Layer Documentation', url: 'https://docs.kernel.org/block/' },
  { label: 'Linux Wireless Documentation', url: 'https://wireless.docs.kernel.org/' },
  { label: 'util-linux lsblk(8) Manual', url: 'https://man7.org/linux/man-pages/man8/lsblk.8.html' },
  { label: 'util-linux findmnt(8) Manual', url: 'https://man7.org/linux/man-pages/man8/findmnt.8.html' },
  { label: 'GNU coreutils sha256sum Manual', url: 'https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html' },
  { label: 'SQLite Write-Ahead Logging (WAL)', url: 'https://sqlite.org/wal.html' },
  { label: 'SQLite FTS5 Extension', url: 'https://sqlite.org/fts5.html' },
  { label: 'SQLite Locking and Concurrency Control', url: 'https://sqlite.org/lockingv3.html' },
  { label: 'Python sqlite3 Standard Library', url: 'https://docs.python.org/3/library/sqlite3.html' },
  { label: 'FastAPI Docker Deployment Guide', url: 'https://fastapi.tiangolo.com/deployment/docker/' },
  { label: 'Docker Compose Documentation', url: 'https://docs.docker.com/compose/' },
  { label: 'Vite Static Deploy (GitHub Pages)', url: 'https://vite.dev/guide/static-deploy' },
  { label: 'Three.js WebGLRenderer Docs', url: 'https://threejs.org/docs/pages/WebGLRenderer.html' },
  { label: 'D3.js Documentation', url: 'https://d3js.org/getting-started' },
  { label: 'GitHub Pages Custom Workflows', url: 'https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages' }
];
