# Main Panel Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the inline MainPanel in `src/index.tsx` into an extracted status dashboard with header, stats card, nav tiles, and footer.

**Architecture:** Extract MainPanel into `src/MainPanel.tsx` with two sub-components (`StatsCard`, `NavTile`) in `src/main/`. Shared styles go in `src/main/styles.ts`. The `index.tsx` entry point shrinks to ~35 lines. No backend changes. Reuses existing `get_installed_apps` callable and `useUpdateStatus` hook.

**Tech Stack:** TypeScript, React, @decky/ui, @decky/api, react-icons/fa, Vitest + React Testing Library

---

### Task 1: Create MainPanel style constants (`src/main/styles.ts`)

**Files:**
- Create: `src/main/styles.ts`
- Create: `src/main/` directory

- [ ] **Step 1: Create the `src/main/` directory**

```pwsh
New-Item -ItemType Directory -Path "src/main" -Force
```

- [ ] **Step 2: Write `src/main/styles.ts`**

```ts
import { SPACING, BORDER, COLOR, CARD } from "../shared/styles";

export const HEADER = {
  container: {
    padding: `0 ${SPACING.panelTopPadding}`,
    marginBottom: SPACING.sectionGap,
  } as React.CSSProperties,
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  title: {
    fontSize: "18px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,
  version: {
    fontSize: "12px",
    color: COLOR.muted,
  } as React.CSSProperties,
  subtitle: {
    fontSize: "12px",
    color: COLOR.muted,
    marginTop: "2px",
  } as React.CSSProperties,
  updateBadge: {
    fontSize: "11px",
    color: COLOR.success,
    fontWeight: "bold" as const,
  } as React.CSSProperties,
};

export const STATS_CARD = {
  container: {
    background: COLOR.backgroundLight,
    border: `1px solid ${COLOR.backgroundMedium}`,
    borderRadius: BORDER.cardRadius,
    padding: CARD.padding,
    marginBottom: SPACING.sectionGap,
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,
  icon: {
    fontSize: "20px",
    color: COLOR.muted,
  } as React.CSSProperties,
  count: {
    fontSize: "15px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,
  label: {
    fontSize: "12px",
    color: COLOR.muted,
  } as React.CSSProperties,
};

export const NAV_TILE = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: BORDER.cardRadius,
    cursor: "pointer",
  } as React.CSSProperties,
  icon: {
    fontSize: "22px",
    color: COLOR.muted,
    flexShrink: 0,
    width: "28px",
    textAlign: "center" as const,
  } as React.CSSProperties,
  textBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    flex: 1,
  } as React.CSSProperties,
  title: {
    fontSize: "14px",
    fontWeight: "bold" as const,
  } as React.CSSProperties,
  description: {
    fontSize: "12px",
    color: COLOR.muted,
  } as React.CSSProperties,
  divider: {
    borderTop: BORDER.divider,
    margin: 0,
  } as React.CSSProperties,
};

export const FOOTER = {
  container: {
    marginTop: SPACING.sectionGap,
    paddingTop: SPACING.rowGap,
    borderTop: BORDER.divider,
  } as React.CSSProperties,
};
```

- [ ] **Step 3: Commit**

```pwsh
git add src/main/styles.ts
git commit -m "feat: add MainPanel style constants"
```

---

### Task 2: Create NavTile component (`src/main/NavTile.tsx`)

**Files:**
- Create: `src/main/NavTile.tsx`

- [ ] **Step 1: Write `src/main/NavTile.tsx`**

```tsx
import React from "react";
import { Focusable, Navigation } from "@decky/ui";
import { NAV_TILE } from "./styles";

export interface NavTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
}

export function NavTile({ icon, title, description, route }: NavTileProps) {
  return (
    <Focusable
      onActivate={() => Navigation.Navigate(route)}
      style={NAV_TILE.container}
    >
      <span style={NAV_TILE.icon}>{icon}</span>
      <div style={NAV_TILE.textBlock}>
        <span style={NAV_TILE.title}>{title}</span>
        <span style={NAV_TILE.description}>{description}</span>
      </div>
    </Focusable>
  );
}
```

