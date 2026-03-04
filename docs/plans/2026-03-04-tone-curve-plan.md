# Tone Curve Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement an interactive RGB Tone Curve Editor allowing precise tonal adjustments via spline interpolation.

**Architecture:** 
- Frontend: Build `<ToneCurveEditor>` in React. It renders an SVG grid and handles point dragging. The `curves` state maps 4 channels (rgb, r, g, b) to `[x,y]` coordinate arrays.
- Backend: Update `server.py` models to accept `user_curves`. Add `scipy` dependency. Create `user_curves.py` using `scipy.interpolate.PchipInterpolator` (better than CubicSpline for avoiding overshoot) to generate a 256-value LUT. Apply it via `cv2.LUT()` in `server.py` before JPEG encoding.

**Tech Stack:** React, SVG, Python, FastAPI, OpenCV, SciPy

---

### Task 1: Add SciPy and create Backend Interpolation Logic

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/user_curves.py`
- Test: `backend/test_user_curves.py`

**Step 1: Add scipy to requirements**
In `backend/requirements.txt`, append `scipy`.

**Step 2: Write the failing test**
Create `backend/test_user_curves.py`:
```python
import numpy as np
from user_curves import generate_lut, apply_curves

def test_generate_lut():
    # Identity curve
    lut = generate_lut([[0.0, 0.0], [1.0, 1.0]])
    assert len(lut) == 256
    assert lut[0] == 0 and lut[255] == 255
    
    # S-Curve test
    lut2 = generate_lut([[0.0, 0.0], [0.25, 0.1], [0.75, 0.9], [1.0, 1.0]])
    assert lut2[64] < 64  # pulled down
    assert lut2[192] > 192 # pulled up

def test_apply_curves():
    img = np.ones((10, 10, 3), dtype=np.uint8) * 128
    curves = {
        "rgb": [[0,0], [1,1]],
        "r": [[0,0], [0.5, 0.75], [1,1]], # Boost red midtones
        "g": [[0,0], [1,1]],
        "b": [[0,0], [1,1]]
    }
    out = apply_curves(img, curves)
    assert out[0,0,0] > 128 # Red boosted (OpenCV uses BGR, but we assume we pass RGB into apply_curves for now, wait, let's assume RGB input)
```

**Step 3: Write implementation**
Create `backend/user_curves.py`:
```python
import numpy as np
import cv2
from scipy.interpolate import PchipInterpolator

def generate_lut(points: list[list[float]]) -> np.ndarray:
    if not points:
        return np.arange(256, dtype=np.uint8)
        
    pts = np.array(points)
    # Ensure sorted by x
    pts = pts[pts[:, 0].argsort()]
    
    x = pts[:, 0] * 255.0
    y = pts[:, 1] * 255.0
    
    # Needs at least 2 points
    if len(x) < 2:
        return np.arange(256, dtype=np.uint8)
        
    interpolator = PchipInterpolator(x, y)
    x_new = np.arange(256)
    y_new = interpolator(x_new)
    
    return np.clip(y_new, 0, 255).astype(np.uint8)

def apply_curves(img_8bit_rgb: np.ndarray, curves: dict) -> np.ndarray:
    """Applies user curves to an 8-bit RGB image."""
    master_lut = generate_lut(curves.get("rgb", [[0,0], [1,1]]))
    r_lut = generate_lut(curves.get("r", [[0,0], [1,1]]))
    g_lut = generate_lut(curves.get("g", [[0,0], [1,1]]))
    b_lut = generate_lut(curves.get("b", [[0,0], [1,1]]))
    
    # Combine Master LUT with channel LUTs
    final_r_lut = r_lut[master_lut]
    final_g_lut = g_lut[master_lut]
    final_b_lut = b_lut[master_lut]
    
    out = np.empty_like(img_8bit_rgb)
    out[:,:,0] = cv2.LUT(img_8bit_rgb[:,:,0], final_r_lut)
    out[:,:,1] = cv2.LUT(img_8bit_rgb[:,:,1], final_g_lut)
    out[:,:,2] = cv2.LUT(img_8bit_rgb[:,:,2], final_b_lut)
    
    return out
