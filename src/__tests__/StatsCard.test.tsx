import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { StatsCard } from "../main/StatsCard";

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
