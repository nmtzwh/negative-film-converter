# Negative Film Converter - Phase 4: Refinement & Performance

**Goal:** Improve the core user experience based on feedback: making cropping more intuitive, improving white balance accuracy through multiple points, adding undo/redo capabilities, and optimizing backend performance for smoother slider interactions.

## Task 1: Intuitive Mouse Selection Cropping
- **Current State:** The user must grab one of the 4 corners of a pre-existing full-screen crop box to resize it.
- **Desired State:** The user can click and drag anywhere on the image to draw a brand new crop box. Corner handles will still be available for fine-tuning after the initial draw.
- **Implementation:** 
  - Update `CropOverlay.tsx` to handle `onMouseDown` on the overlay background (not just the handles).
  - Track start coordinates and update the `[x1, y1, x2, y2]` state dynamically as the mouse moves.

## Task 2: Multiple Film Base Points Selection
- **Current State:** Clicking the film base overrides the previous single `base_color` value.
- **Desired State:** Users can click multiple points on the unexposed film border. The application will store an array of these points and compute their average to use as the final `base_color`. This provides a more robust, noise-resistant white balance.
- **Implementation:**
  - Update `App.tsx` state from `baseColor: number[] | null` to support a list of base colors or keep a separate `baseColorSamples: number[][]` state.
  - Calculate the mean of the samples before sending them to the `/convert_image` endpoint.
  - Add a UI list to show the sampled points with a "Clear" button, similar to the Roll Calibration UI.

## Task 3: Undo / Redo Stack
- **Current State:** Mistakes (accidental clicks or slider drags) cannot be easily reverted except by manually resetting.
- **Desired State:** Keyboard shortcuts (Ctrl+Z / Ctrl+Y) and UI buttons to undo/redo changes to Exposure, Crop, and Base Color.
- **Implementation:**
  - Create a custom React hook `useHistory` to track an array of state snapshots.
  - Push a new state snapshot when settings change (debounced for sliders).

## Task 4: Backend Performance Optimization
- **Current State:** Conversions run synchronously on the main FastAPI thread, and adjusting exposure triggers full re-conversions.
- **Desired State:** Faster visual updates when dragging the exposure slider.
- **Implementation:**
  - *Option A:* In the backend, cache the base negative conversion and only re-apply the fast exposure multiplier if the `base_color` and `curve_params` haven't changed.
  - *Option B:* Move the heavy array operations to background threads using `asyncio` or `concurrent.futures` to prevent blocking other API calls (like thumbnail loading).
