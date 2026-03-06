import numpy as np
from curve_fitting import apply_curve

def convert_negative_to_positive(img_array: np.ndarray, base_color: tuple = None, gamma: float = 2.2, exposure: float = 0.0, curve_params: dict = None) -> np.ndarray:
    """
    Converts a linear RGB negative image to a positive image.
    
    Args:
        img_array: Linear RGB image array with values in range [0, 1].
        base_color: Optional tuple of (R, G, B) representing the film base color.
                    If None, it is estimated from the 99th percentile of each channel.
        gamma: Gamma correction value (default 2.2).
        exposure: Exposure adjustment in EV stops (default 0.0).
        
    Returns:
        Positive RGB image array with values in range [0, 1].
    """
    # Step A: Neutralize the Orange Mask
    if base_color is None:
        # Estimate base color from the top edge of the image
        # This samples the unexposed film base, avoiding pure black (border) and pure white (sprocket holes)
        h, w = img_array.shape[:2]
        top_edge = img_array[:int(h * 0.1), :, :]
        pixels = top_edge.reshape(-1, 3)
        
        # Filter: red channel > 0.3 to exclude dark border, max channel < 0.95 to exclude bright sprocket holes
        valid_mask = (pixels[:, 0] > 0.3) & (np.max(pixels, axis=1) < 0.95)
        valid_pixels = pixels[valid_mask]
        
        if len(valid_pixels) > 0:
            base_color_arr = np.median(valid_pixels, axis=0)
        else:
            # Fallback based on user observation
            base_color_arr = np.array([200.0, 130.0, 80.0]) / 255.0
    else:
        base_color_arr = np.array(base_color)
    
    # Avoid division by zero
    base_color_arr = np.clip(base_color_arr, 1e-6, 1.0)
    
    # Normalize by base color channel-by-channel
    img_normalized = img_array / base_color_arr
    
    # Step B: The Inversion
    # Clip to [0, 1] to avoid artifacts from values brighter than the estimated base
    img_normalized = np.clip(img_normalized, 0.0, 1.0)
    img_inverted = 1.0 - img_normalized
    
    if curve_params is not None:
        # Apply fitted log curve directly to inverted data
        img_aligned = apply_curve(img_inverted, curve_params)
        # Apply Exposure Compensation
        gain = 2.0 ** exposure
        img_aligned = img_aligned * gain
        img_gamma = np.clip(img_aligned, 0.0, 1.0)
    else:
        # Channel Alignment / Auto Levels
        # Stretch each channel to maximize dynamic range and neutralize color casts
        # Calculate percentiles on the central part of the image to avoid scanner borders and unexposed film base
        h_img, w_img = img_inverted.shape[:2]
        crop_h, crop_w = int(h_img * 0.15), int(w_img * 0.15)
        center_img = img_inverted[crop_h:h_img-crop_h, crop_w:w_img-crop_w]
        
        img_aligned = np.zeros_like(img_inverted)
        for i in range(3):
            channel_data = center_img[:, :, i]
            valid_data = channel_data[(channel_data > 0.02) & (channel_data < 0.98)]
            
            if len(valid_data) > 100:
                p_low, p_high = np.percentile(valid_data, (0.5, 99.5))
            else:
                p_low, p_high = np.percentile(channel_data, (0.5, 99.5))
                
            if p_high > p_low:
                img_aligned[:, :, i] = (img_inverted[:, :, i] - p_low) / (p_high - p_low)
            else:
                img_aligned[:, :, i] = img_inverted[:, :, i]
                
        # Midtone alignment (Auto White Balance)
        # Align the medians of the channels using a per-channel gamma to avoid clipping highlights
        center_aligned = img_aligned[crop_h:h_img-crop_h, crop_w:w_img-crop_w]
        medians = []
        for i in range(3):
            valid_aligned = center_aligned[:, :, i][(center_aligned[:, :, i] > 0.02) & (center_aligned[:, :, i] < 0.98)]
            if len(valid_aligned) > 100:
                medians.append(np.median(valid_aligned))
            else:
                medians.append(np.median(center_aligned[:, :, i]))
                
        target_median = np.mean(medians)
        for i in range(3):
            if medians[i] > 0 and medians[i] < 1:
                # Calculate required gamma to shift median to target_median
                channel_gamma = np.log(target_median) / np.log(medians[i])
                img_aligned[:, :, i] = np.power(np.clip(img_aligned[:, :, i], 1e-6, 1.0), channel_gamma)
                
        # Apply Exposure Compensation
        gain = 2.0 ** exposure
        img_aligned = img_aligned * gain
                
        # Step C: Applying the Tone Curve (Gamma Correction)
        # Clip to avoid negative values before exponentiation
        img_aligned = np.clip(img_aligned, 0.0, 1.0)
        img_gamma = np.power(img_aligned, 1.0 / gamma)
    
    # Step 3: Color Matrices (Correcting Dye Crosstalk)
    # We apply a matrix to fix dye crosstalk. 
    # For a general purpose, we can use an identity matrix or slightly increase saturation.
    # We will use a typical slightly saturating matrix here.
    M = np.array([
        [ 1.1, -0.05, -0.05],
        [-0.05,  1.1, -0.05],
        [-0.05, -0.05,  1.1]
    ])
    
    # Flatten the image to multiply with the 3x3 matrix
    shape = img_gamma.shape
    img_flat = img_gamma.reshape(-1, 3)
    img_final = np.dot(img_flat, M.T)
    img_final = img_final.reshape(shape)
    
    # Final clip
    img_final = np.clip(img_final, 0.0, 1.0)
    
    return img_final
