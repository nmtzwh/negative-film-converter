# Sticky Before/After View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sticky "Before/After" toggle button to the UI that allows users to persistently view the unedited original negative, complete with a clear visual "ORIGINAL NEGATIVE" badge overlay.

**Architecture:** Update `src/App.tsx` state to include `isBeforeViewSticky`. The rendered image source will be determined by checking if either `showOriginal` (temporary hotkey) or `isBeforeViewSticky` is true. We'll add a toggle button near the top of the viewport and a badge overlay on the image container.

**Tech Stack:** React, TypeScript, CSS

---

### Task 1: Add Sticky State and Basic Toggle Button

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add new state variable**
In `src/App.tsx`, near the other view states (around line 43):
```typescript
  const [isBeforeViewSticky, setIsBeforeViewSticky] = useState(false);
```

**Step 2: Update image source logic**
In the `<section className="viewport">` of `src/App.tsx`, update the `<img>` `src` attribute:
```tsx
  src={(showOriginal || isBeforeViewSticky) && rawImageUrl ? rawImageUrl : imageUrl} 
```

**Step 3: Add the toggle button**
In `src/App.tsx`, inside the `<section className="viewport">` before the `<img ... />`:
```tsx
  {imageUrl && (
    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, display: 'flex', gap: '10px' }}>
      <button 
        className={`btn ${isBeforeViewSticky ? 'active' : ''}`}
        onClick={() => setIsBeforeViewSticky(!isBeforeViewSticky)}
        disabled={!rawImageUrl}
        title="Toggle Before/After View"
        style={{
          backgroundColor: isBeforeViewSticky ? 'var(--accent)' : 'var(--bg-panel)',
          opacity: 0.9,
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}
      >
        {isBeforeViewSticky ? 'Showing Before' : 'Compare'}
      </button>
    </div>
  )}
```

**Step 4: Verify UI compiles and button toggles**
Run: `npm run tsc`
Expected: Successful compile, no errors.

**Step 5: Commit**
```bash
git add src/App.tsx
git commit -m "feat(ui): add sticky before/after toggle button"
```

---

### Task 2: Add "ORIGINAL NEGATIVE" Visual Badge

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add Badge element**
In `src/App.tsx`, immediately after the `<img .../>` tag, add:
```tsx
  {(showOriginal || isBeforeViewSticky) && rawImageUrl && (
    <div 
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        backgroundColor: 'rgba(255, 0, 0, 0.7)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '0.8rem',
        pointerEvents: 'none',
        zIndex: 5
      }}
    >
      ORIGINAL NEGATIVE
    </div>
  )}
```

**Step 2: Run type check**
Run: `npm run tsc`
Expected: PASS

**Step 3: Commit**
```bash
git add src/App.tsx
git commit -m "feat(ui): add visual badge when showing original negative"
```

---

### Task 3: Auto-Reset Sticky View on Adjustments

**Files:**
- Modify: `src/App.tsx`

**Step 1: Reset on Exposure Change**
Update the exposure `onChange` handler:
```tsx
onChange={(e) => {
  setExposure(parseFloat(e.target.value));
  setIsBeforeViewSticky(false);
}}
```

**Step 2: Reset on Base Color Change**
Update the `Reset WB` button `onClick`:
```tsx
onClick={() => {
  setBaseColor(null);
  setBaseColorSamples([]);
  setIsBeforeViewSticky(false);
}}
```

**Step 3: Reset on Crop**
Update the Crop `onClick` toggle and Reset Crop button:
```tsx
// Done Cropping toggle
onClick={() => {
  setIsCropping(!isCropping);
  if (!isCropping) {
    setIsPickingBase(false);
    setIsPickingAnchor(false);
    setIsBeforeViewSticky(false);
  }
}}

// Reset Crop
onClick={() => {
  setCrop(null);
  setIsBeforeViewSticky(false);
}}
```

**Step 4: Reset on Image Load**
In the `loadFile` function, add:
```typescript
setIsBeforeViewSticky(false);
```

**Step 5: Run type check**
Run: `npm run tsc`
Expected: PASS

**Step 6: Commit**
```bash
git add src/App.tsx
git commit -m "feat(ui): auto-reset before view when making adjustments"
```
