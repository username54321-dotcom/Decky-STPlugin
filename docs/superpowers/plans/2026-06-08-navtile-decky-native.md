# NavTile Decky-Native Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite NavTile to use Decky-native `ButtonItem` instead of raw `Focusable` + custom styles, while preserving the two-line card layout.

**Architecture:** NavTile wraps `ButtonItem layout="below"` with icon + title + description as children. The caller (MainPanel) wraps each in `PanelSectionRow`. All custom `NAV_TILE` styles removed.

**Tech Stack:** React, TypeScript, `@decky/ui` (ButtonItem, Navigation, PanelSectionRow), Vitest + @testing-library/react

---

### Task 1: Update NavTile tests (TDD — failing state)

**Files:**
- Modify: `src/__tests__/NavTile.test.tsx`

- [ ] **Step 1: Replace the mock from Focusable to ButtonItem**

Replace the entire `vi.mock("@decky/ui", ...)` block:

```tsx
// OLD (remove this):
vi.mock("@decky/ui", () => ({
  Focusable: ({ onActivate, children, style, onMouseEnter, onMouseLeave, onFocus, onBlur }: any) => (
    <div
      onClick={onActivate}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      style={style}
    >
      {children}
    </div>
  ),
  Navigation: {
    Navigate: vi.fn(),
  },
}));

// NEW (replace with this):
vi.mock("@decky/ui", () => ({
  ButtonItem: ({ onClick, children, layout }: any) => (
    <div onClick={onClick} data-layout={layout}>
      {children}
    </div>
  ),
  Navigation: {
    Navigate: vi.fn(),
  },
}));
```

- [ ] **Step 2: Update the render test — assert title and description rendered**

Replace the first test:

```tsx
// OLD first test — replace:
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

// NEW first test — replace with:
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
```

*(Content is the same — just confirm it's present.)*

- [ ] **Step 3: Update the navigation test — use click instead of onActivate**

Replace the second test:

```tsx
// OLD second test — replace:
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

// NEW second test — replace with:
it("navigates on click", () => {
  const { container } = render(
    <NavTile
      icon={<span>📥</span>}
      title="Download"
      description="Get scripts"
      route="/stplugin/download"
    />
  );
  const buttonItem = container.firstElementChild!;
  fireEvent.click(buttonItem);
  expect(Navigation.Navigate).toHaveBeenCalledWith("/stplugin/download");
});
```

- [ ] **Step 4: Remove the hover test**

Delete the entire "shows background highlight on mouse enter and removes on mouse leave" test block. ButtonItem handles hover natively — not our concern.

```tsx
// DELETE this entire test:
it("shows background highlight on mouse enter and removes on mouse leave", () => {
  const { container } = render(
    <NavTile
      icon={<span data-testid="icon">📥</span>}
      title="Download"
      description="Get scripts"
      route="/test"
    />
  );
  const focusable = container.firstElementChild as HTMLElement;

  expect(focusable.style.background).toBe("transparent");

  fireEvent.mouseEnter(focusable);
  expect(focusable.style.background).toBe("var(--gpBackgroundLight)");

  fireEvent.mouseLeave(focusable);
  expect(focusable.style.background).toBe("transparent");
});
```

- [ ] **Step 5: Run NavTile tests — expect FAIL**

Run: `npx vitest run src/__tests__/NavTile.test.tsx`

Expected: tests FAIL because NavTile still imports `Focusable` but mock now only exports `ButtonItem`.

---

### Task 2: Rewrite NavTile.tsx

**Files:**
- Modify: `src/main/NavTile.tsx`

- [ ] **Step 1: Replace imports and component body**

Replace the entire file content:

```tsx
import React from "react";
import { ButtonItem, Navigation } from "@decky/ui";

export interface NavTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
}

export function NavTile({ icon, title, description, route }: NavTileProps) {
  return (
    <ButtonItem layout="below" onClick={() => Navigation.Navigate(route)}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span
          style={{
            fontSize: "22px",
            color: "var(--gpSystemLighterGrey)",
            flexShrink: 0,
            width: "28px",
            textAlign: "center",
          }}
        >
          {icon}
        </span>
        <div>
          <div style={{ fontWeight: "bold" }}>{title}</div>
          <div style={{ fontSize: "12px", color: "var(--gpSystemLighterGrey)" }}>
            {description}
          </div>
        </div>
      </div>
    </ButtonItem>
  );
}
```

- [ ] **Step 2: Run NavTile tests — expect PASS**

Run: `npx vitest run src/__tests__/NavTile.test.tsx`

Expected: 2 tests PASS (renders icon/title/description, navigates on click)

---

### Task 3: Update MainPanel.tsx

**Files:**
- Modify: `src/MainPanel.tsx`

- [ ] **Step 1: Add `PanelSectionRow` to the `@decky/ui` import**

```tsx
// OLD (line 2-4):
import {
  PanelSection,
  Navigation,
} from "@decky/ui";

// NEW:
import {
  PanelSection,
  PanelSectionRow,
  Navigation,
} from "@decky/ui";
```

- [ ] **Step 2: Wrap each NavTile in PanelSectionRow**

Replace the three NavTile usages in the `PanelSection title="Quick Actions"` block:

```tsx
// OLD:
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

// NEW:
<PanelSection title="Quick Actions">
  <PanelSectionRow>
    <NavTile
      icon={<FaDownload />}
      title="Download Lua Script"
      description="Search & install scripts"
      route={ROUTES.download}
    />
  </PanelSectionRow>
  <PanelSectionRow>
    <NavTile
      icon={<FaBox />}
      title="Installed Scripts"
      description="Manage & re-download"
      route={ROUTES.installed}
    />
  </PanelSectionRow>
  <PanelSectionRow>
    <NavTile
      icon={<FaCog />}
      title="Settings"
      description="Configure plugin options"
      route={ROUTES.settings}
    />
  </PanelSectionRow>
</PanelSection>
```

- [ ] **Step 3: Run MainPanel tests — expect PASS**

Run: `npx vitest run src/__tests__/MainPanel.test.tsx`

Expected: all 4 tests PASS (existing mock already includes PanelSectionRow)

---

### Task 4: Remove NAV_TILE styles

**Files:**
- Modify: `src/main/styles.ts`

- [ ] **Step 1: Delete the NAV_TILE export block**

Remove lines 58–92 (the entire `export const NAV_TILE = { ... };` block):

```ts
// DELETE this entire block (lines 58-92):
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
```

- [ ] **Step 2: Verify no other file imports NAV_TILE**

Run: `npx vitest run`

Expected: all 36 tests PASS

---

### Task 5: Full suite verification and commit

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`

Expected: 36 tests PASS

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add src/main/NavTile.tsx src/main/styles.ts src/MainPanel.tsx src/__tests__/NavTile.test.tsx
git commit -m "refactor: rework NavTile to use Decky-native ButtonItem"
```
