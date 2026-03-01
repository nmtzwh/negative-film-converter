# Current Status & Next Steps

## Completed So Far
- **Phase 1 (MVP):** Tauri + React + Python sidecar architecture is fully functional. The math for linear negative-to-positive conversion is implemented and tested. Exposure adjustments work.
- **Phase 2 (Core Processing):** Implemented an interactive RGB Histogram, mathematical auto-levels for dynamic range balancing, and a functional Film Base Picker (Manual White Balance) that maps UI clicks to raw image coordinates.
- **Phase 3 (Workflow - Task 1):** Implemented folder browsing and a bottom `FilmStrip` component that lazily loads and renders thumbnails from a selected directory.

## Next Steps (To Pick Up Later)
When resuming development, refer to `docs/plans/2026-03-01-negative-converter-phase-3.md` and start at **Task 2**:
1. **Task 2: State Persistence & Copy/Paste:** Need to write `POST /save_settings` and `/load_settings` endpoints in Python to save the exposure and base_color parameters to local `.json` sidecar files. Update the React UI to save state on slider changes, load state when clicking a film strip thumbnail, and add Copy/Paste buttons.
2. **Task 3: Batch Export:** Implement `POST /export_image` to write full-res converted files to disk, and add a "Batch Export" button in the UI.
3. **Task 4: UI Polish:** Move inline styles to CSS, fix layout alignments, and add loading spinners/tooltips.
