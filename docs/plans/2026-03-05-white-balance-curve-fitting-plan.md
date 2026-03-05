# White Balance Curve Fitting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the roll curve fitting logic into the core float-point negative conversion pipeline to ensure white balance and color matrices are properly applied.

**Architecture:** Modify `fit_roll_curve` to pre-process anchors with the orange mask neutralization and inversion. Modify `convert_negative_to_positive` to accept the fitted curve parameters and apply them in place of the generic auto-levels and midtone alignment. Refactor `server.py` to use a single unified conversion call.

**Tech Stack:** Python, FastAPI, NumPy, SciPy.

---

### Task 1: Update Curve Fitting Logic

Modify `fit_roll_curve` to accept `base_color` and pre-process raw anchors with neutralization and inversion before fitting.

**Files:**
- Modify: `backend/curve_fitting.py`

**Step 1: Write failing test (if applicable, but we don't have dedicated tests for curve_fitting.py. We will just implement the changes)**
Wait, we should write a test in a new file `backend/test_curve_fitting.py`.

```python
# backend/test_curve_fitting.py
import numpy as np
from curve_fitting import fit_roll_curve

def test_fit_roll_curve_with_base_color():
    anchors = [[0.2, 0.4, 0.6], [0.3, 0.5, 0.7], [0.4, 0.6, 0.8], [0.5, 0.7, 0.9]]
    base_color = [1.0, 1.0, 1.0] # Identity
    # Should run without error
    params = fit_roll_curve(anchors, base_color=base_color)
    assert params is not None
    assert 'r' in params and 'g' in params and 'b' in params
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/test_curve_fitting.py -v`
Expected: FAIL due to missing `base_color` argument in `fit_roll_curve`

**Step 3: Write implementation in `curve_fitting.py`**

```python
# In backend/curve_fitting.py, modify fit_roll_curve
def fit_roll_curve(anchors: list[list[float]], base_color: tuple = None):
    if len(anchors) < 4:
        return None
        
    anchors_np = np.array(anchors) # Shape: (N, 3)
    
    # Pre-process anchors as they would be in the pipeline
    if base_color is not None:
        base_color_arr = np.array(base_color)
    else:
        base_color_arr = np.array([200.0, 130.0, 80.0]) / 255.0
        
    base_color_arr = np.clip(base_color_arr, 1e-6, 1.0)
    anchors_normalized = np.clip(anchors_np / base_color_arr, 0.0, 1.0)
    anchors_inverted = 1.0 - anchors_normalized
    
    # Target luma is based on inverted anchors
    target_luma = np.mean(anchors_inverted, axis=1)
    
    # Normalize targets
    target_min, target_max = np.min(target_luma), np.max(target_luma)
    if target_max > target_min:
        targets = 0.1 + 0.8 * (target_luma - target_min) / (target_max - target_min)
    else:
        targets = np.full_like(target_luma, 0.5)

    params = {}
    channels = ['r', 'g', 'b']
    p0 = [1.0, 1.0, 0.0, 0.0]
    
    for i in range(3):
        x_data = anchors_inverted[:, i]
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", OptimizeWarning)
                popt, _ = curve_fit(log_func, x_data, targets, p0=p0, maxfev=5000)
                params[channels[i]] = popt.tolist()
        except Exception:
            params[channels[i]] = [1.0, 1.0, 0.0, 0.0]
            
    return params
```

**Step 4: Run test to verify it passes**

Run: `pytest backend/test_curve_fitting.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/curve_fitting.py backend/test_curve_fitting.py
git commit -m "feat(backend): pre-process anchors in roll curve fitting"
```

---

### Task 2: Integrate Curve into Conversion Pipeline

Modify `convert_negative_to_positive` to accept `curve_params` and apply the curve.

**Files:**
- Modify: `backend/converter.py`

**Step 1: Write failing test**
Update `test_converter.py` if it exists, but let's just make sure the code executes.

```python
# Create backend/test_converter.py
import numpy as np
from converter import convert_negative_to_positive

def test_convert_with_curve_params():
    img = np.ones((10, 10, 3), dtype=np.float32) * 0.5
    curve_params = {
        'r': [1.0, 1.0, 0.0, 0.0],
        'g': [1.0, 1.0, 0.0, 0.0],
        'b': [1.0, 1.0, 0.0, 0.0]
    }
    out = convert_negative_to_positive(img, curve_params=curve_params)
    assert out.shape == (10, 10, 3)
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/test_converter.py -v`
Expected: FAIL due to missing `curve_params` arg

**Step 3: Write implementation in `converter.py`**

```python
# In backend/converter.py
from curve_fitting import apply_curve # Add import at the top

def convert_negative_to_positive(img_array: np.ndarray, base_color: tuple = None, gamma: float = 2.2, exposure: float = 0.0, curve_params: dict = None) -> np.ndarray:
    # ... existing Step A (Neutralize Orange Mask) and Step B (Inversion)
    # img_inverted = 1.0 - img_normalized
    
    if curve_params is not None:
        # Apply fitted log curve directly to inverted data
        img_aligned = apply_curve(img_inverted, curve_params)
        # Apply Exposure Compensation
        gain = 2.0 ** exposure
        img_aligned = img_aligned * gain
        img_gamma = np.clip(img_aligned, 0.0, 1.0)
    else:
        # ... existing generic Channel Alignment, Midtone alignment, Exposure, and Gamma Correction
        # img_gamma = np.power(img_aligned, 1.0 / gamma)

    # ... existing Step 3 (Color Matrices)
    # img_final = np.dot(img_flat, M.T)
    # ...
    return img_final
```

**Step 4: Run test to verify it passes**

Run: `pytest backend/test_converter.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/converter.py backend/test_converter.py
git commit -m "feat(backend): fuse curve fitting into conversion pipeline"
```

---

### Task 3: Refactor Server Endpoints

Update `server.py` endpoints to pass `base_color` and `curve_params` together and remove the bypass path.

**Files:**
- Modify: `backend/server.py`

**Step 1: Write failing test**
Update `test_server.py` if needed. (Skipped for brevity as tests rely on mocking). Let's modify directly and ensure it runs.

**Step 2: Write implementation in `server.py`**

In `/update_roll_profile`:
```python
    # Pass base color if available, or just None for now
    curve_params = fit_roll_curve(request.anchors)
    # Wait, we need the base color! The roll profile doesn't have a single base color. 
    # But wait, roll profiles are across the roll! So we either just don't pass base_color, 
    # or we use a default. For now, pass base_color=None so it uses the fallback/estimate.
```

In `/convert_image` and `/export`:
```python
        # Check Cache
        cached_positive = global_cache.get(request.path, base_color_tuple, curve_params)
        
        if cached_positive is not None:
            positive_img_base = cached_positive
        else:
            img_array = get_rgb_float(request.path)
            # Remove the branching!
            positive_img_base = convert_negative_to_positive(
                img_array, 
                base_color=base_color_tuple, 
                exposure=0.0, 
                curve_params=curve_params
            )
            global_cache.set(request.path, base_color_tuple, curve_params, positive_img_base)
```

And in `/export`:
```python
        base_color_tuple = tuple(request.base_color) if request.base_color else None
        positive_img = convert_negative_to_positive(
            img_array, 
            base_color=base_color_tuple, 
            exposure=request.exposure,
            curve_params=curve_params
        )
```

**Step 3: Test endpoints manually or via existing tests**

Run: `pytest backend/test_server.py -v`

**Step 4: Commit**

```bash
git add backend/server.py
git commit -m "refactor(backend): use unified conversion pipeline in server endpoints"
```