- [ ] **Step 2: Commit**

```pwsh
git add src/main/NavTile.tsx
git commit -m "feat: add NavTile component for QAM navigation"
```

---

### Task 3: Create StatsCard component (`src/main/StatsCard.tsx`)

**Files:**
- Create: `src/main/StatsCard.tsx`

- [ ] **Step 1: Write `src/main/StatsCard.tsx`**

```tsx
import React from "react";
import { PanelSection, PanelSectionRow } from "@decky/ui";
import { FaCubes } from "react-icons/fa";
import { STATS_CARD } from "./styles";

export interface StatsCardProps {
  installedCount: number | null; // null = loading/error
}

export function StatsCard({ installedCount }: StatsCardProps) {
  let countText: string;
  if (installedCount === null) {
    countText = "\u2014"; // em dash
  } else if (installedCount === 0) {
    countText = "No scripts installed";
  } else {
    countText = `${installedCount} script${installedCount === 1 ? "" : "s"} installed`;
  }

  return (
    <PanelSection>
      <PanelSectionRow>
        <div style={STATS_CARD.container}>
          <FaCubes style={STATS_CARD.icon} />
          <span style={STATS_CARD.count}>{countText}</span>
        </div>
      </PanelSectionRow>
    </PanelSection>
  );
}
```

- [ ] **Step 2: Commit**

```pwsh
git add src/main/StatsCard.tsx
git commit -m "feat: add StatsCard component showing installed script count"
```

---

### Task 4: Create extracted MainPanel (`src/MainPanel.tsx`)

**Files:**
- Create: `src/MainPanel.tsx`

- [ ] **Step 1: Write `src/MainPanel.tsx`**

```tsx
import React, { useState, useEffect } from "react";
import {
  PanelSection,
  Navigation,
} from "@decky/ui";
import { callable } from "@decky/api";
import { FaDownload, FaBox, FaCog } from "react-icons/fa";
import { PLUGIN_NAME, ROUTES } from "./shared/constants";
import { useUpdateStatus } from "./update/hooks/useUpdateStatus";
import { RestartButton } from "./shared/components/RestartButton";
import { NavTile } from "./main/NavTile";
import { StatsCard } from "./main/StatsCard";
import { HEADER, FOOTER } from "./main/styles";
import { SPACING } from "./shared/styles";
import type { InstalledApp } from "./shared/types";

const getInstalledApps = callable<[], InstalledApp[]>("get_installed_apps");

export function MainPanel() {
  const { status: updateStatus } = useUpdateStatus();
  const [installedCount, setInstalledCount] = useState<number | null>(null);

  useEffect(() => {
    getInstalledApps()
      .then((apps) => setInstalledCount(apps.length))
      .catch((err) => {
        console.error("MainPanel: failed to fetch installed apps", err);
        setInstalledCount(null);
      });
  }, []);

  return (
    <div style={{ paddingTop: SPACING.panelTopPadding }}>
      {/* Zone 1: Header */}
      <div style={HEADER.container}>
        <div style={HEADER.titleRow}>
          <span style={HEADER.title}>{PLUGIN_NAME}</span>
          <span style={HEADER.version}>
            v{updateStatus.currentVersion}
            {updateStatus.available && (
              <span style={HEADER.updateBadge}>{" "}\u2B06 Update Available</span>
            )}
          </span>
        </div>
        <span style={HEADER.subtitle}>Lua Script Manager</span>
      </div>

      {/* Zone 2: Stats Card */}
      <StatsCard installedCount={installedCount} />

      {/* Zone 3: Navigation Tiles */}
      <PanelSection title="Quick Actions">
        <NavTile
          icon={<FaDownload />}
          title="Download Lua Script"
          description="Search & install scripts"
          route={ROUTES.download}
        />
        <NavTile
          icon={<FaBox />}
          title="Installed Scripts"
          description="Manage & re-download"
          route={ROUTES.installed}
        />
        <NavTile
          icon={<FaCog />}
          title="Settings"
          description="Configure plugin options"
          route={ROUTES.settings}
        />
      </PanelSection>

      {/* Zone 4: Footer */}
      <div style={FOOTER.container}>
        <RestartButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```pwsh
