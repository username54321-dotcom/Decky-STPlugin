# Update Button Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix overlapping button layout in update notification by replacing ButtonItem with native button elements in both SettingsPanel.tsx and index.tsx.

**Architecture:** Replace `ButtonItem` components with native `<button>` elements styled to match Steam UI, placed inside properly constrained flex containers. Maintain existing functionality while fixing layout issues.

**Tech Stack:** React, TypeScript, inline styles (existing codebase pattern)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/SettingsPanel.tsx` | Modify | Replace ButtonItem with native buttons in update notification (lines 120-157) |
| `src/index.tsx` | Modify | Replace ButtonItem with native buttons in main panel banner (lines 33-75) |
| `src/shared/styles.ts` | Modify | Add shared button style constants (optional, for DRY) |

---

### Task 1: Fix SettingsPanel.tsx Button Layout

**Files:**
- Modify: `src/SettingsPanel.tsx:120-157`

- [ ] **Step 1: Remove ButtonItem import if not used elsewhere**

Check if `ButtonItem` is used anywhere else in SettingsPanel.tsx. If not, remove it from the import statement on line 5.

Current import (line 1-7):
```typescript
import {
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
  showModal,
} from "@decky/ui";
```

If `ButtonItem` is only used in the update notification section, change to:
```typescript
import {
  PanelSectionRow,
  ToggleField,
  TextField,
  showModal,
} from "@decky/ui";
```

- [ ] **Step 2: Replace flex container and ButtonItem components**

Replace lines 132-154 (the flex container with ButtonItem components) with:

```typescript
<div style={{ 
  display: "flex", 
  gap: "8px",
  flexWrap: "wrap",
}}>
  {updateStatus.releaseUrl && (
    <button
      style={{
        flex: 1,
        minWidth: 0,
        padding: "8px 16px",
        background: "rgba(255, 255, 255, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: "4px",
        color: "white",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold",
      }}
      onClick={() => {
        window.open(updateStatus.releaseUrl!, "_blank");
      }}
    >
      View Release
    </button>
  )}
  <button
    style={{
      flex: 1,
      minWidth: 0,
      padding: "8px 16px",
      background: updateStatus.installing 
        ? "rgba(255, 255, 255, 0.05)" 
        : "rgba(0, 255, 0, 0.2)",
      border: "1px solid rgba(0, 255, 0, 0.3)",
      borderRadius: "4px",
      color: "white",
      cursor: updateStatus.installing ? "not-allowed" : "pointer",
      fontSize: "14px",
      fontWeight: "bold",
      opacity: updateStatus.installing ? 0.6 : 1,
    }}
    onClick={async () => {
      const installed = await install();
      if (installed && updateStatus.latestVersion) {
        showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
      }
    }}
    disabled={updateStatus.installing}
  >
    {updateStatus.installing ? "Installing..." : "Install Now"}
  </button>
