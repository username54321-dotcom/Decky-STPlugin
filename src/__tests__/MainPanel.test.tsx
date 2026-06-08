import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

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
