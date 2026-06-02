# Page Layout Centering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add horizontal centering and generous spacing to the three sub-pages (Download, Installed Apps, Settings) of the Decky STPlugin QAM panel using a shared `<PageLayout>` component with the Tailwind `mx-auto max-w-sm` effect.

**Architecture:** A new `<PageLayout>` component wraps `<PanelSection>` with `maxWidth: 340px` + `margin: auto` to create a centered content block. Three sub-pages replace their wrapper `<div>` with `<PageLayout>`. Spacing constants are added to `styles.ts`. Main menu is untouched.

**Tech Stack:** TypeScript, React, Decky UI components (`@decky/ui`)

---

### Task 1: Add spacing constants to styles.ts

**Files:**
- Modify: `src/shared/styles.ts:1-12`

- [ ] **Step 1: Add new spacing constants**

Edit `src/shared/styles.ts` to add `pageMaxWidth`, `pageTopPadding`, and `pageBottomPadding` after the existing `panelTopPadding`:

```typescript
export const SPACING = {
  /** Top padding to clear the QAM header bar on all panels */
  panelTopPadding: "8px",
  /** Max width of the centered content block (mx-auto effect) for sub-pages */
  pageMaxWidth: "340px",
  /** Top padding for sub-page content blocks */
  pageTopPadding: "16px",
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

- [ ] **Step 2: Verify no other code references the old constant names**

Run: `rg "panelTopPadding" src/` — should show 5 references (1 in styles.ts, 4 in page components that will all be updated in later tasks).

---

### Task 2: Create PageLayout component

**Files:**
- Create: `src/shared/components/PageLayout.tsx`

- [ ] **Step 1: Create the component file**

Create `src/shared/components/PageLayout.tsx`:

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

The component:
- Uses `maxWidth: "340px"` to constrain the content block
- Uses `marginLeft/Right: "auto"` to center it — this is the `mx-auto` effect
- Adds 16px top and bottom padding for generous breathing room
- Wraps children in `<PanelSection title={title}>` just like the current pattern
- The existing `<PanelSectionRow>` components inside `children` will fill the PanelSection width

- [ ] **Step 2: Verify the file was created**

Run: `Test-Path "src/shared/components/PageLayout.tsx"` — should return True.

---

### Task 3: Update DownloadPanel to use PageLayout

**Files:**
- Modify: `src/download/DownloadPanel.tsx`

- [ ] **Step 1: Replace the wrapper div with PageLayout**

Edit `src/download/DownloadPanel.tsx`:

1. Add import at the top (after existing imports):
   ```typescript
   import { PageLayout } from "../shared/components/PageLayout";
   ```

2. Remove `import { SPACING } from "../shared/styles";` — it was only used for `SPACING.panelTopPadding` which is no longer needed.

3. Replace the wrapper div + PanelSection:
   ```tsx
   export function DownloadPanel() {
     const [showRestartPrompt, setShowRestartPrompt] = useState(false);
     const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

     return (
       <PageLayout title="Download Lua Script">
         {!download.isActive && !showRestartPrompt && (
           <DownloadForm onStart={download.start} />
         )}
         {download.isActive && (
           <DownloadProgress state={download.state!} onCancel={download.cancel} />
         )}
         {showRestartPrompt && (
           <PostDownloadRestart onDismiss={() => setShowRestartPrompt(false)} />
         )}
       </PageLayout>
     );
   }
   ```

The final file should look like:

```tsx
import { PanelSection } from "@decky/ui";
import React, { useState } from "react";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./DownloadProgress";
import { PostDownloadRestart } from "./PostDownloadRestart";
import { useDownloadLifecycle } from "./hooks/useDownloadLifecycle";
import { PageLayout } from "../shared/components/PageLayout";