git add src/MainPanel.tsx
git commit -m "feat: extract MainPanel as status dashboard with header, stats, nav tiles, footer"
```

---

### Task 5: Slim down `src/index.tsx`

**Files:**
- Modify: `src/index.tsx`

- [ ] **Step 1: Replace `src/index.tsx` with thinned version**

Replace the entire file content:

```tsx
import {
  ErrorBoundary,
  Navigation,
  staticClasses,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
} from "@decky/api";
import React from "react";
import { FaDownload } from "react-icons/fa";
import { MainPanel } from "./MainPanel";
import { DownloadPanel } from "./DownloadPanel";
import { InstalledApps } from "./InstalledApps";
import { SettingsPanel } from "./SettingsPanel";
import { patchLibraryApp } from "./patches/PlayBarPatch";
import { ROUTES, PLUGIN_NAME } from "./shared/constants";

export default definePlugin(() => {
  console.log(`${PLUGIN_NAME} initializing`);

  routerHook.addRoute(ROUTES.main, MainPanel, { exact: true });
  routerHook.addRoute(ROUTES.download, () => <DownloadPanel />, { exact: true });
  routerHook.addRoute(ROUTES.installed, () => <InstalledApps />, { exact: true });
  routerHook.addRoute(ROUTES.settings, () => <SettingsPanel />, { exact: true });

  let cleanupPlayBarPatch: (() => void) | null = null;
  patchLibraryApp().then((cleanup) => {
    cleanupPlayBarPatch = cleanup;
  });

  return {
    name: PLUGIN_NAME,
    titleView: <div className={staticClasses.Title}>{PLUGIN_NAME}</div>,
    content: (
      <ErrorBoundary>
        <MainPanel />
      </ErrorBoundary>
    ),
    icon: <FaDownload />,
    onDismount() {
      console.log(`${PLUGIN_NAME} unloading`);
      cleanupPlayBarPatch?.();
      routerHook.removeRoute(ROUTES.main);
      routerHook.removeRoute(ROUTES.download);
      routerHook.removeRoute(ROUTES.installed);
      routerHook.removeRoute(ROUTES.settings);
    },
  };
});
```

Changes from original:
- Removed inline `MainPanel` function (now imported)
- Removed unused imports: `PanelSection`, `PanelSectionRow`, `ButtonItem`, `Field`, `ControlsList`, `showModal`, `useState`, `RestartButton`, `useUpdateStatus`, `UpdateInstalledModal`, `SPACING`, `BORDER`
- Added: `MainPanel` import

- [ ] **Step 2: Verify build compiles**

```pwsh
pnpm build
```

Expected: builds successfully, produces `dist/index.js`

- [ ] **Step 3: Commit**

```pwsh
git add src/index.tsx
git commit -m "refactor: thin index.tsx by extracting MainPanel to its own file"
```

---

### Task 6: Update living specs

**Files:**
- Modify: `openspec/specs/frontend.md`
- Modify: `openspec/specs/architecture.md`

- [ ] **Step 1: Update `openspec/specs/frontend.md` QAM Panels section**

The QAM Panels section should be updated. Find the section describing MainPanel (likely under "QAM Panels" or similar header) and replace the MainPanel description with:

```markdown
#### MainPanel (Dashboard)
**File:** `src/MainPanel.tsx`

A status dashboard shown at the root QAM route (`/stplugin`).

