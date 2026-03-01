import cv2
import numpy as np
from converter import convert_negative_to_positive

def main():
    input_path = '../images/DSC05906.JPG'
    output_path = '../images/DSC05906_converted.JPG'

    print(f"Loading image from {input_path}...")
    # Load image (OpenCV uses BGR by default)
    img_bgr = cv2.imread(input_path)
    
    if img_bgr is None:
        print(f"Error: Could not load image from {input_path}")
        return

    # Convert to RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    
    # Normalize to [0, 1]
    img_normalized = img_rgb.astype(np.float32) / 255.0
    
    print("Applying negative to positive conversion...")
    # Apply conversion
    img_converted_rgb = convert_negative_to_positive(img_normalized)
    
    # Scale back to [0, 255]
    img_converted_rgb_255 = (img_converted_rgb * 255.0).clip(0, 255).astype(np.uint8)
    
    # Convert back to BGR for saving
    img_converted_bgr = cv2.cvtColor(img_converted_rgb_255, cv2.COLOR_RGB2BGR)
    
    print(f"Saving converted image to {output_path}...")
    # Save image
    cv2.imwrite(output_path, img_converted_bgr)
    print("Conversion complete!")

if __name__ == "__main__":
    main()