export function DownloadPanel() {
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

  return (
    <PageLayout title="Download Lua Script">
      {!download.isActive && !showRestartPrompt && (
        <DownloadForm onStart={download.start} />
      )}
      {download.isActive && (
        <DownloadProgress state={download.state!} onCancel={download.cancel} />
      )}
      {showRestartPrompt && (
        <PostDownloadRestart onDismiss={() => setShowRestartPrompt(false)} />
      )}
    </PageLayout>
  );
}
```

---

### Task 4: Update InstalledApps to use PageLayout

**Files:**
- Modify: `src/installed/InstalledApps.tsx`

- [ ] **Step 1: Add import, replace both wrapper divs**

Edit `src/installed/InstalledApps.tsx`:

1. Add import at the top:
   ```typescript
   import { PageLayout } from "../shared/components/PageLayout";
   ```

2. Keep `import { SPACING, BORDER, COLOR } from "../shared/styles";` — `BORDER`, `COLOR` are still used for divider lines and muted text. `SPACING` is still used for `controlsGap`, `rowGap` inside the list.

3. Replace the empty-state return (lines 63-75):
   ```tsx
   if (apps.length === 0) {
     return (
       <PageLayout title="Installed Scripts">
         <PanelSectionRow>
           <div className={staticClasses.Label} style={{ color: COLOR.muted }}>
             No Lua scripts installed yet.
           </div>
         </PanelSectionRow>
       </PageLayout>
     );
   }
   ```

4. Replace the list-state return (lines 77-109):
   ```tsx
   return (
     <PageLayout title="Installed Scripts">
       {apps.map((app, index) => (
         <React.Fragment key={app.appid}>
           <PanelSectionRow>
             <div style={{ display: "flex", alignItems: "center", gap: SPACING.controlsGap }}>
               <span
                 className={staticClasses.Label}
                 style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
               >
                 {app.name || `App ${app.appid}`}
               </span>
               <ControlsList spacing="standard">
                 <ButtonItem onClick={() => handleRedownload(app.appid)}>
                   <FaRedo />
                 </ButtonItem>
                 <ButtonItem onClick={() => handleDelete(app.appid, app.name)}>
                   <FaTrash />
                 </ButtonItem>
               </ControlsList>
             </div>
           </PanelSectionRow>
           {index < apps.length - 1 && (
             <PanelSectionRow>
               <div style={{ borderTop: BORDER.divider, margin: `0 0 ${SPACING.rowGap} 0` }} />
             </PanelSectionRow>
           )}
         </React.Fragment>
       ))}
     </PageLayout>
   );
   ```

---

### Task 5: Update SettingsPanel to use PageLayout

**Files:**
- Modify: `src/settings/SettingsPanel.tsx`

- [ ] **Step 1: Replace the wrapper div with PageLayout**

Edit `src/settings/SettingsPanel.tsx`:

1. Add import at the top:
   ```typescript
   import { PageLayout } from "../shared/components/PageLayout";
   ```

2. Keep `import { SPACING, BORDER } from "../shared/styles";` — `BORDER` is used for dividers, `SPACING` for divider margin.

3. Replace the wrapper div:
   ```tsx
   return (
     <PageLayout title="Settings">
       <PanelSectionRow>
         <ToggleField
           label="Fast Download"
           description="Skip source picker — auto-select first working API source"
           checked={fastDownload}
           onChange={handleFastDownload}
         />
       </PanelSectionRow>

       <PanelSectionRow>
         <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
       </PanelSectionRow>

       <PanelSectionRow>
         <TextField
           label="Morrenus API Key"
           description="Optional"
           value={apiKey}
           onChange={handleApiKeyChange}
         />
       </PanelSectionRow>

       <PanelSectionRow>
         <div style={{ borderTop: BORDER.divider, margin: `${SPACING.dividerMargin} 0` }} />
       </PanelSectionRow>

       <PanelSectionRow>
         <ButtonItem layout="below" onClick={handleRefresh}>
           <FaSync style={{ marginRight: "4px" }} />
           Refresh API Sources
         </ButtonItem>
       </PanelSectionRow>
     </PageLayout>
   );
   ```

---

### Task 6: Build and verify

**Files:**
- Build config: `rollup.config.js` (not modified, just run)

- [ ] **Step 1: Run the build**

```bash
pnpm build
```

Expected: Build succeeds with no errors. Output goes to `dist/index.js`.

- [ ] **Step 2: Verify the bundle includes PageLayout**

```bash
rg "PageLayout" dist/index.js
```

Expected: Should find the PageLayout component code in the bundled output.

- [ ] **Step 3: Run existing tests (if any)**

```bash
pnpm test
```

Expected: All tests pass (37/37).

---

### Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/shared/styles.ts \
       src/shared/components/PageLayout.tsx \
       src/download/DownloadPanel.tsx \
       src/installed/InstalledApps.tsx \
       src/settings/SettingsPanel.tsx
git commit -m "feat: add centered sub-page layout with PageLayout component

Adds a shared <PageLayout> component that constrains sub-pages to 340px
max-width with auto margins (mx-auto effect) and generous 16px padding.

- New PageLayout component in src/shared/components/
- Updated SPACING constants (pageMaxWidth, pageTopPadding, pageBottomPadding)
- Download, Installed, Settings panels use PageLayout
- Main menu unchanged per design decision"
```
