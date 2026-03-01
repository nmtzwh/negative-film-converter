# Negative Film Converter - Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement workflow features: Film Strip (folder browsing), Copy/Paste settings, Batch Export, and UI Polish.

---

### Task 1: Film Strip & Folder Browsing

**Goal:** Allow users to open a directory instead of just a single file, and display thumbnails of all RAW files in a bottom "film strip" panel.

**Files:**
- Modify: `backend/server.py`
- Modify: `src/api.ts`
- Modify: `src/App.tsx`
- Create: `src/components/FilmStrip.tsx`

**Steps:**
1. **Backend:** 
   - Add endpoint `POST /list_directory`: Accepts a directory path and returns a list of file paths (filtering for RAW extensions: `.arw`, `.dng`, `.nef`, `.cr2`, etc.).
   - Add endpoint `POST /get_thumbnail`: Accepts a file path, loads it quickly (e.g., using `rawpy` half-size or just first few lines if possible, or heavily scaled down), converts to a basic positive, and returns a small base64 JPEG for the strip.
2. **Frontend API:** Add `listDirectory` and `getThumbnail` to `src/api.ts`.
3. **UI Updates:**
   - Change "Open RAW File" button to a dropdown or add an "Open Folder" button using Tauri's dialog API with `directory: true`.
   - Create a `FilmStrip` component that renders a horizontal list of thumbnails based on the directory contents.
   - Clicking a thumbnail updates `currentFilePath` in `App.tsx` to load the full-res image.

### Task 2: State Persistence & Copy/Paste Settings

**Goal:** Save the current processing settings (exposure, base color) alongside the image, and allow copying these settings to other images in the film strip.

**Files:**
- Modify: `backend/server.py`
- Modify: `src/api.ts`
- Modify: `src/App.tsx`

**Steps:**
1. **Backend:**
   - Add `POST /save_settings` endpoint: Accepts `path`, `exposure`, `base_color`. Saves to a sidecar JSON file (e.g., `filename.json` next to `filename.arw`).
   - Add `POST /load_settings` endpoint: Checks for a sidecar JSON file and returns the settings if found.
2. **Frontend API:** Implement these new endpoints.
3. **UI Updates:**
   - Add "Copy Settings" and "Paste Settings" buttons to the control panel.
   - Add a `settingsClipboard` state to `App.tsx`.
   - When a new image is selected from the Film Strip, automatically call `/load_settings`. If they exist, apply them; otherwise, use defaults.
   - Automatically trigger `/save_settings` when the user stops dragging the exposure slider or picks a new base color (perhaps debounced).

### Task 3: Batch Export

**Goal:** Allow the user to export the current image, or all images in the film strip, to high-quality JPEGs in a target directory.

**Files:**
- Modify: `backend/server.py`
- Modify: `src/api.ts`
- Modify: `src/App.tsx`

**Steps:**
1. **Backend:**
   - Add `POST /export_image` endpoint: Accepts `path`, `output_dir`, `exposure`, `base_color`. Runs the full conversion and uses `cv2.imwrite` to save a high-quality JPEG (or TIFF) to the target directory.
2. **Frontend API:** Add the corresponding function.
3. **UI Updates:**
   - Add an "Export Current" button.
   - Add a "Batch Export All" button.
   - Both should use Tauri's dialog API to ask the user to select an output folder (`open({ directory: true })`), then loop through the required images and call `/export_image` for each.
   - Add a progress indicator for batch exports.

### Task 4: UI Polish

**Goal:** Make the application look like a cohesive, professional tool.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Histogram.tsx`
- Create: `src/index.css` (or modify `App.css`)

**Steps:**
1. Refactor inline styles into clean CSS classes or standard styling approach.
2. Ensure the layout strictly follows a classic photo editor layout (Header, Left/Right Sidebars, Center Viewport, Bottom Film Strip).
3. Add tooltips, loading spinners, and disabled states.
4. Ensure dark mode consistency.
