import cv2
import numpy as np

img = cv2.imread('../images/DSC05906.JPG')
img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
img_array = img_rgb.astype(np.float32) / 255.0

def estimate_base_color_from_edge(img_array: np.ndarray) -> np.ndarray:
    h, w = img_array.shape[:2]
    top_edge = img_array[:int(h * 0.1), :]
    
    pixels = top_edge.reshape(-1, 3)
    
    # Red > 0.5 to exclude dark border
    # Max channel < 0.95 to exclude pure white/bright sprocket holes
    valid_mask = (pixels[:, 0] > 0.5) & (np.max(pixels, axis=1) < 0.95)
    valid_pixels = pixels[valid_mask]
    
    print(f"Total top edge pixels: {len(pixels)}, Valid pixels: {len(valid_pixels)}")
    if len(valid_pixels) > 0:
        base_color = np.median(valid_pixels, axis=0)
    else:
        base_color = np.array([0.78, 0.51, 0.31])
    return base_color

base = estimate_base_color_from_edge(img_array)
print("Estimated base color (0-1):", base)
print("Estimated base color (0-255):", base * 255)
