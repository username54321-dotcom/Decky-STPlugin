# Installed Apps Layout Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UI issues — narrow page width, oversized buttons, and missing scroll — across all QAM sub-pages.

**Architecture:** Remove the artificial 340px max-width cap from `PageLayout` so content fills the QAM panel naturally. Restructure `InstalledAppCard` to show small stacked icon buttons on the right edge instead of full-width buttons below.

**Tech Stack:** TypeScript, React, inline styles, `@decky/ui` components

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/styles.ts` | Modify | Remove `pageMaxWidth` constant |
| `src/shared/components/PageLayout.tsx` | Modify | Remove `maxWidth` from wrapper div |
| `src/installed/components/InstalledAppCard.tsx` | Modify | Restructure card: right-side stacked small buttons |

---

### Task 1: Remove pageMaxWidth from styles

**Files:**
- Modify: `src/shared/styles.ts:4-5`

- [ ] **Step 1: Remove the `pageMaxWidth` line and its comment**

In `src/shared/styles.ts`, delete these two lines:

```ts
  /** Max width of the centered content block (mx-auto effect) for sub-pages */
  pageMaxWidth: "340px",
```

The `SPACING` object should now go directly from `panelTopPadding` to `pageTopPadding`:

```ts
export const SPACING = {
  /** Top padding to clear the QAM header bar on all panels */
  panelTopPadding: "8px",
  /** Top padding for sub-page content blocks (clears Steam GamepadUI top bar + extra breathing room) */
  pageTopPadding: "72px",
  /** Bottom padding for sub-page content blocks */
  pageBottomPadding: "16px",
  /** Gap between major content sections */
  sectionGap: "16px",
  /** Gap within a section row */
  rowGap: "4px",
  /** Gap between controls in a horizontal group */
  controlsGap: "8px",
  /** Vertical margin for divider lines */
  dividerMargin: "12px",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/styles.ts
git commit -m "fix: remove artificial 340px page width cap"
```

---

### Task 2: Remove maxWidth from PageLayout

**Files:**
- Modify: `src/shared/components/PageLayout.tsx:13-14`

- [ ] **Step 1: Remove the `maxWidth` line from the wrapper div style**

In `src/shared/components/PageLayout.tsx`, delete this line from the style object:

```ts
        maxWidth: SPACING.pageMaxWidth,
```

Also remove `SPACING` from the import since it's no longer used:

```ts
import { PanelSection } from "@decky/ui";
import React from "react";
```

The full file should become:

```tsx
import { PanelSection } from "@decky/ui";
import React from "react";

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <div
      style={{
        marginLeft: "auto",
        marginRight: "auto",
        paddingTop: "72px",
        paddingBottom: "16px",
      }}
    >
      <PanelSection title={title}>
        {children}
      </PanelSection>
    </div>
  );
}
```

Note: The padding values are inlined since the `SPACING` import is removed. If you prefer to keep the import, only remove the `maxWidth` line and keep the rest as-is.

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/PageLayout.tsx
git commit -m "fix: let PageLayout fill QAM panel width naturally"
```

---

### Task 3: Restructure InstalledAppCard with right-side stacked buttons

**Files:**
- Modify: `src/installed/components/InstalledAppCard.tsx`

- [ ] **Step 1: Replace the entire return JSX of InstalledAppCard**

In `src/installed/components/InstalledAppCard.tsx`, replace the return statement (lines 54-143) with the new layout. The key changes:
- Buttons move from a separate row below into the main flex row as a right-side vertical column
- Buttons become small 32×32px icon-only elements with hover states
- Remove `ButtonItem` import (no longer used for these buttons)

First, update the imports — remove `ButtonItem` and `ControlsList` since they're no longer used in this file:

```tsx
import { staticClasses, ConfirmModal, showModal } from "@decky/ui";
import { callable, toaster } from "@decky/api";
import React, { useState } from "react";
import { FaTrash, FaRedo, FaGamepad, FaExclamationTriangle } from "react-icons/fa";
import type { InstalledApp } from "../../shared/types";
import { CARD } from "../../shared/styles";
```

Then replace the return JSX (lines 54-143) with:

```tsx
  const [hoveredBtn, setHoveredBtn] = useState<"redownload" | "delete" | null>(null);

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

  return (
    <div
      style={{
        background: CARD.background,
        border: downloadError ? "1px solid var(--gpSystemRed)" : CARD.border,
        borderRadius: CARD.borderRadius,
        padding: CARD.padding,
      }}
    >
      <div style={{ display: "flex", gap: CARD.padding, alignItems: "center" }}>
        <div style={{ flexShrink: 0, width: CARD.capsuleWidth, height: CARD.capsuleHeight }}>
          {imgError ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--gpBackgroundMedium)",
                borderRadius: "4px",
              }}
            >
              <FaGamepad style={{ color: "var(--gpSystemLighterGrey)", fontSize: "20px" }} />
            </div>
          ) : (
            <img
              src={capsuleUrl}
              alt={app.name || `App ${app.appid}`}
              loading="lazy"
              onError={() => setImgError(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "4px",
              }}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className={staticClasses.Label}
            style={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {app.name || `App ${app.appid}`}
          </div>
          <div
            style={{
              color: "var(--gpSystemLighterGrey)",
              fontSize: "12px",
              marginTop: "2px",
            }}
          >
            App ID: {app.appid}
          </div>
          {downloadError && (
            <div
              style={{
                color: "var(--gpSystemRed)",
                fontSize: "12px",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaExclamationTriangle style={{ fontSize: "10px" }} />
              Download failed — click to retry
            </div>
          )}
        </div>

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
      </div>
    </div>
  );
}
```

Also add the `hoveredBtn` state near the top of the component, after the existing `useState` calls:

```tsx
  const [hoveredBtn, setHoveredBtn] = useState<"redownload" | "delete" | null>(null);
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/installed/components/InstalledAppCard.tsx
git commit -m "fix: restyle InstalledAppCard with compact right-side buttons"
```

---

### Task 4: Verify all pages look correct

- [ ] **Step 1: Run the full build**

```bash
pnpm run build
```

Expected: `dist/index.js` produced without errors.

- [ ] **Step 2: Visual verification checklist**

Load the plugin in Decky Loader and verify:

1. **Download page** — fills QAM panel width, content centered
2. **Installed Apps page** — fills QAM width, cards show capsule | text | stacked buttons
3. **Settings page** — fills QAM width, toggles and fields use full width
4. **Installed Apps scroll** — with 4+ installed apps, the list scrolls within the QAM panel
5. **Redownload button** — clicking triggers toast and download
6. **Delete button** — clicking triggers confirmation modal
7. **Button hover** — background changes on hover

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: polish layout after visual verification"
```