**Zones:**
1. **Header** — plugin name, version number, update-available badge (uses `useUpdateStatus` hook)
2. **StatsCard** (`src/main/StatsCard.tsx`) — installed scripts count from `get_installed_apps()` callable. States: loaded count, "No scripts installed" (0), "—" (loading/error)
3. **NavTile** ×3 (`src/main/NavTile.tsx`) — styled navigation tiles with icon, title, description, and `Focusable` gamepad support:
   - Download Lua Script → `/stplugin/download`
   - Installed Scripts → `/stplugin/installed`
   - Settings → `/stplugin/settings`
4. **Footer** — `RestartButton` component, separated by divider

**Dependencies:** `useUpdateStatus`, `callable("get_installed_apps")`, `RestartButton`, `Focusable`, `Navigation`
```

- [ ] **Step 2: Update `openspec/specs/architecture.md` file tree**

Add `src/main/` to the file structure section:

```
src/
  ...
  main/
    NavTile.tsx          # Reusable QAM navigation tile
    StatsCard.tsx        # Installed scripts count display
    styles.ts            # MainPanel style constants
  MainPanel.tsx          # QAM status dashboard
  index.tsx              # Plugin entry (thin, ~35 lines)
  ...
```

- [ ] **Step 3: Commit**

```pwsh
git add openspec/specs/frontend.md openspec/specs/architecture.md
git commit -m "docs: update living specs for MainPanel dashboard"
```

---

### Task 7: Frontend test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/__tests__/setup.ts`

- [ ] **Step 1: Install test dependencies**

```pwsh
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 3: Create `src/__tests__/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: Add test script to `package.json`**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify test infrastructure works**

```pwsh
pnpm test
```

Expected: "No test files found" (but no errors)

- [ ] **Step 6: Commit**

```pwsh
git add package.json pnpm-lock.yaml vitest.config.ts src/__tests__/setup.ts
git commit -m "test: add vitest + React Testing Library infrastructure"
```

---

### Task 8: Write tests for MainPanel components

**Files:**
- Create: `src/__tests__/NavTile.test.tsx`
- Create: `src/__tests__/StatsCard.test.tsx`
- Create: `src/__tests__/MainPanel.test.tsx`

- [ ] **Step 1: Write `src/__tests__/NavTile.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { NavTile } from "../main/NavTile";

// Mock @decky/ui
vi.mock("@decky/ui", () => ({
  Focusable: ({ onActivate, children, style }: any) => (
    <div onClick={onActivate} style={style}>{children}</div>
  ),
  Navigation: {
    Navigate: vi.fn(),
  },
}));

import { Navigation } from "@decky/ui";

describe("NavTile", () => {
  it("renders icon, title, and description", () => {
    const { getByText, container } = render(
      <NavTile
        icon={<span data-testid="icon">📥</span>}
        title="Download"
        description="Get scripts"
        route="/test"
      />
    );
    expect(getByText("Download")).toBeTruthy();
    expect(getByText("Get scripts")).toBeTruthy();
    expect(container.querySelector("[data-testid='icon']")).toBeTruthy();
  });

  it("navigates on click", () => {
    const { container } = render(
      <NavTile
        icon={<span>📥</span>}
        title="Download"
        description="Get scripts"
        route="/stplugin/download"
      />
    );
    const focusable = container.firstElementChild!;
    fireEvent.click(focusable);
    expect(Navigation.Navigate).toHaveBeenCalledWith("/stplugin/download");
  });
});
```

- [ ] **Step 2: Run NavTile tests**

```pwsh
pnpm test src/__tests__/NavTile.test.tsx
```

Expected: 2 tests pass

