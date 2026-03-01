import cv2
import numpy as np
from converter import convert_negative_to_positive

def main():
    img = cv2.imread('../images/DSC05906.JPG')
    if img is None:
        print("Could not read image.")
        return
        
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_normalized = img_rgb.astype(np.float32) / 255.0

    # Base color estimation
    h, w = img_normalized.shape[:2]
    top_edge = img_normalized[:int(h * 0.1), :, :]
    pixels = top_edge.reshape(-1, 3)
    valid_mask = (pixels[:, 0] > 0.3) & (np.max(pixels, axis=1) < 0.95)
    valid_pixels = pixels[valid_mask]
    base_color_arr = np.median(valid_pixels, axis=0) if len(valid_pixels) > 0 else np.array([200.0, 130.0, 80.0]) / 255.0

    converted = convert_negative_to_positive(img_normalized, base_color_arr)

    # Sample the scanner mask in the positive image (the white border)
    # The scanner mask in the negative is the very dark border at the top and bottom
    # Let's sample the top 2% of the converted image
    top_border = converted[:int(h * 0.02), :, :]
    border_pixels = top_border.reshape(-1, 3)

    # Filter for the brightest pixels in the positive image (which correspond to the darkest pixels in the negative)
    bright_mask = np.mean(border_pixels, axis=1) > 0.8
    bright_pixels = border_pixels[bright_mask]

    if len(bright_pixels) > 0:
        median_border = np.median(bright_pixels, axis=0)
        print("Median color of the white border in positive:", median_border)
    else:
        print("No bright border found.")

if __name__ == "__main__":
    main()
