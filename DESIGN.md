# Negative Film Converter - Design Document

## 1. Overview
A modern, cross-platform desktop application for converting RAW negative film scans into high-quality positives. The app focuses on color accuracy, batch processing efficiency, and providing advanced control over the inversion process using industry-standard scientific libraries.

## 2. Architecture
The application uses a **Modern Hybrid** architecture:
- **Frontend (UI):** **Tauri v2** + **React (TypeScript)** + **Vite**.
  - Provides a responsive, modern interface with hardware-accelerated rendering.
  - Manages user interaction, state, and file selection.
- **Backend (Engine):** **Python 3** (packaged as a standalone executable via PyInstaller).
  - Acts as a "Sidecar" process spawned by Tauri.
  - Exposes a lightweight local HTTP API (FastAPI) for communication.
  - Handles all heavy image processing using `rawpy`, `numpy`, and `opencv-python`.

### Communication Flow
1. **User Action:** User opens a RAW file in the React UI.
2. **Frontend Request:** React sends a `POST /process` request to the Python backend with the file path and current parameters.
3. **Backend Processing:**
   - Python loads the RAW file using `rawpy`.
   - Applies the "Inversion Pipeline" (see below).
   - Generates a preview JPEG (base64 encoded) and histogram data.
4. **Frontend Update:** React receives the preview and updates the viewport.

## 3. Core Features

### 3.1. Image Processing Pipeline (The "Engine")
The Python backend implements a strict, non-destructive pipeline:
1. **Raw Loading:** Decode RAW file to linear floating-point RGB (demosaiced, no auto-white balance).
2. **Film Base Equalization (Auto/Manual):**
   - **Manual:** User picks a neutral "film base" color (orange mask) from the unexposed border.
   - **Auto:** Analyze image edges or histogram minima to detect the mask automatically.
   - **Operation:** Subtract the base color from the image to neutralize the mask.
3. **Inversion:** Invert the linear data (`1.0 - pixel`).
4. **Channel Alignment (Advanced Curve Fitting):**
   - Analyze per-channel histograms to align the Red, Green, and Blue channels.
   - Automatically set Black and White points to maximize dynamic range without clipping.
5. **Grading & Correction:**
   - **Exposure:** Linear gain adjustment.
   - **White Balance:** Temperature/Tint sliders (applied in linear space).
   - **Contrast/Gamma:** Standard gamma correction.
6. **Output Generation:** Convert to sRGB for display/export.

### 3.2. User Interface (UI)
- **Main Workspace:**
  - Large, zoomable preview area.
  - "Before/After" split view (optional).
- **Control Panel (Right Sidebar):**
  - **Calibration:** "Pick Film Base" dropper tool.
  - **Basic:** Exposure, Contrast, Temperature, Tint sliders.
  - **Curves:** RGB Curve editor for fine-tuning.
  - **History:** Undo/Redo stack.
- **Film Strip (Bottom Panel):**
  - Horizontal scroll of thumbnails for all images in the current folder.
  - **Batch Tools:** "Copy Settings" / "Paste Settings" / "Sync All".

### 3.3. Data Persistence & Export
- **Non-Destructive Editing:**
  - Settings are saved as lightweight JSON sidecar files (`filename.json`) next to the original RAWs.
  - The original RAW file is never modified.
- **Export:**
  - Formats: JPEG (sRGB), TIFF (16-bit AdobeRGB/ProPhoto).
  - Batch export capability.

## 4. Technology Stack

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **App Shell** | **Tauri v2** | Lightweight, secure, native OS integration. |
| **Frontend** | **React + TypeScript** | Modern component-based UI, rich ecosystem. |
| **Styling** | **Tailwind CSS** (v3/v4) | Rapid UI development, consistent design system. |
| **Backend API** | **FastAPI (Python)** | High-performance, easy to type-check, robust. |
| **Image Libs** | **rawpy, numpy, opencv** | Industry standard for scientific image processing. |
| **Packaging** | **PyInstaller** | Bundles Python into a single executable for distribution. |

## 5. Development Phases

### Phase 1: Prototype (MVP)
- [ ] Setup Tauri + React + Python project structure.
- [ ] Implement basic RAW loading and display (no processing).
- [ ] Implement "Simple Inversion" (Invert + Auto Levels).
- [ ] Add basic Exposure slider.

### Phase 2: Core Processing
- [ ] Implement "Film Base Picker" (Manual WB).
- [ ] Implement "Advanced Curve Fitting" (Auto-Channel Alignment).
- [ ] Add Histogram view.

### Phase 3: Workflow Features
- [ ] Implement Film Strip (folder browsing).
- [ ] Add Copy/Paste settings.
- [ ] Implement Batch Export.
- [ ] Polish UI/UX.
