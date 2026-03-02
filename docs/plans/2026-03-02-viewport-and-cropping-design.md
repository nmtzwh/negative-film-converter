# Design: Viewport Interaction & Non-Destructive Cropping

## 1. Overview
This design outlines Phase 5 of the Negative Film Converter. It focuses on elevating the user experience of the main image viewport. It introduces professional-grade navigation (mouse-driven zoom and pan), a rapid "Hold to Compare" feature to view the original negative, and a non-destructive Freeform Cropping tool essential for removing unexposed film borders.

## 2. Core Features

### 2.1 Mouse/Trackpad Driven Zoom & Pan
- **Zooming:** Users can scroll the mouse wheel (or use a trackpad scroll gesture) to zoom in and out. The zoom will pivot around the current mouse cursor location.
- **Panning:** When zoomed in (`scale > 1.0`), clicking and dragging the image will pan the view within the bounding box of the viewport.
- **Reset:** Double-clicking the image will reset the zoom and pan back to the default "fit to screen" view.
- **Implementation:** This will be handled entirely on the frontend using CSS `transform: translate(x, y) scale(s)`. This avoids expensive backend round-trips and leverages hardware acceleration for smooth 60fps performance.

### 2.2 "Hold to Compare" (Before/After)
- Users can press and hold the `` (backslash) key to instantly swap the viewport to display the original, un-processed negative image.
- Upon releasing the key, the viewport reverts to the processed positive.
- An overlay badge (e.g., "Original Negative") will be displayed while the key is held.
- **Implementation:** The backend will generate a fast, downscaled base64 JPEG of the raw negative when an image is first loaded (via a new `/get_raw_preview` endpoint or added to the existing `/load_image` response). The frontend will cache this and toggle the `<img>` `src` attribute on keydown/keyup events.

### 2.3 Non-Destructive Freeform Cropping
- **UI Mode:** A new "Crop Image" toggle button in the left sidebar. When active, it overlays a resizable bounding box on top of the image.
- **Interaction:** Users can drag the corners or edges of the box to define a freeform crop area to remove film borders.
- **Data Flow (Non-Destructive):** 
  - The cropping is strictly visual in the UI. The backend continues to send the full, uncropped image for preview to maintain the mathematical integrity of the histogram and auto-levels.
  - The crop coordinates (normalized `0.0` to `1.0` representing `[x_min, y_min, x_max, y_max]`) are saved into the sidecar JSON file via the `POST /save_settings` endpoint.
- **Export Application:** The actual destruction/cropping of pixels only occurs during `POST /export_image`. The backend will read the crop coordinates, apply the conversion math to the full image, and then slice the resulting numpy array (`img[y1:y2, x1:x2]`) *before* encoding it to the final JPEG/TIFF.

## 3. UI/UX Changes
- **Viewport Component:** Needs refactoring to support absolute positioning of the image, the new crop overlay, and complex mouse event handling (wheel, mousedown, mousemove, mouseup).
- **Control Panel:** Add the "Crop Image" toggle. Update cursor states (crosshair for picking, grab for panning, default/resize-arrows for cropping).

## 4. API Changes
- **`POST /load_image` or `/get_raw_preview`:** Needs to return a base64 string of the unedited negative for the compare feature.
- **`SettingsRequest` & `ExportRequest`:** Add an optional `crop` parameter: `list[float] | None` (representing `[x_min, y_min, x_max, y_max]`).
- **`backend/server.py`:** Update the `/export_image` endpoint to slice the numpy array based on the `crop` parameter before saving to disk.
