# Backend Async Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the FastAPI backend to use `async def` endpoints and a `ThreadPoolExecutor` for heavy image processing tasks, preventing the main server thread from blocking.

**Architecture:** We will introduce a global `ThreadPoolExecutor` in `server.py` and refactor the slow, CPU/IO-bound operations into helper functions. The FastAPI endpoints will be converted to `async def` and will use `asyncio.get_running_loop().run_in_executor()` to dispatch these helper functions.

**Tech Stack:** Python 3, FastAPI, asyncio, concurrent.futures

---

### Task 1: Setup ThreadPoolExecutor and async health check

**Files:**
- Modify: `backend/server.py`
- Test: `backend/test_server.py`

**Step 1: Write the failing test for async health check (optional, but good for TDD)**
Wait, health check is already there. Let's just modify the server to have the executor and ensure health check is async.

Let's do the actual tasks directly.

**Step 1: Update `server.py` imports and add Executor**
In `backend/server.py`, import `asyncio` and `concurrent.futures`. Create a global `executor`.

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

# ... after app = FastAPI()
executor = ThreadPoolExecutor(max_workers=4)
```

**Step 2: Convert `/health` to async**
```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 3: Run pytest to ensure server still starts and passes basic tests**
Run: `cd backend && pytest test_server.py -v`
Expected: PASS

**Step 4: Commit**
```bash
git add backend/server.py
git commit -m "chore(backend): add ThreadPoolExecutor and async health check"
```

---

### Task 2: Async Refactor for `/get_thumbnail`

**Files:**
- Modify: `backend/server.py`

**Step 1: Extract synchronous logic into a helper function**
In `backend/server.py`, create a `sync_get_thumbnail(request: ImagePath)` function that contains the current logic of `/get_thumbnail`.

```python
def sync_get_thumbnail(path: str) -> str:
    # move the existing logic of get_thumbnail here, return base64 string
    # handle is_raw, rawpy, cv2 resize, cv2 encode, base64 encode
    pass
```

**Step 2: Convert `/get_thumbnail` to async**
```python
@app.post("/get_thumbnail")
async def get_thumbnail(request: ImagePath):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        loop = asyncio.get_running_loop()
        img_b64 = await loop.run_in_executor(executor, sync_get_thumbnail, request.path)
        return {"image": f"data:image/jpeg;base64,{img_b64}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

**Step 3: Run tests to verify**
Run: `cd backend && pytest test_server.py -v`
Expected: PASS

**Step 4: Commit**
```bash
git add backend/server.py
git commit -m "refactor(backend): make /get_thumbnail async with thread pool"
```

---

### Task 3: Async Refactor for `/convert_image`

**Files:**
- Modify: `backend/server.py`

**Step 1: Extract synchronous logic into a helper function**
Create `sync_convert_image(request: ConvertRequest)` that returns a tuple of `(base64_string, histogram)`.

**Step 2: Convert `/convert_image` to async**
```python
@app.post("/convert_image")
async def convert_image(request: ConvertRequest):
    # path check
    # loop = asyncio.get_running_loop()
    # img_b64, hist = await loop.run_in_executor(executor, sync_convert_image, request)
    # return {"image": ..., "histogram": hist}
```

**Step 3: Run tests to verify**
Run: `cd backend && pytest test_server.py -v`
Expected: PASS

**Step 4: Commit**
```bash
git add backend/server.py
git commit -m "refactor(backend): make /convert_image async with thread pool"
```

---

### Task 4: Async Refactor for `/get_raw_preview` and `/export_image`

**Files:**
- Modify: `backend/server.py`

**Step 1: Extract logic and convert to async**
Follow the same pattern for `/get_raw_preview` and `/export_image`. Extract the heavy body into `sync_get_raw_preview` and `sync_export_image`, then await them via `run_in_executor`.

**Step 2: Run tests**
Run: `cd backend && pytest test_server.py -v`
Expected: PASS

**Step 3: Commit**
```bash
git add backend/server.py
git commit -m "refactor(backend): make preview and export endpoints async"
```
