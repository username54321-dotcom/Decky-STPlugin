# Design Spec: Sub-Page Layout Centering

**Date:** 2026-06-03
**Status:** Draft
**Approach:** B — Shared PageLayout Component

## 1. Objective

Add horizontal centering and generous spacing to the sub-pages (Download, Installed Apps, Settings) of the Decky STPlugin QAM panel. The main menu page is explicitly excluded from these changes.

Currently all panels have edge-to-edge content with only a `paddingTop: 8px`. The goal is a centered content block with breathing room on all sides — replicating the Tailwind `mx-auto max-w-sm` effect.

## 2. Scope

### 2.1 In Scope

| Item | Description |
|------|-------------|
| New `PageLayout` component | Shared wrapper providing `max-width` + `margin: auto` centering + generous padding |
| `styles.ts` constants update | Add `pageMaxWidth`, `pageTopPadding`, `pageBottomPadding` |
| DownloadPanel | Replace wrapper div with `<PageLayout>` |
| InstalledApps | Replace wrapper div in both empty and list return paths |
| SettingsPanel | Replace wrapper div with `<PageLayout>` |

### 2.2 Out of Scope

| Item | Reason |
|------|--------|
| Main menu page | Explicitly excluded by user |
| Internal element spacing (`sectionGap`, `rowGap`, `controlsGap`, `dividerMargin`) | Already adequate; Decky's built-in component spacing is sufficient |
| GameSearchDropdown styling | Already has its own card-style layout; no changes needed |
| Any backend or Python files | Pure frontend styling change |

## 3. Architecture

### 3.1 The mx-auto Centering Mechanism

Tailwind's `mx-auto` applies `margin-left: auto; margin-right: auto;` combined with a `max-width`. This creates a content block narrower than its parent, centered with equal whitespace on both sides. Unlike padding (which keeps content full-width with internal gaps), `mx-auto` literally shrinks and centers the block.

**Implementation:**
```css
max-width: 340px;
margin-left: auto;
margin-right: auto;
```

In the Steam Deck QAM (~380px wide), this leaves ~20px per side. On wider desktop panels, the content stays at 340px and remains centered.

### 3.2 Component Structure

```
┌──────────────────────────────────┐
│         QAM Panel (380px+)       │
│                                  │
│  ┌── auto margin ─────────────┐  │
│  │                            │  │
│  │   PageLayout (max 340px)   │  │
│  │   ┌──────────────────────┐ │  │
│  │   │  PanelSection        │ │  │
│  │   │  ┌────────────────┐  │ │  │
│  │   │  │ PanelSectionRow│  │ │  │
│  │   │  │   content...   │  │ │  │
│  │   │  └────────────────┘  │ │  │
│  │   │  ┌────────────────┐  │ │  │
│  │   │  │ PanelSectionRow│  │ │  │
│  │   │  │   content...   │  │ │  │
│  │   │  └────────────────┘  │ │  │
│  │   └──────────────────────┘ │  │
│  │  (paddingTop: 16px)        │  │
│  │  (paddingBottom: 16px)     │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

### 3.3 Reusable Component

Location: `src/shared/components/PageLayout.tsx`

```tsx
import { PanelSection } from "@decky/ui";
import React from "react";
import { SPACING } from "../styles";

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <div
      style={{
        maxWidth: SPACING.pageMaxWidth,
        marginLeft: "auto",
        marginRight: "auto",
        paddingTop: SPACING.pageTopPadding,
        paddingBottom: SPACING.pageBottomPadding,
      }}
    >
      <PanelSection title={title}>
        {children}
      </PanelSection>
    </div>
  );
}
```

The component replaces the current pattern of:
```tsx
<div style={{ paddingTop: SPACING.panelTopPadding }}>
  <PanelSection title="...">
    ...
  </PanelSection>
