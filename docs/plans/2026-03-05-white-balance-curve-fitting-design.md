# White Balance Curve Fitting Pipeline Integration Design

## Overview
Currently, the Roll Curve Fitting feature (`Pick Gray Anchor`) calculates a logarithmic curve based on raw float negative anchors and replaces the entire negative conversion pipeline. This bypasses crucial steps like film base neutralization and color matrices (dye crosstalk correction), resulting in suboptimal color balance. 

This design integrates the roll curve fitting directly into the core `convert_negative_to_positive` pipeline in float-point precision, ensuring that the fitted curve works harmoniously with white balance and color matrix operations.

## Architecture & Data Flow

1. **Anchor Pre-processing:**
   - The `fit_roll_curve` function will be updated to accept the `base_color` as an argument.
   - Raw anchors will be pre-processed (neutralized by `base_color` and inverted) *before* being used to fit the curve. This aligns the curve's input space with the pipeline's intermediate state.

2. **Unified Conversion Pipeline (`converter.py`):**
   - The `convert_negative_to_positive` function will accept an optional `curve_params` argument.
   - **Step A:** Neutralize the Orange Mask (`img_array / base_color`).
   - **Step B:** Inversion (`1.0 - img_normalized`).
   - **Step C (Curve/Levels):** 
     - If `curve_params` are provided, apply the fitted log curve to the inverted data (replacing generic Auto Levels, Midtone Alignment, and Gamma Correction).
     - If no `curve_params` exist, fall back to the existing generic logic.
   - **Step D:** Apply Exposure.
   - **Step E:** Apply Color Matrices (Dye Crosstalk Correction).

3. **Backend Refactoring (`server.py`):**
   - When generating the positive image, always call `convert_negative_to_positive` passing both `base_color` and `curve_params`.
   - Remove the old branching logic where `apply_curve` completely bypassed the converter.

## Benefits
- **Better Color Accuracy:** The color matrices and film base neutralization remain active, providing accurate white balance and removing dye crosstalk.
- **Float-Point Precision:** The entire curve application remains in the float-point domain before conversion to 8-bit.
- **Consistent Output:** Users get a reliable baseline with the fitted curve, rather than a completely detached conversion path.