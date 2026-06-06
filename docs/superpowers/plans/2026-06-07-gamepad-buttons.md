# Gamepad-Selectable Redownload & Delete Buttons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the redownload and delete icon buttons in InstalledAppCard gamepad-selectable using Decky's `Focusable` wrapper.

**Architecture:** Wrap existing 32x32px `<button>` elements in `<Focusable>` from `@decky/ui`. This registers them in Steam's d-pad focus ring while preserving the exact visual appearance. Focus state is tracked via `onFocus`/`onBlur` on the inner buttons to show a subtle outline when gamepad-focused.

**Tech Stack:** React, TypeScript, `@decky/ui` (`Focusable`)

---

### Task 1: Add Focusable import and focus state

**Files:**
- Modify: `src/installed/components/InstalledAppCard.tsx:1,20`

- [ ] **Step 1: Add `Focusable` to the `@decky/ui` import**

Current import (line 1):
```tsx
import { staticClasses, ConfirmModal, showModal } from "@decky/ui";
```

Change to:
```tsx
import { staticClasses, ConfirmModal, showModal, Focusable } from "@decky/ui";
```

- [ ] **Step 2: Add `focusedBtn` state after `hoveredBtn` state**

Current (line 20):
```tsx
const [hoveredBtn, setHoveredBtn] = useState<"redownload" | "delete" | null>(null);
```

Add after it:
```tsx
const [focusedBtn, setFocusedBtn] = useState<"redownload" | "delete" | null>(null);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

---

### Task 2: Update smallBtnStyle to show focus outline

**Files:**
- Modify: `src/installed/components/InstalledAppCard.tsx:56-69`

- [ ] **Step 1: Add outline style to `smallBtnStyle`**

Current `smallBtnStyle` (lines 56-69):
```tsx
const smallBtnStyle = (which: "redownload" | "delete"): React.CSSProperties => ({
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "4px",
  background: hoveredBtn === which ? "var(--gpBackgroundHard)" : "var(--gpBackgroundMedium)",
  border: "none",
  color: "var(--gpSystemLighterGrey)",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.15s",
});
```

Change to:
```tsx
const smallBtnStyle = (which: "redownload" | "delete"): React.CSSProperties => ({
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "4px",
  background: hoveredBtn === which ? "var(--gpBackgroundHard)" : "var(--gpBackgroundMedium)",
  border: "none",
  outline: focusedBtn === which ? "2px solid var(--gpSystemLighterGrey)" : "none",
  outlineOffset: "2px",
  color: "var(--gpSystemLighterGrey)",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.15s",
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

---

### Task 3: Wrap buttons in Focusable

**Files:**
- Modify: `src/installed/components/InstalledAppCard.tsx:150-169`

- [ ] **Step 1: Replace the button container with Focusable wrappers**

Current (lines 150-169):
```tsx
<div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
  <button
    style={smallBtnStyle("redownload")}
    onClick={handleRedownload}
    onMouseEnter={() => setHoveredBtn("redownload")}
    onMouseLeave={() => setHoveredBtn(null)}
    title="Re-download"
  >
    <FaRedo />
  </button>
  <button
    style={smallBtnStyle("delete")}
    onClick={handleDelete}
    onMouseEnter={() => setHoveredBtn("delete")}
    onMouseLeave={() => setHoveredBtn(null)}
    title="Delete"
  >
    <FaTrash />
  </button>
</div>
```

Change to:
```tsx
<Focusable flow-children="column" style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
  <Focusable onActivate={handleRedownload}>
    <button
      style={smallBtnStyle("redownload")}
      onClick={handleRedownload}
      onMouseEnter={() => setHoveredBtn("redownload")}
      onMouseLeave={() => setHoveredBtn(null)}
      onFocus={() => setFocusedBtn("redownload")}
      onBlur={() => setFocusedBtn(null)}
      title="Re-download"
    >
      <FaRedo />
    </button>
  </Focusable>
  <Focusable onActivate={handleDelete}>
    <button
      style={smallBtnStyle("delete")}
      onClick={handleDelete}
      onMouseEnter={() => setHoveredBtn("delete")}
      onMouseLeave={() => setHoveredBtn(null)}
      onFocus={() => setFocusedBtn("delete")}
      onBlur={() => setFocusedBtn(null)}
      title="Delete"
    >
      <FaTrash />
    </button>
  </Focusable>
</Focusable>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/installed/components/InstalledAppCard.tsx
git commit -m "feat: make redownload/delete buttons gamepad-selectable via Focusable wrapper"
```

---

### Task 4: Verify final build and test

**Files:**
- None (verification only)

- [ ] **Step 1: Run full build**

Run: `pnpm run build`
Expected: Build succeeds, dist/index.js is produced.

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass (no regressions from the change).
