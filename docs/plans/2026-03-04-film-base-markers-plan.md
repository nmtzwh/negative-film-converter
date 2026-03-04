# Film Base Markers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the "Pick Film Base" feature by visualizing the selected reference points with high-contrast markers over the image and persisting them to per-photo configuration files.

**Architecture:** 
1. Expand the backend `SettingsRequest` schema and file parsing to handle `base_color_samples`.
2. Expand the frontend API types and history state to use the new `{color, x, y}` format.
3. Build a React component `BaseColorMarkers` that accurately overlays crosshairs onto the image leveraging `object-fit: contain` logic.
4. Integrate the new component into `App.tsx` and map clicks to the new state shape.

**Tech Stack:** Python (FastAPI, Pydantic), React (TypeScript)

---

### Task 1: Update Backend Settings Model

**Files:**
- Modify: `backend/server.py`
- Modify: `backend/test_server.py`

**Step 1: Write the failing tests**

```python
# Add to backend/test_server.py
def test_save_settings_with_samples(client, tmp_path):
    img_path = tmp_path / "test.jpg"
    img_path.touch()
    
    samples = [{"color": [255, 200, 150], "x": 0.5, "y": 0.5}]
    req = {
        "path": str(img_path),
        "exposure": 1.0,
        "base_color_samples": samples
    }
    resp = client.post("/save_settings", json=req)
    assert resp.status_code == 200
    
    import json
    with open(str(img_path) + ".json", "r") as f:
        data = json.load(f)
        assert data["base_color_samples"] == samples

def test_load_settings_with_samples(client, tmp_path):
    img_path = tmp_path / "test2.jpg"
    img_path.touch()
    
    samples = [{"color": [255, 200, 150], "x": 0.5, "y": 0.5}]
    import json
    with open(str(img_path) + ".json", "w") as f:
        json.dump({"exposure": 1.0, "base_color_samples": samples}, f)
        
    resp = client.post("/load_settings", json={"path": str(img_path)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["base_color_samples"] == samples
```

**Step 2: Run test to verify it fails**

Run: `cd backend && venv/bin/pytest test_server.py::test_save_settings_with_samples test_server.py::test_load_settings_with_samples -v`
Expected: FAIL due to missing fields in `SettingsRequest` and `load_settings` response.

**Step 3: Write minimal implementation**

Modify `backend/server.py` around line 45:
```python
class SettingsRequest(BaseModel):
    path: str
    exposure: float = 0.0
    base_color: list[float] | None = None
    base_color_samples: list[dict] | None = None  # Add this line
    crop: list[float] | None = None
    user_curves: dict | None = None
```

Modify `save_settings` in `backend/server.py` around line 165:
```python
        settings = {
            "exposure": request.exposure,
            "base_color": request.base_color,
            "base_color_samples": request.base_color_samples, # Add this line
            "crop": request.crop,
            "user_curves": request.user_curves
        }
```

Modify `load_settings` in `backend/server.py` around line 186:
```python
            return {
                "exposure": settings.get("exposure", 0.0),
                "base_color": settings.get("base_color", None),
                "base_color_samples": settings.get("base_color_samples", []), # Add this line
                "crop": settings.get("crop", None),
                "user_curves": settings.get("user_curves", None)
            }
```

**Step 4: Run test to verify it passes**

Run: `cd backend && venv/bin/pytest test_server.py::test_save_settings_with_samples test_server.py::test_load_settings_with_samples -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/server.py backend/test_server.py
git commit -m "feat(backend): support base_color_samples in settings endpoints"
```

---

### Task 2: Update Frontend API and Types

**Files:**
- Modify: `src/api.ts`
- Modify: `src/hooks/useHistory.ts`

**Step 1: Write the failing type usage (mental check or test file)**
There are no frontend unit tests configured for these API interfaces, but TypeScript will fail to compile if we use the new fields without defining them.

**Step 2: Write minimal implementation**

Modify `src/api.ts` around line 135 to update `Settings`:
```typescript
export interface ColorSample {
  color: number[];
  x: number;
  y: number;
}

export interface Settings {
  exposure: number;
  base_color: number[] | null;
  base_color_samples?: ColorSample[] | null; // Add this line
  crop?: number[] | null;
  user_curves?: Curves | null;
}
```

Modify `saveSettings` signature and body in `src/api.ts` around line 142:
```typescript
export async function saveSettings(path: string, exposure: number, baseColor: number[] | null, baseColorSamples?: ColorSample[] | null, crop?: number[] | null, userCurves?: Curves | null): Promise<void> {
  const response = await fetch('http://localhost:8000/save_settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, exposure, base_color: baseColor, base_color_samples: baseColorSamples, crop, user_curves: userCurves }),
  });
```

Modify `src/hooks/useHistory.ts` around line 7 to use the new type:
```typescript
import { Curves, ColorSample } from '../api'; // add ColorSample to imports

export interface HistoryState {
  exposure: number;
  baseColor: number[] | null;
  baseColorSamples: ColorSample[]; // changed from number[][]
  crop: number[] | null;
  userCurves: Curves | null;
}
```