```

*(Self-correction on test: Update `test_apply_curves` to check `out[0,0,0] > 128` since channel 0 is R in RGB).*

**Step 4: Run tests**
Run: `pip install scipy && pytest backend/test_user_curves.py -v`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/requirements.txt backend/user_curves.py backend/test_user_curves.py
git commit -m "feat(backend): add scipy spline interpolation for tone curves"
```

---

### Task 2: Update Server Endpoints for user_curves

**Files:**
- Modify: `backend/server.py`

**Step 1: Update Pydantic Models**
In `backend/server.py`, update `ConvertRequest`, `SettingsRequest`, and `ExportRequest` to add:
```python
    user_curves: dict | None = None
```

**Step 2: Update Cache key**
In `backend/server.py` `sync_convert_image` (or `convert_image`), update the cache check to ignore `user_curves` (because caching is for the base negative conversion, curves are applied *after* caching). Wait, no, `user_curves` is applied *after* caching the base positive, just like exposure.

**Step 3: Apply Curves in endpoints**
In `convert_image` and `export_image`, right after clipping the exposure and converting to 8-bit, import and apply the curves:
```python
from user_curves import apply_curves

# ... inside endpoints ...
# Convert back to 8-bit [0, 255] for JPEG encoding
positive_img_8bit = (positive_img * 255.0).astype(np.uint8)

if request.user_curves:
    positive_img_8bit = apply_curves(positive_img_8bit, request.user_curves)

# then calculate histogram and convert to BGR as normal
```

*(Note: Apply to both `convert_image` and `export_image` logic).*

**Step 4: Run tests**
Run: `pytest backend/test_server.py -v`
Expected: PASS

**Step 5: Commit**
```bash
git add backend/server.py
git commit -m "feat(backend): apply user_curves in conversion and export endpoints"
```

---

### Task 3: Build `<ToneCurveEditor>` React Component

**Files:**
- Create: `src/components/ToneCurveEditor.tsx`

**Step 1: Scaffold component**
Create the component. It takes `curves: Curves`, `onChange: (c: Curves) => void`.
It needs an internal state for `activeChannel: 'rgb' | 'r' | 'g' | 'b'`.
It uses an `<svg>` to render lines between the points of the active channel.

*(Too much code to write out fully here, the executing agent will need to write the SVG dragging logic: converting mouse coordinates to 0.0-1.0, finding closest point to drag, sorting on mouse up).*

**Step 2: Implement Point Dragging Logic**
- `onPointerDown`: Check if close to an existing point (within ~10px). If yes, set `draggingPointIdx`. If no, insert a new point, sort array, and set `draggingPointIdx` to the new point's index.
- `onPointerMove`: Update the `x,y` of `draggingPointIdx`. Ensure `x` stays strictly between the `x` of `[idx-1]` and `[idx+1]`.
- `onDoubleClick`: Remove the point if it's not the first or last point.

**Step 3: Commit**
```bash
git add src/components/ToneCurveEditor.tsx
git commit -m "feat(ui): create ToneCurveEditor component with SVG interaction"
```

---

### Task 4: Integrate Tone Curves into Main App State

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/api.ts`
- Modify: `src/hooks/useHistory.ts`

**Step 1: Update Types**
In `src/api.ts`, update `Settings` and API call signatures to include `user_curves`.
```typescript
export type Curves = { rgb: [number,number][], r: [number,number][], g: [number,number][], b: [number,number][] };
```

**Step 2: Update App State & History**
In `src/App.tsx`, add state:
```typescript
const defaultCurves: Curves = { rgb: [[0,0],[1,1]], r: [[0,0],[1,1]], g: [[0,0],[1,1]], b: [[0,0],[1,1]] };
const [userCurves, setUserCurves] = useState<Curves>(defaultCurves);
```
Add `userCurves` to `useHistory` and the `undo`/`redo` logic.

**Step 3: Update API calls**
Pass `userCurves` to `convertImage`, `saveSettings`, and `exportImage`.

**Step 4: Render UI**
Place `<ToneCurveEditor curves={userCurves} onChange={setUserCurves} />` in the right sidebar below the Histogram.

**Step 5: Run type check**
Run: `npm run tsc` (or `npx tsc --noEmit`)
Expected: PASS

**Step 6: Commit**
```bash
git add src/App.tsx src/api.ts src/hooks/useHistory.ts
git commit -m "feat(ui): integrate tone curves into app state and sidebar"
```
