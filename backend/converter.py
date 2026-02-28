import numpy as np

def convert_negative_to_positive(img_array: np.ndarray, base_color: tuple = None, gamma: float = 2.2) -> np.ndarray:
    """
    Converts a linear RGB negative image to a positive image.
    
    Args:
        img_array: Linear RGB image array with values in range [0, 1].
        base_color: Optional tuple of (R, G, B) representing the film base color.
                    If None, it is estimated from the 99th percentile of each channel.
        gamma: Gamma correction value (default 2.2).
        
    Returns:
        Positive RGB image array with values in range [0, 1].
    """
    # Step A: Neutralize the Orange Mask
    if base_color is None:
        # Estimate base color from the 99th percentile of each channel
        # This assumes the brightest parts of the image (most transmissive) are the unexposed film base
        R_b = np.percentile(img_array[:, :, 0], 99)
        G_b = np.percentile(img_array[:, :, 1], 99)
        B_b = np.percentile(img_array[:, :, 2], 99)
        base_color_arr = np.array([R_b, G_b, B_b])
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
    
    # Step C: Applying the Tone Curve (Gamma Correction)
    # Clip to avoid negative values before exponentiation
    img_inverted = np.clip(img_inverted, 0.0, 1.0)
    img_gamma = np.power(img_inverted, 1.0 / gamma)
    
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
