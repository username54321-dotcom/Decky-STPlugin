# NavTile Decky-Native Rework Design

**Date:** 2026-06-08  
**Status:** Approved  

## Goal

Rework `src/main/NavTile.tsx` to use native Decky UI components (`ButtonItem`) instead of raw `<Focusable>` + custom inline styles, while preserving the two-line card layout (icon, title, description).

## Component Structure

**NavTile** becomes a thin wrapper around `ButtonItem`:

```
NavTile (src/main/NavTile.tsx)
├── imports: ButtonItem, Navigation (from @decky/ui)
├── props: { icon, title, description, route } (unchanged)
└── renders: <ButtonItem layout="below" onClick={...}>
       └── children: icon + title + description (minimal inline layout styles)
```

### Before/After

```tsx
// BEFORE — raw Focusable + custom styles
<Focusable
  onActivate={() => Navigation.Navigate(route)}
  style={NAV_TILE.container}
  className={focusRingClasses.FocusRing}
  flow-children="row"
>
  <span style={NAV_TILE.icon}>{icon}</span>
  <div style={NAV_TILE.textBlock}>
    <span style={NAV_TILE.title}>{title}</span>
    <span style={NAV_TILE.description}>{description}</span>
  </div>
</Focusable>

// AFTER — native ButtonItem
<ButtonItem layout="below" onClick={() => Navigation.Navigate(route)}>
  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
    <span style={{ fontSize: "22px", color: "var(--gpSystemLighterGrey)", flexShrink: 0, width: "28px", textAlign: "center" }}>{icon}</span>
    <div>
      <div style={{ fontWeight: "bold" }}>{title}</div>
      <div style={{ fontSize: "12px", color: "var(--gpSystemLighterGrey)" }}>{description}</div>
    </div>
  </div>
</ButtonItem>
```

## Data Flow

Pure presentation component — no state, no callables, no events:

```
User focuses NavTile (gamepad) → ButtonItem native focus ring
User presses A → ButtonItem fires onClick → Navigation.Navigate(route) → QAM transitions
```

## Files Changed

| File | Change |
|------|--------|
| `src/main/NavTile.tsx` | Rewrite: replace `Focusable` with `ButtonItem`, remove custom style objects |
| `src/main/styles.ts` | Remove `NAV_TILE` export (no longer referenced) |
| `src/MainPanel.tsx` | Wrap each `<NavTile>` in `<PanelSectionRow>` |
| `src/__tests__/NavTile.test.tsx` | Update mock from `Focusable` to `ButtonItem`, remove hover tests |

## What Stays the Same

- Props interface: `{ icon, title, description, route }`
- Icon imports in MainPanel: `FaDownload`, `FaBox`, `FaCog`
- All other components, routes, and behavior

## Testing

- Render: title, description, and icon all appear in output
- Click: simulates click, asserts `Navigation.Navigate` called with correct route
- No hover test — ButtonItem handles hover/focus natively (Decky internal behavior)

## Design Decisions

- **Not using `Field`:** `Field` is a settings-row component, not a clickable action tile. Wrapping it for clickability would be awkward.
- **Not keeping `Focusable`:** Defeats the purpose — the goal is native Decky components.
- **Caller handles `PanelSectionRow`:** Follows the standard Decky QAM pattern (`PanelSectionRow > ButtonItem`). Keeping NavTile self-contained would hide the layout structure.
- **Inline styles for children:** Only icon sizing and text colors need custom values. Everything else (padding, border-radius, focus ring, hover) comes from ButtonItem natively.
- **Removing `NAV_TILE` styles:** All style objects in `NAV_TILE` become redundant — ButtonItem handles padding, border-radius, cursor, and focus appearance.
