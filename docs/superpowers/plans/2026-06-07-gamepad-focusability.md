# Gamepad Focusability Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 9 interactive elements across 5 files gamepad-focusable by wrapping them in Decky's `<Focusable>` component.

**Architecture:** Each problematic element (native `<button>` or clickable `<div>`) gets wrapped in `<Focusable onActivate={handler}>` from `@decky/ui`. Mouse `onClick` handlers remain unchanged. Disabled buttons guard `onActivate` with a conditional to prevent gamepad activation while disabled.

**Tech Stack:** TypeScript, React, Decky UI (`@decky/ui`)

---

### Task 1: `src/index.tsx` — Update banner View/Install/Dismiss buttons

**Files:** Modify `src/index.tsx`

- [ ] **Step 1: Add `Focusable` to import**

In the import from `@decky/ui` (line 1-10), add `Focusable`:

```tsx
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Navigation,
  staticClasses,
  ControlsList,
  ErrorBoundary,
  showModal,
  Focusable,          // ADD THIS
} from "@decky/ui";
```

- [ ] **Step 2: Wrap "View" button in Focusable**

Replace lines 48-60 with:

```tsx
            {updateStatus.releaseUrl && (
              <Focusable onActivate={() => { window.open(updateStatus.releaseUrl!, "_blank"); }}>
                <button
                  style={{
                    ...BUTTON.base,
                    ...BUTTON.secondary,
                  } as React.CSSProperties}
                  onClick={() => {
                    window.open(updateStatus.releaseUrl!, "_blank");
                  }}
                >
                  View
                </button>
              </Focusable>
            )}
```

- [ ] **Step 3: Wrap "Install" button in Focusable (with disabled guard)**

Replace lines 61-78 with:

```tsx
            <Focusable onActivate={updateStatus.installing ? undefined : async () => {
              const installed = await install();
              if (installed && updateStatus.latestVersion) {
                showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
              }
            }}>
              <button
                style={{
                  ...BUTTON.base,
                  ...(updateStatus.installing
                    ? BUTTON.disabled
                    : BUTTON.primary
                  ),
                } as React.CSSProperties}
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
            </Focusable>
```

- [ ] **Step 4: Wrap "Dismiss" button in Focusable**

Replace lines 79-87 with:

```tsx
            <Focusable onActivate={() => setBannerDismissed(true)}>
              <button
                style={{
                  ...BUTTON.base,
                  ...BUTTON.secondary,
                } as React.CSSProperties}
                onClick={() => setBannerDismissed(true)}
              >
                Dismiss
              </button>
            </Focusable>
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: exit code 0, no TypeScript errors.

---

### Task 2: `src/SettingsPanel.tsx` — Update banner View Release/Install Now buttons

**Files:** Modify `src/SettingsPanel.tsx`

- [ ] **Step 1: Add `Focusable` to import**

In the import from `@decky/ui` (line 1-7), add `Focusable`:

```tsx
import {
  PanelSectionRow,
  ToggleField,
  TextField,
  ButtonItem,
  showModal,
  Focusable,          // ADD THIS
} from "@decky/ui";
```

- [ ] **Step 2: Wrap "View Release" button in Focusable**

Replace lines 133-145 with:

```tsx
              {updateStatus.releaseUrl && (
                <Focusable onActivate={() => { window.open(updateStatus.releaseUrl!, "_blank"); }}>
                  <button
                    style={{
                      ...BUTTON.base,
                      ...BUTTON.secondary,
                    } as React.CSSProperties}
                    onClick={() => {
                      window.open(updateStatus.releaseUrl!, "_blank");
                    }}
                  >
                    View Release
                  </button>
                </Focusable>
              )}
```

- [ ] **Step 3: Wrap "Install Now" button in Focusable (with disabled guard)**

Replace lines 146-163 with:

```tsx
              <Focusable onActivate={updateStatus.installing ? undefined : async () => {
                const installed = await install();
                if (installed && updateStatus.latestVersion) {
                  showModal(<UpdateInstalledModal version={updateStatus.latestVersion} />);
                }
              }}>
                <button
                  style={{
                    ...BUTTON.base,
                    ...(updateStatus.installing
                      ? BUTTON.disabled
                      : BUTTON.primary
                    ),
                  } as React.CSSProperties}
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
              </Focusable>
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: exit code 0, no TypeScript errors.

