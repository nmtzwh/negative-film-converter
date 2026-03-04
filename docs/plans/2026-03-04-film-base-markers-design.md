# Film Base Markers Design

## Objective
Enhance the "Pick Film Base" feature by visualizing the selected reference points with high-contrast markers over the image. The chosen film base positions will also be recorded and saved to per-photo configuration files so they are restored when an image is reloaded.

## Architecture & Data Flow

### 1. Data Structure Updates
To track coordinates alongside the sampled color, we will update the `baseColorSamples` state from a simple array of colors `number[][]` to an array of objects:

```typescript
interface ColorSample {
  color: number[];
  x: number; // Normalized X coordinate (0-1)
  y: number; // Normalized Y coordinate (0-1)
}
```

* **Frontend State:** `App.tsx` and `useHistory.ts` will use `ColorSample[]` for `baseColorSamples`.
* **API Definitions:** `api.ts` will be updated to include `base_color_samples` in the `Settings` interface and the `saveSettings` function signature.
* **Backend Models:** `backend/server.py` will update `SettingsRequest` to accept `base_color_samples: list[dict] | None` and `load_settings` to read it and return it.

### 2. Marker Component (`src/components/BaseColorMarkers.tsx`)
A new React component will be created to render the markers over the image. It will function similarly to `CropOverlay` to ensure correct alignment regardless of image scaling, panning, or window resizing.

* It accepts the array of `ColorSample`s, `imgRef`, `scale`, and `pan`.
* It calculates the image layout using `object-fit: contain` mechanics.
* It maps over the coordinates and renders an absolute positioned `div` representing a "Target / Crosshair" (⌖) icon.
* The markers will have a drop shadow or contrasting outline to ensure they are visible against any image background.

### 3. State Management Flow
1. **Selection:** When the user clicks the image in "Pick Film Base" mode, `App.tsx` captures the normalized coordinates and the sampled color, adding a new `ColorSample` object to `baseColorSamples`.
2. **Rendering:** The UI instantly reflects this by rendering a new crosshair over the image via the `BaseColorMarkers` component.
3. **Persistence:** The debounced auto-save triggers, passing the new `baseColorSamples` array down to `backend/server.py`, saving it permanently in the `.json` file for that photo alongside the aggregated `baseColor`.
4. **Restoration:** When a photo is loaded, `loadSettings` restores `baseColorSamples`, immediately restoring the visual markers. The aggregated `baseColor` is also restored independently (as it is today).

## Trade-offs and Considerations
* We chose to create a new component `BaseColorMarkers.tsx` rather than inline the marker rendering in `App.tsx` to keep the main application file clean and encapsulate the complex layout math required to align markers over a scaled/panned image.
* We are adding `base_color_samples` to the permanent settings file. This is purely for visualization; the actual calculated `base_color` is still saved and used for the math. This ensures backward compatibility (old files without samples still work).