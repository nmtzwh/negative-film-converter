# Negative Film Converter - Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish the project structure, configure the Tauri + Python sidecar architecture, and implement basic RAW image loading.

**Architecture:** Tauri v2 frontend (React/TS) communicating with a Python backend process via standard I/O or local HTTP. For this phase, we will use **HTTP over localhost** as it's more robust for image data transfer. The Python backend will be a FastAPI server.

**Tech Stack:** Tauri 2.0, React, TypeScript, Python 3.11+, FastAPI, Uvicorn, Rawpy, NumPy.

---

### Task 1: Project Initialization

**Files:**
- Create: `src-tauri/tauri.conf.json` (modified)
- Create: `src/App.tsx` (basic)
- Create: `package.json`

**Step 1: Initialize Tauri Project**
- Run: `npm create tauri-app@latest . -- --template react-ts --manager npm -y`
- Run: `npm install`
- Verify: `npm run tauri dev` starts the app.

**Step 2: Clean up Template**
- Delete: `src/assets/react.svg`, `src/App.css` (content)
- Modify: `src/App.tsx` to just have a "Hello World" heading.

**Step 3: Commit**
- `git add .`
- `git commit -m "chore: initialize tauri project"`

### Task 2: Python Backend Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/server.py`
- Create: `backend/test_server.py`

**Step 1: Create Backend Directory & Venv**
- Run: `mkdir backend`
- Run: `python3 -m venv backend/venv`
- Run: `source backend/venv/bin/activate`

**Step 2: Install Dependencies**
- Create `backend/requirements.txt`:
  ```text
  fastapi==0.109.0
  uvicorn[standard]==0.27.0
  rawpy==0.19.1
  numpy==1.26.3
  opencv-python-headless==4.9.0.80
  pytest==8.0.0
  httpx==0.26.0
  ```
- Run: `pip install -r backend/requirements.txt`

**Step 3: Create Basic Server**
- Create `backend/server.py` with a simple `/health` endpoint and a `/process` endpoint (stub).
  ```python
  from fastapi import FastAPI
  import uvicorn

  app = FastAPI()

  @app.get("/health")
  def health():
      return {"status": "ok"}

  if __name__ == "__main__":
      uvicorn.run(app, host="127.0.0.1", port=8000)
  ```

**Step 4: Test Server**
- Create `backend/test_server.py`:
  ```python
  from fastapi.testclient import TestClient
  from server import app

  client = TestClient(app)

  def test_health():
      response = client.get("/health")
      assert response.status_code == 200
      assert response.json() == {"status": "ok"}
  ```
- Run: `pytest backend/test_server.py`

**Step 5: Commit**
- `git add backend/`
- `git commit -m "feat: setup python backend with fastapi"`

### Task 3: Tauri Sidecar Configuration

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/lib.rs` (or `main.rs`)
- Create: `src-tauri/python_sidecar.sh` (wrapper for dev)

**Step 1: Create Sidecar Wrapper**
- Create `src-tauri/python_sidecar.sh`:
  ```bash
  #!/bin/bash
  # Wrapper to run the python server from the venv
  # In production, this will be the compiled binary
  DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  source "$DIR/../backend/venv/bin/activate"
  python "$DIR/../backend/server.py"
  ```
- Run: `chmod +x src-tauri/python_sidecar.sh`

**Step 2: Configure Tauri**
- Modify `src-tauri/tauri.conf.json`:
  - Add `shell` to `allowlist` (or `permissions` in v2).
  - Add `python_sidecar` to `bundle > externalBin`.
  - *Note: Tauri v2 permission system is different. We might need to create a capability file.*
  - For v2: Create `src-tauri/capabilities/default.json` enabling `shell:allow-open` and `shell:allow-execute`.

**Step 3: Spawn Sidecar in Rust**
- Modify `src-tauri/src/lib.rs`:
  - Use `tauri::api::process::Command` (v1) or `tauri_plugin_shell` (v2) to spawn the sidecar on startup.
  - Ensure it kills the child process on exit.

**Step 4: Verify Sidecar Starts**
- Run: `npm run tauri dev`
- Check terminal output or `ps aux | grep python` to see if `server.py` is running.

**Step 5: Commit**
- `git add src-tauri/`
- `git commit -m "feat: configure tauri sidecar"`

### Task 4: Frontend-Backend Communication

**Files:**
- Modify: `src/App.tsx`
- Create: `src/api.ts`

**Step 1: specific API Client**
- Create `src/api.ts`:
  - Function `checkHealth()` that does a `fetch('http://localhost:8000/health')`.
  - *Note: We need to handle the port. For now, hardcode 8000 or pass it via env var.*

**Step 2: Connect UI**
- Modify `src/App.tsx`:
  - Add a `useEffect` to call `checkHealth()` on mount.
  - Display "Backend Status: Connected" (green) or "Disconnected" (red).

**Step 3: Test Communication**
- Run: `npm run tauri dev`
- Verify the UI shows "Connected".

**Step 4: Commit**
- `git add src/`
- `git commit -m "feat: connect frontend to backend"`

### Task 5: Basic RAW Loading

**Files:**
- Modify: `backend/server.py`
- Modify: `src/App.tsx`
- Modify: `src/api.ts`

**Step 1: Backend RAW Logic**
- Update `backend/server.py`:
  - Add `import rawpy`
  - Add endpoint `POST /load_image`:
    - Accepts `{ "path": str }`.
    - Uses `rawpy.imread(path)` to open.
    - Returns `{ "width": int, "height": int, "camera_white_balance": list }`.
    - *Handle errors gracefully.*

**Step 2: Frontend File Selection**
- Modify `src/App.tsx`:
  - Add a "Open File" button using `tauri-plugin-dialog` (or HTML input for now, but dialog is better for local paths).
  - *Note: HTML input file usually gives a fake path in browser, but Tauri might handle it. Best to use Tauri's dialog API.*
  - Install: `npm install @tauri-apps/plugin-dialog`
  - setup `open()` from `@tauri-apps/plugin-dialog`.

**Step 3: Integrate**
- When file selected, call `api.loadImage(path)`.
- Display the returned metadata (Width, Height, WB) in the UI.

**Step 4: Test with Dummy RAW**
- *Since we don't have a real RAW file easily available, we can mock `rawpy` or try to download a sample one.*
- *Better: Create a unit test in Python that mocks `rawpy` to ensure the endpoint logic is correct.*

**Step 5: Commit**
- `git add .`
- `git commit -m "feat: implement basic raw loading"`
