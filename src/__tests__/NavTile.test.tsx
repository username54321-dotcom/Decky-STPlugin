import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { NavTile } from "../main/NavTile";

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