**Step 3: Run type check**
Run: `npm run tsc` (Note: this will show errors in `App.tsx` because we haven't updated it yet, which is expected. We just want to ensure `api.ts` and `useHistory.ts` syntax is correct).

**Step 4: Commit**

```bash
git add src/api.ts src/hooks/useHistory.ts
git commit -m "feat(frontend): update api and history types for color samples"
```

---

### Task 3: Build BaseColorMarkers Component

**Files:**
- Create: `src/components/BaseColorMarkers.tsx`

**Step 1: Write component code**

Create `src/components/BaseColorMarkers.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import { ColorSample } from '../api';

interface BaseColorMarkersProps {
  samples: ColorSample[];
  imgRef: React.RefObject<HTMLImageElement | null>;
  scale: number;
  pan: { x: number, y: number };
}

export function BaseColorMarkers({ samples, imgRef, scale, pan }: BaseColorMarkersProps) {
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0, top: 0, left: 0 });

  useEffect(() => {
    const updateLayout = () => {
      if (!imgRef.current) return;
      const img = imgRef.current;
      
      const elRect = img.getBoundingClientRect();
      const elWidth = elRect.width / scale; 
      const elHeight = elRect.height / scale;

      if (elWidth <= 0 || elHeight <= 0 || !img.naturalWidth) return;

      const viewRatio = elWidth / elHeight;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      
      let renderedWidth = elWidth;
      let renderedHeight = elHeight;

      if (viewRatio > imgRatio) {
        renderedWidth = elHeight * imgRatio;
      } else {
        renderedHeight = elWidth / imgRatio;
      }

      setImgLayout({ 
        width: renderedWidth, 
        height: renderedHeight,
        top: 0,
        left: 0
      });
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    if (imgRef.current && imgRef.current.complete) {
        updateLayout();
    } else if (imgRef.current) {
        imgRef.current.addEventListener('load', updateLayout);
    }
    
    return () => {
      window.removeEventListener('resize', updateLayout);
      if (imgRef.current) {
          imgRef.current.removeEventListener('load', updateLayout);
      }
    };
  }, [imgRef, imgRef.current?.src, scale]);

  if (samples.length === 0 || imgLayout.width === 0) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: imgLayout.width,
          height: imgLayout.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          pointerEvents: 'none',
          transformOrigin: 'center center',
        }}
      >
        {samples.map((sample, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${sample.x * 100}%`,
              top: `${sample.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '16px',
              height: '16px',
            }}
          >
            {/* Crosshair lines */}
            <div style={{ position: 'absolute', top: '7px', left: 0, right: 0, height: '2px', backgroundColor: 'white', boxShadow: '0 0 2px black' }} />
            <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', backgroundColor: 'white', boxShadow: '0 0 2px black' }} />
            {/* Center dot */}
            <div style={{ position: 'absolute', top: '6px', left: '6px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'transparent', border: '1px solid black' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/BaseColorMarkers.tsx
git commit -m "feat(frontend): create BaseColorMarkers component"
```

---

### Task 4: Integrate Component into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the implementation**

In `src/App.tsx`, modify imports:
```tsx
import { ColorSample } from './api';
import { BaseColorMarkers } from './components/BaseColorMarkers';
```

Update `useState` around line 22:
```tsx
const [baseColorSamples, setBaseColorSamples] = useState<ColorSample[]>([]);
```

Update `useEffect` for `saveSettings` around line 152:
```tsx
      saveSettings(currentFilePath, exposure, baseColor, baseColorSamples, crop, userCurves).catch(e => console.error("Auto-save failed:", e));
```

Update `loadSettings` in `loadFile` around line 177:
```tsx
      setBaseColorSamples(settings.base_color_samples || []);
```
And also inside `resetHistory` inside `loadFile` around line 184.

Update the `onClick` handler inside the `.image-container` around line 327:
```tsx
      if (isPickingBase) {
        const newSample: ColorSample = { color, x: normalizedX, y: normalizedY };
        const newSamples = [...baseColorSamples, newSample];
        setBaseColorSamples(newSamples);

        const avgColor = [0, 0, 0];
        for (const s of newSamples) {
          avgColor[0] += s.color[0];
          avgColor[1] += s.color[1];
          avgColor[2] += s.color[2];
        }
        avgColor[0] /= newSamples.length;
        avgColor[1] /= newSamples.length;
        avgColor[2] /= newSamples.length;

        setBaseColor(avgColor);
```

Insert `<BaseColorMarkers>` inside the `.image-wrapper` container after `<CropOverlay>` (around line 780):
```tsx
              {isCropping && (
                <CropOverlay ... />
              )}
              <BaseColorMarkers 
                samples={baseColorSamples}
                imgRef={imgRef}
                scale={scale}
                pan={pan}
              />
```

Update `exportImage` usage around line 437 in `App.tsx` to match the new type signature if it uses `saveSettings` or `Settings` (Note: `exportImage` doesn't currently take samples, so it should be fine, but verify if types complain).

**Step 2: Run type check to verify it passes**

Run: `npm run tsc`
Expected: PASS

**Step 3: Run the app to manually verify**
Run: `npm run tauri dev`
Verify: Clicking the border adds a crosshair, the photo recalculates WB, and upon reloading the app and the photo, the crosshairs reappear.

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(frontend): integrate base color markers in app"
```