</div>
```

## 4. Spacing Constants

Add to `src/shared/styles.ts`:

```typescript
export const SPACING = {
  // Existing (unchanged, used by main menu)
  panelTopPadding: "8px",

  // New (added for sub-page centering)
  /** Max width of the centered content block (mx-auto effect) */
  pageMaxWidth: "340px",
  /** Top padding for sub-page content blocks */
  pageTopPadding: "16px",
  /** Bottom padding for sub-page content blocks */
  pageBottomPadding: "16px",

  // Existing (unchanged)
  sectionGap: "16px",
  rowGap: "4px",
  controlsGap: "8px",
  dividerMargin: "12px",
};
```

The existing `panelTopPadding` constant is preserved for the main menu, which remains unchanged.

## 5. Per-Page Changes

### 5.1 DownloadPanel

**Before:** `<div style={{ paddingTop: SPACING.panelTopPadding }}><PanelSection title="Download Lua Script">...</PanelSection></div>`

**After:**
```tsx
<PageLayout title="Download Lua Script">
  {!download.isActive && !showRestartPrompt && <DownloadForm />}
  {download.isActive && <DownloadProgress />}
  {showRestartPrompt && <PostDownloadRestart />}
</PageLayout>
```

### 5.2 InstalledApps

**Before:** Two return paths, each with `<div style={{ paddingTop: SPACING.panelTopPadding }}><PanelSection title="Installed Scripts">...</PanelSection></div>`

**After:** Both return paths wrapped in `<PageLayout title="Installed Scripts">`. This actually eliminates the duplicated wrapper div that both paths share.

### 5.3 SettingsPanel

**Before:** `<div style={{ paddingTop: SPACING.panelTopPadding }}><PanelSection title="Settings">...</PanelSection></div>`

**After:**
```tsx
<PageLayout title="Settings">
  <PanelSectionRow>
    <ToggleField label="Fast Download" ... />
  </PanelSectionRow>
  <PanelSectionRow>
    <div style={{ borderTop: BORDER.divider, ... }} />
  </PanelSectionRow>
  <PanelSectionRow>
    <TextField label="Morrenus API Key" ... />
  </PanelSectionRow>
  ...
</PageLayout>
```

### 5.4 Main Menu

**No changes.** Retains its existing `<div style={{ paddingTop: SPACING.panelTopPadding }}>` wrapper.

## 6. Element Spacing

No changes to internal spacing values (`sectionGap: "16px"`, `dividerMargin: "12px"`, `rowGap: "4px"`, `controlsGap: "8px"`). Decky's built-in `PanelSectionRow` stacking already provides adequate vertical rhythm between controls. The generous page padding (16px top/bottom) plus the centered constraint is sufficient to give the sub-pages a roomier feel.

## 7. Files Changed

| File | Change |
|------|--------|
| `src/shared/styles.ts` | Add `pageMaxWidth`, `pageTopPadding`, `pageBottomPadding` |
| `src/shared/components/PageLayout.tsx` | **New file** — reusable layout component |
| `src/download/DownloadPanel.tsx` | Replace wrapper div with `<PageLayout>` |
| `src/installed/InstalledApps.tsx` | Replace wrapper div in both return paths |
| `src/settings/SettingsPanel.tsx` | Replace wrapper div with `<PageLayout>` |

## 8. Error / Edge Cases

| Scenario | Behavior |
|----------|----------|
| QAM panel narrower than 340px (unlikely) | The max-width constrains to panel width; content will be at panel width but still centered |
| Desktop panel 600px+ wide | Content block stays 340px, centered with generous margins |
| No children passed to PageLayout | Renders empty PanelSection — acceptable edge case |
| Very long title text | Breaks naturally at 340px; styled by Decky's PanelSection title |

## 9. Testing

Manual visual check on actual Steam Deck or Windows Decky Loader:

1. Open each sub-page — verify content is visibly narrower than the QAM panel edges
2. Switch between sub-pages and main menu — verify the main menu is unchanged
3. On a wide desktop panel — verify content is centered, not left-aligned
4. Resize panel (if possible) — verify centering adapts
5. Check InstalledApps with both empty and populated states — both centered
