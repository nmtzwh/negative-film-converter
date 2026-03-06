import numpy as np
from scipy.optimize import curve_fit
import warnings
from scipy.optimize import OptimizeWarning

def log_func(x, a, b, c, d):
    # Base logarithmic density function: P = a * log(b*x + c) + d
    # Small epsilon to avoid log(<=0)
    safe_x = np.clip(b * x + c, 1e-6, None)
    return a * np.log(safe_x) + d

def fit_roll_curve(anchors: list[list[float]], base_color: tuple = None):
    """
    anchors: list of [R, G, B] floats from the raw negative (0.0 - 1.0)
    Returns: Dict of curve parameters for each channel, or None if not enough data
    """
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
    
    # Initial guess: a=1, b=1, c=0, d=0
    p0 = [1.0, 1.0, 0.0, 0.0]
    
    for i in range(3):
        x_data = anchors_inverted[:, i]
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", OptimizeWarning)
                # We might need bounds depending on data ranges, keeping it unbounded for initial fit
                popt, _ = curve_fit(log_func, x_data, targets, p0=p0, maxfev=5000)
                params[channels[i]] = popt.tolist()
        except Exception:
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