</div>
```

- [ ] **Step 3: Verify the changes compile and render correctly**

Run: `pnpm build` (or equivalent build command)
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Test in Steam Deck UI**

1. Open plugin settings
2. Trigger an update check
3. Verify "View Release" and "Install Now" buttons are side-by-side without overlap
4. Verify "View Release" opens release URL in browser
5. Verify "Install Now" triggers installation and shows "Installing..." state

- [ ] **Step 5: Commit**

```bash
git add src/SettingsPanel.tsx
git commit -m "fix: replace ButtonItem with native buttons in SettingsPanel update notification"
```

---

### Task 2: Fix index.tsx Button Layout

**Files:**
- Modify: `src/index.tsx:33-75`

- [ ] **Step 1: Check if ButtonItem is used elsewhere in index.tsx**

Review the entire index.tsx file. If `ButtonItem` is only used in the update banner (lines 49-72), remove it from the import statement on line 4.

Current import (line 1-10):
```typescript
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
  ControlsList,
  ErrorBoundary,
  showModal,
} from "@decky/ui";
```

If `ButtonItem` is only used in the update banner, change to:
```typescript
import {
  PanelSection,
  PanelSectionRow,
  Navigation,
  staticClasses,
  ControlsList,
  ErrorBoundary,
  showModal,
} from "@decky/ui";
```

- [ ] **Step 2: Replace flex container and ButtonItem components**

Replace lines 47-73 (the flex container with ButtonItem components) with:

```typescript
<div style={{ 
  display: "flex", 
  gap: "8px",
  flexWrap: "wrap",
}}>
  {updateStatus.releaseUrl && (
    <button
      style={{
        flex: 1,
        minWidth: 0,
        padding: "8px 16px",
        background: "rgba(255, 255, 255, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: "4px",
        color: "white",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold",
      }}
      onClick={() => {
        window.open(updateStatus.releaseUrl!, "_blank");
      }}
    >
      View
    </button>
  )}
  <button
    style={{
      flex: 1,
      minWidth: 0,
      padding: "8px 16px",
      background: updateStatus.installing 
        ? "rgba(255, 255, 255, 0.05)" 
        : "rgba(0, 255, 0, 0.2)",
      border: "1px solid rgba(0, 255, 0, 0.3)",
      borderRadius: "4px",
      color: "white",
      cursor: updateStatus.installing ? "not-allowed" : "pointer",
      fontSize: "14px",
      fontWeight: "bold",
      opacity: updateStatus.installing ? 0.6 : 1,
    }}
    onClick={async () => {
      const installed = await install();
      if (installed && updateStatus.latestVersion) {
        showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
      }
    }}
    disabled={updateStatus.installing}
  >
    {updateStatus.installing ? "Installing..." : "Install"}
  </button>
  <button
    style={{
      flex: 1,
      minWidth: 0,
      padding: "8px 16px",
      background: "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "4px",
      color: "white",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "bold",
    }}
    onClick={() => setBannerDismissed(true)}
  >
    Dismiss
  </button>
</div>
```

- [ ] **Step 3: Verify the changes compile and render correctly**

Run: `pnpm build` (or equivalent build command)
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Test in Steam Deck UI**

1. Open main plugin panel
2. Trigger an update check
3. Verify "View", "Install", and "Dismiss" buttons are side-by-side without overlap
4. Verify "View" opens release URL in browser
5. Verify "Install" triggers installation and shows "Installing..." state
6. Verify "Dismiss" hides the banner

- [ ] **Step 5: Commit**

```bash
git add src/index.tsx
git commit -m "fix: replace ButtonItem with native buttons in main panel update banner"
```

---

### Task 3: (Optional) Extract Shared Button Styles

**Files:**
- Modify: `src/shared/styles.ts`

- [ ] **Step 1: Add shared button style constants to styles.ts**

Add the following to `src/shared/styles.ts`:

```typescript
// Button styles for update notifications
export const BUTTON = {
  base: {
    flex: 1,
    minWidth: 0,
    padding: "8px 16px",
    borderRadius: "4px",
    color: "white",
    fontSize: "14px",
    fontWeight: "bold" as const,
  },
  secondary: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    cursor: "pointer",
  },
  primary: {
    background: "rgba(0, 255, 0, 0.2)",
    border: "1px solid rgba(0, 255, 0, 0.3)",
    cursor: "pointer",
  },
  disabled: {
    background: "rgba(255, 255, 255, 0.05)",
    cursor: "not-allowed",
    opacity: 0.6,
  },
} as const;
```

- [ ] **Step 2: Update SettingsPanel.tsx to use shared styles**

Import `BUTTON` from shared styles and apply to buttons:

```typescript
import { SPACING, BORDER, BUTTON } from "./shared/styles";
```

Then use spread syntax:
```typescript
<button style={{ ...BUTTON.base, ...BUTTON.secondary }}>
  View Release
</button>
```

- [ ] **Step 3: Update index.tsx to use shared styles**

Same pattern as SettingsPanel.tsx.

- [ ] **Step 4: Verify build and test**

Run: `pnpm build`
Test both locations in Steam Deck UI.

- [ ] **Step 5: Commit**

```bash
git add src/shared/styles.ts src/SettingsPanel.tsx src/index.tsx
git commit -m "refactor: extract shared button styles for update notifications"
```

---

## Success Criteria

After completing all tasks:

1. ✅ Buttons are properly aligned side-by-side without overlap in both locations
2. ✅ Buttons have consistent sizing and spacing
3. ✅ Visual appearance matches Steam UI aesthetic
4. ✅ Functionality remains unchanged (View Release opens URL, Install triggers download, Dismiss hides banner)
5. ✅ Works in both Settings panel and main panel banner
6. ✅ Build succeeds with no TypeScript errors
7. ✅ No regression in existing functionality