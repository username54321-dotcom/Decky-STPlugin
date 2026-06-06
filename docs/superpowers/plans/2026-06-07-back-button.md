# Back Button for Subpages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "← Back" button to the title area of all 3 subpages (Download, InstalledScripts, Settings) that navigates to the main menu.

**Architecture:** Add a `showBack` boolean prop to the shared `PageLayout` component. When true, render a header row with "← Back" + page title above the content panel. Each subpage adds `showBack` to its `<PageLayout>` usage.

**Tech Stack:** TypeScript, React, Decky UI (`@decky/ui`), inline styles

---

## File Structure

| File | Change |
|---|---|
| `src/shared/components/PageLayout.tsx` | Add `showBack` prop; conditionally render back header row |
| `src/DownloadPanel.tsx` | Add `showBack` to PageLayout usage |
| `src/InstalledApps.tsx` | Add `showBack` to PageLayout usage (4 branches) |
| `src/SettingsPanel.tsx` | Add `showBack` to PageLayout usage |

---

### Task 1: Modify `PageLayout` to support back button

**Files:**
- Modify: `src/shared/components/PageLayout.tsx`

- [ ] **Step 1: Add `Navigation` and `ROUTES` imports**

Add to the top of `src/shared/components/PageLayout.tsx`:

```tsx
import { PanelSection, Navigation } from "@decky/ui";
import { ROUTES } from "../constants";
```

Note: `PanelSection` is already imported — just add `Navigation` next to it.

- [ ] **Step 2: Update the interface to add `showBack`**

Change the `PageLayoutProps` interface:

```tsx
interface PageLayoutProps {
  title: string;
  showBack?: boolean;
  children: React.ReactNode;
}
```

- [ ] **Step 3: Implement conditional header row**

Replace the component body with:

```tsx
export function PageLayout({ title, children, showBack }: PageLayoutProps) {
  return (
    <div
      style={{
        marginLeft: "auto",
        marginRight: "auto",
        paddingTop: "72px",
        paddingBottom: "16px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      {showBack ? (
        <>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
            <div
              style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "4px" }}
              onClick={() => Navigation.Navigate(ROUTES.main)}
            >
              <span style={{ fontSize: "16px", lineHeight: 1 }}>←</span>
              <span style={{ fontSize: "13px", color: "var(--gpSystemLighterGrey)" }}>Back</span>
            </div>
            <span style={{ marginLeft: "16px", fontWeight: "bold", fontSize: "14px" }}>
              {title}
            </span>
          </div>
          <PanelSection>{children}</PanelSection>
        </>
      ) : (
        <PanelSection title={title}>{children}</PanelSection>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify the build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

---

### Task 2: Add `showBack` to DownloadPanel

**Files:**
- Modify: `src/DownloadPanel.tsx`

- [ ] **Step 1: Add `showBack` prop**

Change line 13 from:
```tsx
<PageLayout title="Download Lua Script">
```
to:
```tsx
<PageLayout title="Download Lua Script" showBack>
```

- [ ] **Step 2: Verify the build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

---

### Task 3: Add `showBack` to InstalledApps (4 branches)

**Files:**
- Modify: `src/InstalledApps.tsx`

- [ ] **Step 1: Add `showBack` to the loading branch**

Line 53, change:
```tsx
<PageLayout title="Installed Scripts">
```
to:
```tsx
<PageLayout title="Installed Scripts" showBack>
```

- [ ] **Step 2: Add `showBack` to the error branch**

Line 66, change:
```tsx
<PageLayout title="Installed Scripts">
```
to:
```tsx
<PageLayout title="Installed Scripts" showBack>
```

- [ ] **Step 3: Add `showBack` to the empty branch**

Line 99, change:
```tsx
<PageLayout title="Installed Scripts">
```
to:
```tsx
<PageLayout title="Installed Scripts" showBack>
```

- [ ] **Step 4: Add `showBack` to the loaded branch**

Line 130, change:
```tsx
<PageLayout title="Installed Scripts">
```
to:
```tsx
<PageLayout title="Installed Scripts" showBack>
```

- [ ] **Step 5: Verify the build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

---

### Task 4: Add `showBack` to SettingsPanel

**Files:**
- Modify: `src/SettingsPanel.tsx`

- [ ] **Step 1: Add `showBack` prop**

Change line 54 from:
```tsx
<PageLayout title="Settings">
```
to:
```tsx
<PageLayout title="Settings" showBack>
```

- [ ] **Step 2: Verify the build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.
