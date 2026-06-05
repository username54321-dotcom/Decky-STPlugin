# Design Spec: Installed Apps Card Layout + Page Width Fix

**Date:** 2026-06-03
**Status:** Draft
**Scope:** Frontend only — `PageLayout`, `InstalledAppCard`, `styles.ts`

## 1. Problem

Three UI issues visible in the Installed Apps panel:

| Issue | Detail |
|-------|--------|
| Pages too narrow | `pageMaxWidth: 340px` artificially constrains all sub-pages. Content should fill the QAM panel naturally. |
| Buttons too large | Redownload and Delete use full-width `ButtonItem layout="below"` — huge, wastes vertical space. |
| No scroll | Long lists get cut off with no way to scroll. |

## 2. Changes

### 2.1 PageLayout — Fluid Width

**File:** `src/shared/components/PageLayout.tsx`

Remove `maxWidth: SPACING.pageMaxWidth` from the wrapper div. Keep `marginLeft/right: auto` for centering. The QAM panel itself constrains width — no need for an artificial cap.

```tsx
// Before
maxWidth: SPACING.pageMaxWidth,  // 340px

// After
// Remove maxWidth entirely — let QAM panel width dictate
```

Also remove `pageMaxWidth` from `src/shared/styles.ts`.

### 2.2 InstalledAppCard — Right-Side Stacked Buttons

**File:** `src/installed/components/InstalledAppCard.tsx`

Restructure the card layout from:

```
[Capsule] [Name + App ID]
[  Redownload  ] [  Delete  ]     ← full-width, below
```

To:

```
[Capsule] [Name + App ID]  [↻]    ← small icon buttons
           [App ID]        [🗑]    ← stacked on right edge
```

**Implementation:**

- Keep the existing flex row: capsule (left) + text (center) + buttons (right)
- Wrap buttons in a vertical flex column with `flexShrink: 0`
- Replace `ButtonItem layout="below"` with small clickable `div` elements styled as 32×32px icon buttons
- Use `cursor: pointer`, hover background, `borderRadius: 4px`
- Remove the separate button row below the card content — buttons move into the main flex row
- Add `alignItems: "center"` to the main row so buttons center vertically against the text

**Button styling:**

```tsx
const SMALL_BUTTON: React.CSSProperties = {
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "4px",
  background: "var(--gpBackgroundMedium)",
  border: "none",
  color: "var(--gpSystemLighterGrey)",
  cursor: "pointer",
  flexShrink: 0,
};
```

Hover state via `onMouseEnter`/`onMouseLeave` toggling background to `var(--gpBackgroundHard)`.

### 2.3 Scrollability

No explicit changes needed. The QAM panel provides its own scroll container. Once the artificial 340px width cap is removed and the card height is reduced (smaller buttons), long lists will scroll naturally within the QAM panel.

## 3. Files Changed

| File | Change |
|------|--------|
| `src/shared/styles.ts` | Remove `pageMaxWidth` constant |
| `src/shared/components/PageLayout.tsx` | Remove `maxWidth` from wrapper div |
| `src/installed/components/InstalledAppCard.tsx` | Restructure layout: right-side stacked small buttons |

## 4. What Does NOT Change

- Backend / Python code
- IPC contract
- Other panels (DownloadPanel, SettingsPanel) — they benefit automatically from the PageLayout fix
- Button functionality (redownload, delete) — same handlers, same modals
- Card data display (name, App ID, capsule image)

## 5. Verification

- All three sub-pages (Download, Installed, Settings) should fill QAM panel width naturally
- Installed Apps: cards show capsule left, text center, small stacked buttons right
- Installed Apps: long lists scroll within QAM panel
- Redownload button triggers same toast + download flow
- Delete button triggers same confirmation modal
- Hover states work on small buttons
