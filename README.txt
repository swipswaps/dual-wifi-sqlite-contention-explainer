AUDIT USB FLASHER & CONTENTION EVIDENCE EXPLAINER
=================================================

OVERVIEW
--------
This repository provides an interactive React + Vite + Three.js + D3
explainer in explainer/ along with an optional local FastAPI + SQLite
(WAL + FTS5) backend in backend/ and docker-compose.yml.

No block device writes or USB imaging commands are executed by the frontend
or backend. State, backups, and setup logs stay inside the repository
directory.

BUILD & DEPLOYMENT WORKFLOW
---------------------------
Idempotent build script:
  bash scripts/build-explainer.sh

Local frontend build:
  cd explainer
  npm install
  npm run build

Optional local Docker SQLite backend:
  docker compose up --build -d
  curl http://127.0.0.1:8765/api/health
  docker compose down

REFERENCES
----------
https://github.com/ifd3f/caligula
https://docs.kernel.org/block/
https://wireless.docs.kernel.org/
https://man7.org/linux/man-pages/man8/lsblk.8.html
https://man7.org/linux/man-pages/man8/findmnt.8.html
https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html
https://sqlite.org/wal.html
https://sqlite.org/fts5.html
https://docs.python.org/3/library/sqlite3.html
https://fastapi.tiangolo.com/deployment/docker/
https://docs.docker.com/compose/
https://vite.dev/guide/static-deploy
https://threejs.org/docs/pages/WebGLRenderer.html
https://d3js.org/getting-started
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
