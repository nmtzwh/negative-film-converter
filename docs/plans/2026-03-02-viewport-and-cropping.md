# Viewport Interaction & Cropping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement zooming, panning, "hold-to-compare" negative viewing, and non-destructive freeform cropping in the main React viewport.

**Architecture:** 
- Frontend uses React and pure CSS `transform: translate() scale()` for high-performance pan/zoom.
- Cropping is handled via an interactive SVG/HTML overlay that records normalized `[x1, y1, x2, y2]` coordinates, which are passed to the Python backend for final processing on export.
- A new `/get_raw_preview` backend endpoint returns a fast, downscaled base64 image of the un-converted negative to support the "Hold to Compare" feature instantly.

**Tech Stack:** React (TypeScript), CSS Transforms, FastAPI (Python), OpenCV, NumPy.

---

### Task 1: Backend "Raw Preview" Endpoint

**Goal:** Add a fast endpoint to fetch the original, un-converted negative image for the "Hold to Compare" feature.

**Files:**
- Modify: `backend/server.py`
- Modify: `src/api.ts`

**Step 1: Add the python endpoint**
In `backend/server.py`, add:
```python
@app.post("/get_raw_preview")
def get_raw_preview(request: ImagePath):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        if is_raw(request.path):
            with rawpy.imread(request.path) as raw:
                # Fast extract of un-converted data
                rgb = raw.postprocess(half_size=True, use_camera_wb=True, output_bps=8)
                bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        else:
            bgr = cv2.imread(request.path)
            if bgr is None:
                raise Exception("Failed to read image")
                
        # Resize to a reasonable preview size to keep base64 payload small (~1080p max)
        h, w = bgr.shape[:2]
        max_dim = 1080
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        success, encoded_image = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not success:
            raise HTTPException(status_code=500, detail="Failed to encode raw preview")
            
        img_b64 = base64.b64encode(encoded_image.tobytes()).decode('utf-8')
        return {"image": f"data:image/jpeg;base64,{img_b64}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

**Step 2: Add to src/api.ts**
```typescript
export async function getRawPreview(path: string): Promise<string> {
  const response = await fetch('http://localhost:8000/get_raw_preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error('Failed to get raw preview');
  const data = await response.json();
  return data.image;
}
```

**Step 3: Commit**
```bash
git add backend/server.py src/api.ts
git commit -m "feat(backend): add get_raw_preview endpoint for hold-to-compare"
```

### Task 2: Backend Cropping Support (Export)

**Goal:** Allow `/save_settings` to store crop data, and `/export_image` to physically apply the crop.

**Files:**
- Modify: `backend/server.py`
- Modify: `src/api.ts`

**Step 1: Update Models**
In `backend/server.py`:
Update `SettingsRequest` and `ExportRequest` to include `crop: list[float] | None = None`.

**Step 2: Update `save_settings` and `load_settings`**
Include `request.crop` in the json dump, and read it in `load_settings` (default `None`).

**Step 3: Apply Crop in `export_image`**
In `export_image`, right after `bgr_img = cv2.cvtColor(...)` and before `cv2.imwrite`:
```python
        # Apply physical crop if requested
        if request.crop:
            x_min, y_min, x_max, y_max = request.crop
            h, w = bgr_img.shape[:2]
            
            px_min = max(0, int(x_min * w))
            py_min = max(0, int(y_min * h))
            px_max = min(w, int(x_max * w))
            py_max = min(h, int(y_max * h))
            
            if px_max > px_min and py_max > py_min:
                bgr_img = bgr_img[py_min:py_max, px_min:px_max]
```

**Step 4: Update API Types**
In `src/api.ts`, add `crop?: number[] | null` to `Settings` interface, `saveSettings` signature, and `exportImage` signature.

**Step 5: Commit**
```bash
git add backend/server.py src/api.ts
git commit -m "feat(backend): support crop coordinates in settings and export"
```

### Task 3: React Viewport Zoom, Pan & Compare

**Goal:** Implement mouse-wheel zoom, drag-to-pan, and the `` key compare feature in `App.tsx`.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Step 1: Add CSS**
In `App.css`, ensure `.viewport img` has `transition: transform 0.1s ease-out;` (unless panning, where it should be 0s for responsiveness). Add classes to handle cursor changes.

**Step 2: Add State in App.tsx**
```typescript
const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
const [showOriginal, setShowOriginal] = useState(false);
const [scale, setScale] = useState(1);
const [pan, setPan] = useState({ x: 0, y: 0 });
const [isPanning, setIsPanning] = useState(false);
```

**Step 3: Load Raw Preview**
In the `loadFile` function, add a call to `getRawPreview(file)` in the background and set `rawImageUrl`.

**Step 4: Implement Zoom/Pan Handlers**
Add `onWheel`, `onMouseDown`, `onMouseMove`, `onMouseUp` to the viewport container to update `scale` and `pan` state. Prevent default browser scrolling.

**Step 5: Implement Hotkey**
Add `useEffect` for `keydown`/`keyup` listening for the `` key or `Spacebar` to toggle `showOriginal`.

**Step 6: Update Render**
Update the `<img>` tag:
- `src={showOriginal && rawImageUrl ? rawImageUrl : imageUrl}`
- `style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}`

**Step 7: Commit**
```bash
git add src/App.tsx src/App.css
git commit -m "feat(ui): add zoom, pan, and hold-to-compare to viewport"
```

### Task 4: UI Cropping Overlay

**Goal:** Build the visual bounding box overlay for defining crop coordinates.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/CropOverlay.tsx`

**Step 1: Build Component**
Create a `CropOverlay` component that receives the image dimensions, the current zoom/pan state, and an `onChange(crop: [x1, y1, x2, y2])` callback. It should render a semi-transparent dark border and 4 draggable corner handles.

**Step 2: Add UI Toggle**
In `App.tsx`, add a state `isCropping` and a button in the left sidebar to toggle it. Disable `isPickingBase` if `isCropping` is true.

**Step 3: Integrate Overlay**
Render `<CropOverlay>` inside the viewport over the image when `isCropping` is true. Update `handleImageClick` to ignore clicks if `isCropping` is active.

**Step 4: Connect to State**
When crop changes, update a local `crop` state in `App.tsx` and pass it to `saveSettings` and `exportImage`.

**Step 5: Commit**
```bash
git add src/App.tsx src/components/CropOverlay.tsx
git commit -m "feat(ui): implement non-destructive cropping overlay"
```
