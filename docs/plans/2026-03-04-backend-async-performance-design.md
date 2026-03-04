# Backend Async Performance & Stability Design

## 1. Overview
The current Python FastAPI backend relies on synchronous endpoint functions (`def`) to handle heavy image processing tasks (RAW decoding, NumPy array manipulation, and Base64 encoding). This architecture causes the FastAPI server to block when multiple requests hit the server simultaneously, resulting in a degraded UI experience, especially when loading a folder full of RAW thumbnails. This design outlines refactoring the heavy computational endpoints to use asynchronous programming and an explicit thread pool to maintain server responsiveness.

## 2. Architecture & Components
To prevent the main thread from blocking, we will introduce:
- **Asynchronous Endpoints:** Change heavily loaded FastAPI endpoints (`/get_thumbnail`, `/convert_image`, `/get_raw_preview`, `/export_image`) from synchronous `def` to asynchronous `async def`.
- **Thread Pool Executor:** Initialize a dedicated `concurrent.futures.ThreadPoolExecutor` (or use the default asyncio executor). By running CPU-bound and I/O-bound `rawpy` and `cv2` operations in separate threads, the Python Global Interpreter Lock (GIL) impact is mitigated (especially since `numpy` and `cv2` release the GIL during heavy C++ extensions work).
- **Executor Dispatching:** Use `asyncio.get_running_loop().run_in_executor(executor, func, *args)` to offload synchronous image functions to worker threads.

## 3. Data Flow
1. **Frontend Request:** The Tauri React app requests multiple thumbnails or a single full-res conversion.
2. **FastAPI Reception:** FastAPI receives the HTTP POST request asynchronously.
3. **Task Delegation:** 
   - The `async def` endpoint encapsulates the heavy computation (e.g., `rawpy.imread`, `cv2.resize`, Base64 encoding) into a standard function block or lambda.
   - The main event loop delegates the function to a worker thread and `await`s its result.
4. **Processing in Worker:** The worker thread executes the heavy `rawpy`/`numpy` logic, keeping the main loop free to accept and route other incoming requests (like UI API health checks or lightweight state updates).
5. **Response Return:** Once the worker completes, the main loop resumes and sends the HTTP response (JSON with Base64 image) back to the UI.

## 4. Error Handling
- Exceptions raised in the worker threads will be propagated back to the `await` call in the async endpoint.
- The `async` endpoint will catch these exceptions (e.g., `rawpy.LibRawError`, `IOError`) and raise FastAPI `HTTPException`s (400 for bad files, 500 for server/encoding failures) to ensure the UI handles failures gracefully.

## 5. Testing Strategy
- Ensure all automated tests (`test_server.py`) continue to pass and return the correct Base64 payloads and histograms.
- Validate that rapid, repeated changes to the exposure slider (triggering many `/convert_image` POST requests) do not freeze the Tauri window.
- Verify that opening a folder with many RAW files loads thumbnails incrementally without locking the main thread.
