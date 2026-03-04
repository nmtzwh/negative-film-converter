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
