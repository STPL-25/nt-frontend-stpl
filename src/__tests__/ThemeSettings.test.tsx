import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { describe, it, expect, vi } from "vitest";
import ThemeSettings from "@/components/ThemeSettings";
import themeReducer from "@/globalState/features/themeSlice";

// mock Sheet from shadcn so we don't need full Radix portal support in jsdom
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: any) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent:     ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader:      ({ children }: any) => <div>{children}</div>,
  SheetTitle:       ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>{children}</button>
  ),
}));

vi.mock("@/components/ui/badge",     () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/separator", () => ({ Separator: () => <hr /> }));

function buildStore() {
  return configureStore({ reducer: { theme: themeReducer } });
}

function renderSheet(open = true) {
  const store = buildStore();
  const onOpenChange = vi.fn();
  render(
    <Provider store={store}>
      <ThemeSettings open={open} onOpenChange={onOpenChange} />
    </Provider>
  );
  return { store, onOpenChange };
}

describe("ThemeSettings component", () => {
  it("renders when open=true", () => {
    renderSheet(true);
    expect(screen.getByTestId("sheet")).toBeTruthy();
    expect(screen.getByText("Appearance Settings")).toBeTruthy();
  });

  it("does not render when open=false", () => {
    renderSheet(false);
    expect(screen.queryByTestId("sheet")).toBeNull();
  });

  it("shows all 8 color theme labels", () => {
    renderSheet();
    ["Blue","Indigo","Purple","Teal","Green","Amber","Orange","Rose"].forEach((name) => {
      expect(screen.getByText(name)).toBeTruthy();
    });
  });

  it("shows Light, Dark, System mode options", () => {
    renderSheet();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("Dark")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
  });

  it("shows radius options", () => {
    renderSheet();
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.getByText("Small")).toBeTruthy();
    expect(screen.getByText("Full")).toBeTruthy();
  });

  it("clicking a color swatch dispatches setThemeColor", () => {
    const { store } = renderSheet();
    fireEvent.click(screen.getByText("Purple"));
    expect(store.getState().theme.color).toBe("purple");
  });

  it("clicking Dark mode dispatches setThemeMode", () => {
    const { store } = renderSheet();
    fireEvent.click(screen.getByText("Dark"));
    expect(store.getState().theme.mode).toBe("dark");
  });

  it("Reset to Defaults button resets to blue/system/0.625", () => {
    const { store } = renderSheet();
    // First change to something else
    fireEvent.click(screen.getByText("Rose"));
    expect(store.getState().theme.color).toBe("rose");

    // Reset
    fireEvent.click(screen.getByText("Reset to Defaults"));
    expect(store.getState().theme.color).toBe("blue");
    expect(store.getState().theme.mode).toBe("system");
    expect(store.getState().theme.radius).toBe(0.625);
  });
});
