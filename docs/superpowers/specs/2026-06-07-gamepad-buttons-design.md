# Gamepad-Selectable Redownload & Delete Buttons

**Date:** 2026-06-07
**Status:** Approved
**Scope:** Single file change (`src/installed/components/InstalledAppCard.tsx`)

## Problem

The redownload and delete buttons in `InstalledAppCard` are plain HTML `<button>` elements with no gamepad support. Gamepad users cannot navigate to or activate these buttons via d-pad/A-button. All other interactive elements in the plugin use Decky UI components that are gamepad-aware.

## Solution

Wrap each button in a `<Focusable>` container from `@decky/ui`. `Focusable` is Decky's low-level primitive that registers any child element in Steam's GamepadUI d-pad focus ring.

## Design

### Approach: Focusable Wrapper

**Why `Focusable` over `ButtonItem`:**
- `ButtonItem` is designed for larger text-based QAM buttons — it would change the 32x32px icon-only visual
- `Focusable` wraps any custom element while preserving exact visual appearance
- Steam's GamepadUI handles focus ring rendering automatically

### Implementation

**File:** `src/installed/components/InstalledAppCard.tsx`

**Changes:**

1. Import `Focusable` from `@decky/ui`
2. Wrap each `<button>` in `<Focusable onActivate={handler}>`
3. Add `flow-children="column"` to the parent container so d-pad up/down navigates between buttons
4. Track focus state (`focusedBtn`) via `onFocus`/`onBlur` on the inner `<button>` elements
5. Add conditional outline style to `smallBtnStyle` when focused (gamepad focus indicator)

**Before:**
```tsx
<button style={smallBtnStyle("redownload")} onClick={handleRedownload} ...>
  <FaRedo />
</button>
<button style={smallBtnStyle("delete")} onClick={handleDelete} ...>
  <FaTrash />
</button>
```

**After:**
```tsx
<Focusable flow-children="column">
  <Focusable onActivate={handleRedownload}>
    <button
      style={smallBtnStyle("redownload")}
      onClick={handleRedownload}
      onFocus={() => setFocusedBtn("redownload")}
      onBlur={() => setFocusedBtn(null)}
      ...
    >
      <FaRedo />
    </button>
  </Focusable>
  <Focusable onActivate={handleDelete}>
    <button
      style={smallBtnStyle("delete")}
      onClick={handleDelete}
      onFocus={() => setFocusedBtn("delete")}
      onBlur={() => setFocusedBtn(null)}
      ...
    >
      <FaTrash />
    </button>
  </Focusable>
</Focusable>
```

### Focus Indicator

When a `Focusable` child receives gamepad focus, add a visible outline to the inner button:

```tsx
const [focusedBtn, setFocusedBtn] = useState<"redownload" | "delete" | null>(null);

const smallBtnStyle = (which: "redownload" | "delete"): React.CSSProperties => ({
  // ... existing styles ...
  outline: focusedBtn === which ? "2px solid var(--gpSystemLighterGrey)" : "none",
  outlineOffset: "2px",
});
```

### Interaction Model

| Input | Action |
|-------|--------|
| D-pad up/down | Navigate between redownload and delete buttons |
| A-button | Activate focused button (same as click) |
| B-button | Back/cancel (handled by Steam) |
| Mouse hover | Still works via existing `onMouseEnter`/`onMouseLeave` |
| Mouse click | Still works via existing `onClick` |

### Edge Cases

- **Disabled state:** If a download is in progress, the redownload button should be visually disabled. `Focusable` does not have a `disabled` prop — we handle this by checking state in `onActivate` and returning early.
- **Focus trapping:** Steam's GamepadUI handles focus trapping in the QAM automatically.
- **Multiple cards:** Each card's buttons are independent; focus moves between cards naturally.

## Scope

- **In scope:** Making redownload/delete buttons gamepad-selectable
- **Out of scope:** Other plain `<button>` elements in the codebase (update banners, etc.) — those are separate concerns

## Verification

1. Open Decky QAM → Installed Apps tab
2. D-pad navigate to a game card
3. Verify d-pad up/down moves focus between redownload and delete buttons
4. Verify A-button activates the focused button
5. Verify mouse hover and click still work normally
6. Verify focus outline is visible on gamepad focus
