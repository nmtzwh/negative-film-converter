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
    
    # We apply the first part of the conversion to see intermediate values
    h, w = img_normalized.shape[:2]
    top_edge = img_normalized[:int(h * 0.1), :, :]
    pixels = top_edge.reshape(-1, 3)
    
    # Filter for unexposed film base
    valid_mask = (pixels[:, 0] > 0.3) & (np.max(pixels, axis=1) < 0.95)
    valid_pixels = pixels[valid_mask]
    base_color_arr = np.median(valid_pixels, axis=0) if len(valid_pixels) > 0 else np.array([200.0, 130.0, 80.0]) / 255.0
    print("Film base color:", base_color_arr)
    
    # Let's check the scanner mask (pure black border in scan)
    # The scan has black border at y=0 to y=200 ish.
    dark_mask = pixels[pixels[:, 0] < 0.1]
    if len(dark_mask) > 0:
        dark_color = np.median(dark_mask, axis=0)
        print("Scanner dark border color (scan):", dark_color)
    
    # Now let's check the converted image
    converted = convert_negative_to_positive(img_normalized, base_color_arr)
    
    # Let's see what the unexposed film base looks like in the converted image
    # It should be close to black
    converted_top = converted[:int(h * 0.1), :, :]
    conv_pixels = converted_top.reshape(-1, 3)
    
    # Let's find the unexposed film base pixels in the converted image by using the same valid_mask
    conv_base_pixels = conv_pixels[valid_mask]
    if len(conv_base_pixels) > 0:
        print("Film base color in positive image (should be close to black):", np.median(conv_base_pixels, axis=0))
        
    # What about the "reference gray colors"? The user says "edge of the film as reference gray colors"
    # The edge of the film might be a gray card, or maybe they mean the unexposed film base is gray?
    # No, the unexposed film base in the *converted* image should be pure black (R=0, G=0, B=0), wait.
    # If the user says "edge of the film as reference gray colors", maybe they mean the dark border in the original scan?
    # Or maybe the unexposed film edge is NOT black in the positive, but some D_min gray?
    # No, the unexposed film is the *most transmissive* part of the film. It should be the darkest part of the positive.
    
    # Let's do a quick auto white balance (Gray World) on the converted image
    # to see what a balanced image looks like.
    mean_r = np.mean(converted[:, :, 0])
    mean_g = np.mean(converted[:, :, 1])
    mean_b = np.mean(converted[:, :, 2])
    print(f"Mean RGB of converted image: [{mean_r:.4f}, {mean_g:.4f}, {mean_b:.4f}]")

if __name__ == "__main__":
    main()
