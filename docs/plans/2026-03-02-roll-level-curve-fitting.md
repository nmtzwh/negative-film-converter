# Roll-Level Curve Fitting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a data-driven film inversion pipeline by allowing users to sample multiple gray points across a directory of images to fit a logarithmic density curve.

**Architecture:** We will manage a `roll_profile.json` per directory containing sampled "Gray Anchors". The Python backend will use `scipy.optimize` to fit a logarithmic curve ($P = a \cdot \log(b \cdot N + c) + d$) through these anchors to align the RGB channels. The React frontend will add a new left sidebar panel for adding these points and visualizing the resulting curve.

**Tech Stack:** React (TypeScript), Tauri v2, FastAPI (Python), `scipy.optimize`, `numpy`.

---

### Task 1: Backend Dependencies & Math Foundation

**Goal:** Add `scipy` and implement the mathematical curve fitting function.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/curve_fitting.py`

**Step 1: Update requirements.txt**
Add `scipy==1.15.2` to `backend/requirements.txt`.

**Step 2: Install dependency**
Run: `cd backend && source venv/bin/activate && pip install -r requirements.txt`

**Step 3: Write the math functions**
Create `backend/curve_fitting.py`:
```python
import numpy as np
from scipy.optimize import curve_fit

def log_func(x, a, b, c, d):
    # Base logarithmic density function: P = a * log(b*x + c) + d
    # Small epsilon to avoid log(<=0)
    safe_x = np.clip(b * x + c, 1e-6, None)
    return a * np.log(safe_x) + d

def fit_roll_curve(anchors: list[list[float]]):
    """
    anchors: list of [R, G, B] floats from the raw negative (0.0 - 1.0)
    Returns: Dict of curve parameters for each channel, or None if not enough data
    """
    if len(anchors) < 2:
        return None
        
    anchors_np = np.array(anchors) # Shape: (N, 3)
    
    # We want to map these raw values to a neutral gray line.
    # A simple target is just the average luminance of the anchor, inverted.
    # E.g., a dark dense spot on negative = bright highlight in positive.
    target_luma = 1.0 - np.mean(anchors_np, axis=1)
    
    # Normalize targets to stretch from 0.1 to 0.9 roughly to give room
    target_min, target_max = np.min(target_luma), np.max(target_luma)
    if target_max > target_min:
        targets = 0.1 + 0.8 * (target_luma - target_min) / (target_max - target_min)
    else:
        targets = np.full_like(target_luma, 0.5)

    params = {}
    channels = ['r', 'g', 'b']
    
    # Initial guess: a=1, b=1, c=0, d=0
    p0 = [1.0, 1.0, 0.0, 0.0]
    
    for i in range(3):
        x_data = anchors_np[:, i]
        try:
            # We might need bounds depending on data ranges, keeping it unbounded for initial fit
            popt, _ = curve_fit(log_func, x_data, targets, p0=p0, maxfev=5000)
            params[channels[i]] = popt.tolist()
        except RuntimeError:
            # If fit fails, fallback to simple linear for this channel
            params[channels[i]] = [1.0, 1.0, 0.0, 0.0] # Dummy fallback
            
    return params

def apply_curve(img_array: np.ndarray, params: dict):
    """Applies the fitted log curve to the image array."""
    if not params:
        return img_array
        
    out = np.zeros_like(img_array)
    out[..., 0] = log_func(img_array[..., 0], *params['r'])
    out[..., 1] = log_func(img_array[..., 1], *params['g'])
    out[..., 2] = log_func(img_array[..., 2], *params['b'])
    
    return np.clip(out, 0.0, 1.0)
```

**Step 4: Commit**
```bash
git add backend/requirements.txt backend/curve_fitting.py
git commit -m "feat(backend): add scipy dependency and curve fitting math"
```

### Task 2: Backend Endpoints for Roll Profile

**Goal:** Create endpoints to save/load `roll_profile.json` and generate curve visualizations.

**Files:**
- Modify: `backend/server.py`

**Step 1: Add Models & Endpoints**
In `server.py`, add `RollProfileRequest` and endpoints:
```python
from curve_fitting import fit_roll_curve, log_func, apply_curve

