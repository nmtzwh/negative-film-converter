# Negative Film Converter - Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement core processing features: Film Base Picker (Manual WB), Advanced Curve Fitting (Auto-Channel Alignment), and a Histogram view.

---

### Task 1: API Updates for Core Features

**Files:**
- Modify: `backend/server.py`
- Modify: `src/api.ts`

**Steps:**
1. Update `ConvertRequest` in `backend/server.py` to accept:
   - `base_color: list[float] | None = None`
2. Update `convertImage` in `src/api.ts` to include `baseColor` parameter.
3. Update `convert_image` endpoint in `backend/server.py` to return both the image AND histogram data (or create a separate endpoint for histogram data). Since we are currently returning an image directly, it's better to create a separate `/histogram` endpoint or return a JSON with a base64 encoded image and the histogram data.
   - Let's update `convert_image` to return a JSON response containing:
     - `image`: base64 encoded jpeg string.
     - `histogram`: array of 3 arrays (R, G, B), each containing 256 integers representing bin counts.

### Task 2: Histogram View

**Files:**
- Create: `src/components/Histogram.tsx`
- Modify: `src/App.tsx`
- Modify: `src/api.ts`
- Modify: `backend/server.py`

**Steps:**
1. Backend: Modify `/convert_image` to return JSON with base64 image and histogram data. Calculate the histogram on the *final* positive image.
2. Frontend API: Update `convertImage` return type to `{ imageUrl: string, histogram: number[][] }`.
3. Frontend Component: Create a generic `Histogram` React component using a canvas or simple SVG to draw the R, G, B arrays overlapping or stacked.
4. Integrate: Add the `Histogram` component to the UI layout in `App.tsx`.

### Task 3: Film Base Picker (Manual White Balance)

**Files:**
- Modify: `src/App.tsx`

**Steps:**
1. Add a "Pick Film Base" toggle button to the UI.
2. When active, clicking on the image preview should capture the click coordinates.
3. Since the image preview is scaled, we need to map the click coordinates back to the original image dimensions.
4. Call a new backend endpoint (e.g., `POST /sample_color`) passing the path and coordinates.
5. Backend reads the RAW, applies basic linear conversion, samples the color at the coordinate (maybe a 5x5 average), and returns the RGB values.
6. Frontend stores this `baseColor` in state and triggers a re-conversion, passing it in the `convertImage` request.

### Task 4: Advanced Curve Fitting (Refinement)

**Files:**
- Modify: `backend/converter.py`

**Steps:**
1. The channel alignment we added in Phase 1 is a form of Auto-Channel Alignment. We can refine it here or add a toggle to enable/disable it.
2. Ensure the "Film Base Picker" bypasses the auto-edge detection if a manual `base_color` is provided. (Already handled in `converter.py`, but let's ensure the UI hooks it up correctly).
