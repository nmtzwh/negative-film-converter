# Advanced Color Grading - Tone Curve Editor Design

## 1. Overview
To provide advanced users with precise tonal and color control over their negative conversions, we are introducing a Tone Curve Editor. This feature allows users to manipulate Master (RGB), Red, Green, and Blue curves independently using interactive control points, allowing for granular adjustments to contrast, shadows, highlights, and color balances (e.g., removing a color cast in the shadows).

## 2. UI/UX Placement and Interaction
The editor will be integrated into the right-hand control panel to maintain a clean layout.

- **Placement:** The `<ToneCurveEditor>` component will be located in the **Right Sidebar** of `App.tsx`, positioned immediately below the Histogram panel and above the Image Metadata section.
- **Dimensions & Layout:** The editor will match the width of the Histogram (approx. 220px to 250px) to form a neat, aligned column.
- **Controls:**
  - **Channel Tabs:** Four compact toggle buttons (`RGB`, `R`, `G`, `B`) above the graph to select the active channel.
  - **Graph Interface:** A square SVG or Canvas showing a grid and a diagonal line (from bottom-left to top-right).
  - **Interaction Rules:**
    - **Add Point:** Clicking on the curve or grid adds a new control point.
    - **Move Point:** Dragging a point adjusts its `x` and `y` coordinates (clamped between 0 and 1, and maintaining left-to-right order).
    - **Delete Point:** Double-clicking a point, or dragging it significantly outside the graph boundaries, removes it.
    - **Endpoints:** The absolute minimum (0,0) and maximum (1,1) points can be moved vertically but not horizontally, and cannot be deleted.
  - **Reset Button:** A "Reset Curve" link/button to flatten the currently active channel's curve back to default.

## 3. Data Flow & State Management
- **React State:** We will define a `Curves` type:
  ```typescript
  type Point = [number, number]; // [x, y] normalized 0.0 to 1.0
  type Curves = {
    rgb: Point[];
    r: Point[];
    g: Point[];
    b: Point[];
  }
  ```
  The default state for all arrays is `[[0, 0], [1, 1]]`.
- **History & Saving:** This `curves` state will be added to the `useHistory` undo/redo stack and to the `Settings` object for saving in `.json` sidecars.
- **API Payload:** The `/convert_image` and `/export_image` endpoints will be updated to accept an optional `user_curves` dictionary mapping to these arrays.

## 4. Backend Architecture & Math
We will add `scipy` to `backend/requirements.txt` to handle the mathematical interpolation of the user's arbitrary control points into a smooth curve.

1. **Interpolation:** In `converter.py` (or a new `user_curves.py` module), we will use `scipy.interpolate.CubicSpline` or `PchipInterpolator` to take the normalized `[x,y]` points and generate a 256-element array representing the y-values for x in range 0-255.
2. **LUT Generation:** We will create a Lookup Table (LUT) of `dtype=np.uint8` for each channel. The Master (RGB) LUT will be combined with the individual R, G, and B LUTs.
3. **Application:** After the image has been inverted and the basic exposure applied (while it is in the 8-bit `[0, 255]` space right before JPEG encoding and histogram calculation), we will apply the LUTs using `cv2.LUT()`. This is highly optimized and very fast.

## 5. Error Handling & Edge Cases
- If the user provides points that result in a spline overshooting bounds (y < 0 or y > 1), the backend will use `np.clip` to ensure the LUT values stay strictly within the `0-255` range.
- Ensuring the `x` coordinates are strictly monotonically increasing before passing to `scipy` is required to prevent interpolation crashes. The frontend will enforce this by sorting/clamping points during dragging.