- [ ] **Step 3: Write `src/__tests__/StatsCard.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatsCard } from "../main/StatsCard";

// Mock @decky/ui
vi.mock("@decky/ui", () => ({
  PanelSection: ({ children }: any) => <div>{children}</div>,
  PanelSectionRow: ({ children }: any) => <div>{children}</div>,
}));

describe("StatsCard", () => {
  it("shows count when loaded", () => {
    const { getByText } = render(<StatsCard installedCount={12} />);
    expect(getByText("12 scripts installed")).toBeTruthy();
  });

  it("shows singular for count of 1", () => {
    const { getByText } = render(<StatsCard installedCount={1} />);
    expect(getByText("1 script installed")).toBeTruthy();
  });

  it("shows empty message when count is 0", () => {
    const { getByText } = render(<StatsCard installedCount={0} />);
    expect(getByText("No scripts installed")).toBeTruthy();
  });

  it("shows placeholder when null (loading/error)", () => {
    const { getByText } = render(<StatsCard installedCount={null} />);
    expect(getByText("\u2014")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run StatsCard tests**

```pwsh
pnpm test src/__tests__/StatsCard.test.tsx
```

Expected: 4 tests pass

- [ ] **Step 5: Write `src/__tests__/MainPanel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// Mock all externals before importing MainPanel
vi.mock("@decky/ui", () => ({
  PanelSection: ({ children, title }: any) => <div data-title={title}>{children}</div>,
  Navigation: { Navigate: vi.fn() },
  Focusable: ({ onActivate, children }: any) => <div onClick={onActivate}>{children}</div>,
  ConfirmModal: () => null,
  showModal: vi.fn(),
  ButtonItem: ({ children }: any) => <button>{children}</button>,
  PanelSectionRow: ({ children }: any) => <div>{children}</div>,
  staticClasses: { Title: "title-class" },
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));

vi.mock("@decky/api", () => ({
  callable: () => vi.fn().mockResolvedValue([{ appid: 123, name: "Test Game" }]),
  addEventListener: () => vi.fn(),
  removeEventListener: vi.fn(),
}));

vi.mock("../update/hooks/useUpdateStatus", () => ({
  useUpdateStatus: () => ({
    status: {
      available: false,
      currentVersion: "1.0.0",
      latestVersion: null,
      releaseUrl: null,
      assetUrl: null,
      checkedAt: null,
      installing: false,
    },
  }),
}));

vi.mock("../shared/components/RestartButton", () => ({
  RestartButton: () => <button>Restart Steam</button>,
}));

import { MainPanel } from "../MainPanel";

describe("MainPanel", () => {
  it("renders plugin name in header", () => {
    const { getByText } = render(<MainPanel />);
    expect(getByText("STPlugin")).toBeTruthy();
  });

  it("renders version in header", () => {
    const { getByText } = render(<MainPanel />);
    expect(getByText("v1.0.0")).toBeTruthy();
  });

  it("renders nav tiles", () => {
    const { getByText } = render(<MainPanel />);
    expect(getByText("Download Lua Script")).toBeTruthy();
    expect(getByText("Installed Scripts")).toBeTruthy();
    expect(getByText("Settings")).toBeTruthy();
  });

  it("renders restart button", () => {
    const { getByText } = render(<MainPanel />);
    expect(getByText("Restart Steam")).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run all tests**

```pwsh
pnpm test
```

Expected: 10 tests pass (2 NavTile + 4 StatsCard + 4 MainPanel)

- [ ] **Step 7: Commit**

```pwsh
git add src/__tests__/
git commit -m "test: add tests for NavTile, StatsCard, and MainPanel"
```

---

### Task 9: Final build verification

- [ ] **Step 1: Clean build**

```pwsh
pnpm build
```

Expected: builds without errors, `dist/index.js` produced

- [ ] **Step 2: Run full test suite**

```pwsh
pnpm test; python -m pytest tests -v
```

Expected: All frontend and backend tests pass

- [ ] **Step 3: Verify final file structure**

```pwsh
Get-ChildItem src/main/, src/MainPanel.tsx, src/index.tsx | Select-Object Name, Length
```

Expected output shows:
```
MainPanel.tsx (~2.5 KB)
index.tsx      (~1.2 KB — smaller than original 3.5 KB)
main/
  NavTile.tsx
  StatsCard.tsx
  styles.ts
```

- [ ] **Step 4: Final commit**

```pwsh
git status
```

Review the diff, then:

```pwsh
git commit -m "chore: final verification, all tests pass"
```