class RollProfileRequest(BaseModel):
    dir_path: str
    anchors: list[list[float]] # List of [R, G, B]

@app.post("/update_roll_profile")
def update_roll_profile(request: RollProfileRequest):
    if not os.path.isdir(request.dir_path):
        raise HTTPException(status_code=404, detail="Directory not found")
        
    profile_path = os.path.join(request.dir_path, "roll_profile.json")
    
    # Try fitting a curve
    curve_params = fit_roll_curve(request.anchors)
    
    # Generate visualization data if we have a curve (100 points along X axis)
    vis_data = None
    if curve_params:
        vis_data = {'r': [], 'g': [], 'b': []}
        x_vals = np.linspace(0, 1, 100)
        for ch in ['r', 'g', 'b']:
            y_vals = log_func(x_vals, *curve_params[ch])
            vis_data[ch] = y_vals.tolist()
            
    profile_data = {
        "anchors": request.anchors,
        "curve_params": curve_params
    }
    
    with open(profile_path, "w") as f:
        json.dump(profile_data, f)
        
    return {"status": "success", "curve_params": curve_params, "vis_data": vis_data}

@app.post("/load_roll_profile")
def load_roll_profile(request: DirectoryRequest):
    profile_path = os.path.join(request.path, "roll_profile.json")
    if not os.path.exists(profile_path):
        return {"anchors": [], "curve_params": None, "vis_data": None}
        
    try:
        with open(profile_path, "r") as f:
            data = json.load(f)
            
        # Re-generate vis data
        vis_data = None
        if data.get("curve_params"):
            vis_data = {'r': [], 'g': [], 'b': []}
            x_vals = np.linspace(0, 1, 100)
            for ch in ['r', 'g', 'b']:
                y_vals = log_func(x_vals, *data["curve_params"][ch])
                vis_data[ch] = y_vals.tolist()
                
        return {
            "anchors": data.get("anchors", []), 
            "curve_params": data.get("curve_params"),
            "vis_data": vis_data
        }
    except Exception:
        return {"anchors": [], "curve_params": None, "vis_data": None}
```

**Step 2: Update `convert_image` and `export_image`**
Modify both endpoints to check for `roll_profile.json` in the file's directory and apply the curve *before* or *instead of* the generic inversion math.
*(We will need to refactor `convert_negative_to_positive` in `converter.py` to accept the curve params, or apply the curve directly in `server.py`).*

**Step 3: Commit**
```bash
git add backend/server.py
git commit -m "feat(backend): add roll profile endpoints"
```

### Task 3: Frontend API & State

**Goal:** Wire the new endpoints into React.

**Files:**
- Modify: `src/api.ts`
- Modify: `src/App.tsx`

**Step 1:** Add API functions for `/update_roll_profile` and `/load_roll_profile`.
**Step 2:** Add React State:
```typescript
const [isPickingAnchor, setIsPickingAnchor] = useState(false);
const [rollAnchors, setRollAnchors] = useState<number[][]>([]);
const [curveVisData, setCurveVisData] = useState<any>(null);
const [currentDir, setCurrentDir] = useState<string | null>(null);
```
**Step 3:** When `handleOpenFolder` is called, set `currentDir` and load the roll profile.

### Task 4: Frontend UI (Roll Calibration)

**Goal:** Build the UI to add/delete anchors and show the curve graph.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/CurveGraph.tsx`

**Step 1:** Create a small SVG or Canvas based component to render the `curveVisData`.
**Step 2:** Add a new "Roll Calibration" section to the left sidebar in `App.tsx` containing:
- The "Pick Gray Anchor" toggle button.
- A list rendering the `rollAnchors` with a "Remove" button next to each.
- The `CurveGraph` component.
**Step 3:** Update the `handleImageClick` function so that if `isPickingAnchor` is true, it samples the color and appends it to `rollAnchors`, then immediately calls `update_roll_profile`.

### Task 5: Final Review & Integration

**Goal:** Ensure the end-to-end pipeline works and UI is polished.
- Verify the math doesn't crash on flat/weird data.
- Verify the UI toggles correctly.
- Commit all frontend changes.
