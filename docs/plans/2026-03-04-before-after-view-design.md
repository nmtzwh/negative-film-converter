# UI/UX Polish - Sticky Before/After View Design

## 1. Overview
The application currently has a "Hold-to-Compare" feature where pressing Space or `\` shows the raw, unedited negative. While useful, it lacks discoverability for new users and doesn't support persistent comparison. This design outlines the addition of a sticky UI toggle for the Before/After view, complete with clear visual indicators to improve the overall user experience.

## 2. Architecture & Components
We will update the frontend React application (`src/App.tsx`) to support a persistent "Before" view mode.

- **State Management:**
  - Introduce `isBeforeViewSticky` (boolean) to track the sticky toggle state alongside the existing temporary `showOriginal` state.
  - The actual rendered image will be a computed value derived from `isBeforeViewSticky XOR showOriginal`.
- **UI Additions:**
  - **Toggle Button:** Add a distinct "Compare" or "Before / After" button in the Viewport's top-right corner (or a floating toolbar) that sets `isBeforeViewSticky = !isBeforeViewSticky`.
  - **Status Badge:** When the "Before" state is active, display a semi-transparent badge reading "ORIGINAL NEGATIVE" layered over the image. This prevents users from forgetting they are looking at the pre-converted state.

## 3. Data Flow & Interactions
1. **User Clicks Toggle:** The `isBeforeViewSticky` state flips. The viewport switches to `rawImageUrl`.
2. **User Uses Hotkey (Spacebar / `\`):** The `showOriginal` state flips while the key is held. 
   - If `isBeforeViewSticky` is false, holding the key shows the "Before" image.
   - If `isBeforeViewSticky` is true, holding the key temporarily shows the "After" image.
3. **Automatic Reset on Edit:** Any interaction that changes the image parameters (adjusting exposure sliders, picking a new film base, cropping, or undo/redo) will automatically set `isBeforeViewSticky` to `false`. This ensures the user instantly sees the result of their action on the converted image.
4. **Loading State:** The toggle button is disabled if `rawImageUrl` is null or if no image is currently loaded.

## 4. Error Handling & Edge Cases
- **Missing RAW Preview:** If `get_raw_preview` fails or hasn't completed, the `rawImageUrl` will be null. The UI button will be disabled to prevent an empty image from being shown.
- **Image Switch:** Switching to a new image via the Film Strip or Open File will reset `isBeforeViewSticky` to false.