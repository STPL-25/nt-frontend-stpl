import { describe, it, expect, beforeEach, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import themeReducer, {
  setThemeColor,
  setThemeMode,
  setThemeRadius,
  selectThemeColor,
  selectThemeMode,
  selectThemeRadius,
  THEME_COLORS,
} from "@/globalState/features/themeSlice";

// ─── helpers ─────────────────────────────────────────────────────────────────
function buildStore() {
  return configureStore({
    reducer: { theme: themeReducer },
  });
}

describe("themeSlice — reducers", () => {
  it("has correct initial state", () => {
    const store = buildStore();
    expect(selectThemeColor(store.getState() as any)).toBe("blue");
    expect(selectThemeMode(store.getState() as any)).toBe("system");
    expect(selectThemeRadius(store.getState() as any)).toBe(0.625);
  });

  it("setThemeColor updates color", () => {
    const store = buildStore();
    store.dispatch(setThemeColor("purple"));
    expect(selectThemeColor(store.getState() as any)).toBe("purple");
  });

  it("setThemeMode updates mode", () => {
    const store = buildStore();
    store.dispatch(setThemeMode("dark"));
    expect(selectThemeMode(store.getState() as any)).toBe("dark");
  });

  it("setThemeRadius updates radius", () => {
    const store = buildStore();
    store.dispatch(setThemeRadius(0.5));
    expect(selectThemeRadius(store.getState() as any)).toBe(0.5);
  });

  it("state is replaced cleanly on multiple dispatches", () => {
    const store = buildStore();
    store.dispatch(setThemeColor("green"));
    store.dispatch(setThemeColor("rose"));
    expect(selectThemeColor(store.getState() as any)).toBe("rose");
  });
});

describe("themeSlice — persists to localStorage", () => {
  it("writes to localStorage on color change", () => {
    const store = buildStore();
    store.dispatch(setThemeColor("teal"));
    const raw = localStorage.getItem("nt-theme");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.color).toBe("teal");
  });

  it("writes mode to localStorage", () => {
    const store = buildStore();
    store.dispatch(setThemeMode("light"));
    const parsed = JSON.parse(localStorage.getItem("nt-theme")!);
    expect(parsed.mode).toBe("light");
  });
});

describe("THEME_COLORS constant", () => {
  it("has 8 color entries", () => {
    expect(THEME_COLORS.length).toBe(8);
  });

  it("all entries have required fields", () => {
    THEME_COLORS.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.previewHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(t.lightPrimary).toContain("oklch");
      expect(t.darkPrimary).toContain("oklch");
    });
  });

  it("includes blue, purple, green, rose, amber, teal, orange, indigo", () => {
    const ids = THEME_COLORS.map((t) => t.id);
    ["blue","purple","green","rose","amber","teal","orange","indigo"].forEach((c) =>
      expect(ids).toContain(c)
    );
  });
});
