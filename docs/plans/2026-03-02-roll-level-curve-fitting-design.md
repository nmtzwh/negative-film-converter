# Design: Roll-Level Curve Fitting & Advanced Grading

## 1. Overview
This design outlines Phase 4 of the Negative Film Converter. It introduces a sophisticated method for film inversion by allowing users to build a "Roll Profile" using multiple gray points sampled across different photos in the same folder. This data is used to fit a logarithmic curve that naturally neutralizes color crossovers inherent in film stocks. Additionally, it introduces custom RGB curves for fine-tuned creative grading.

## 2. Core Concepts

### 2.1 The "Roll Profile"
- A roll of film is defined by its directory/folder.
- The application will manage a `roll_profile.json` file within the active directory.
- This profile stores a collection of "Gray Anchors"—sampled raw RGB values from various images in the roll that the user identifies as neutral gray (ranging from deep shadows to bright highlights).

### 2.2 Mathematical Approach (Curve Fitting)
- The backend will transition from simple linear inversion and auto-levels to a data-driven curve fit.
- Using the collected Gray Anchors (Ni), the backend will use `scipy.optimize` or `numpy.polyfit` to calculate a continuous mapping function for each RGB channel.
- The goal of the fitted curve is to map the raw negative densities (N) such that the output positive values (P) for the anchor points have equal R, G, and B components, effectively neutralizing the film's specific color biases across the entire tonal range.
- The assumed curve shape will be logarithmic: P = a * log(b * N + c) + d, mirroring physical film densitometry.

### 2.3 Image Processing Pipeline Updates
1. **Base Color Subtraction:** Neutralize the orange mask (existing).
2. **Roll-Level Curve Application:** Apply the newly fitted curve to map negative linear data to positive linear/gamma data, replacing the naive inversion step.
3. **Exposure Adjustment:** Linear gain (existing).
4. **Custom RGB Curves:** Apply user-defined spline curves for final aesthetic toning.

## 3. User Interface (UI) Additions

### 3.1 Roll Calibration Panel (Left Sidebar)
- **"Add Gray Anchor" Tool:** A toggle button. When active, clicking on the image viewport samples the raw color and adds it to the global Roll Profile.
- **Anchor List:** A UI component displaying the list of collected anchors (e.g., "Anchor 1", "Anchor 2"). Includes the ability to delete individual anchors.
- **Curve Visualization:** A small graph (using HTML Canvas or SVG) displaying the generated Red, Green, and Blue transfer curves to provide immediate visual feedback of the mathematical fit.

### 3.2 Creative Grading Panel
- **RGB Curve Editor:** A standard node-based curve UI (Master, Red, Green, Blue channels). Users can add, drag, and delete control points to shape the final output. These settings are saved per-image in the existing sidecar JSON files.

## 4. Backend (API) Changes
- **`POST /update_roll_profile`:** Accepts the directory path and the list of gray anchor RGB values. Saves to `roll_profile.json` and returns the generated curve parameters/points for UI visualization.
- **`POST /convert_image` (Modified):**
  - Accepts the new roll-level curve parameters to use during inversion.
  - Accepts a `custom_rgb_curve` object (list of spline knots) to apply as the final step.
- **Dependencies:** May require adding `scipy` to `requirements.txt` if `numpy` polynomials prove insufficient for logarithmic fitting.

## 5. Development Steps
1. Add `scipy` to backend and implement the mathematical curve fitting logic in Python.
2. Create the backend endpoints for managing the Roll Profile.
3. Build the UI for adding/managing Gray Anchors.
4. Implement the RGB Curve editor UI component.
5. Wire the UI state to the modified `convert_image` pipeline.