---

### Task 3: `src/shared/components/PageLayout.tsx` — Back navigation

**Files:** Modify `src/shared/components/PageLayout.tsx`

- [ ] **Step 1: Add `Focusable` to import**

Change line 1 from:

```tsx
import { PanelSection, Navigation } from "@decky/ui";
```

to:

```tsx
import { PanelSection, Navigation, Focusable } from "@decky/ui";
```

- [ ] **Step 2: Wrap "← Back" div in Focusable**

Replace lines 26-32 with:

```tsx
            <Focusable onActivate={() => Navigation.Navigate(ROUTES.main)}>
              <div
                style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "4px" }}
                onClick={() => Navigation.Navigate(ROUTES.main)}
              >
                <span style={{ fontSize: "16px", lineHeight: 1 }}>←</span>
                <span style={{ fontSize: "13px", color: "var(--gpSystemLighterGrey)" }}>Back</span>
              </div>
            </Focusable>
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: exit code 0, no TypeScript errors.

---

### Task 4: `src/patches/PlayBarPatch.tsx` — ST status badge

**Files:** Modify `src/patches/PlayBarPatch.tsx`

- [ ] **Step 1: Add `Focusable` to import**

In the import from `@decky/ui` (line 2-7), add `Focusable`:

```tsx
import {
  afterPatch,
  createReactTreePatcher,
  findInReactTree,
  Navigation,
  Focusable,          // ADD THIS
} from "@decky/ui";
```

- [ ] **Step 2: Wrap "ST" badge div in Focusable**

Replace lines 70-78 with:

```tsx
  return (
    <Focusable onActivate={handleClick}>
      <div
        key="stplugin-status"
        onClick={handleClick}
        style={textStyle}
        title={installed ? "Lua script installed — click to manage" : "No Lua script — click to download"}
      >
        ST
      </div>
    </Focusable>
  );
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: exit code 0, no TypeScript errors.

---

### Task 5: `src/download/components/GameSearchDropdown.tsx` — Search result rows

**Files:** Modify `src/download/components/GameSearchDropdown.tsx`

- [ ] **Step 1: Add `Focusable` to import**

Change line 2 from:

```tsx
import { staticClasses } from "@decky/ui";
```

to:

```tsx
import { staticClasses, Focusable } from "@decky/ui";
```

- [ ] **Step 2: Wrap each search result row in Focusable**

Replace lines 47-101 with:

```tsx
      {results.map((result, i) => (
        <Focusable key={result.id} onActivate={() => onSelect(result)}>
          <div
            onClick={() => onSelect(result)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 12px",
              cursor: "pointer",
              borderBottom: `1px solid ${COLOR.backgroundLight}`,
              backgroundColor: hoveredIndex === i ? COLOR.backgroundHard : "transparent",
            }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {result.img ? (
              <img
                src={result.img}
                alt={result.name}
                style={{
                  width: "120px",
                  height: "45px",
                  objectFit: "cover",
                  borderRadius: BORDER.cardRadius,
                  flexShrink: 0,
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                style={{
                  width: "120px",
                  height: "45px",
                  backgroundColor: COLOR.backgroundHard,
                  borderRadius: BORDER.cardRadius,
                  flexShrink: 0,
                }}
              />
            )}
            <span
              className={staticClasses.Label}
              style={{
                fontSize: "14px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {result.name}
            </span>
          </div>
        </Focusable>
      ))}
```

Note: The `<Focusable>` wraps each result row. Mouse `onClick`, hover highlight (`onMouseEnter`/`onMouseLeave`), and all visual styling remain unchanged.

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: exit code 0, no TypeScript errors.

---

### Verification (Final)

- [ ] **Build check:** Run `pnpm build` — must succeed with zero errors
- [ ] **Mouse behavior:** Open the plugin in Decky, confirm all buttons still respond to mouse clicks
- [ ] **Code review:** Spot-check each changed file to confirm:
  - `<Focusable>` is imported from `@decky/ui` in each file
  - Each element has both `<Focusable onActivate={...}>` wrapper and `onClick` on the inner element
  - Disabled Install/Install Now buttons pass `onActivate={... ? undefined : handler}`
  - No duplicate `key` props introduced
