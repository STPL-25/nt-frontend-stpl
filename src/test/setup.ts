import "@testing-library/jest-dom";
import { vi } from "vitest";

// ── mock next-themes ──────────────────────────────────────────────
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ theme: "light", setTheme: vi.fn(), resolvedTheme: "light" }),
}));

// ── mock socket.io-client ─────────────────────────────────────────
vi.mock("socket.io-client", () => {
  const mockSocket = {
    connected: false,
    auth: {},
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return { io: vi.fn(() => mockSocket), default: vi.fn(() => mockSocket) };
});

// ── mock localStorage ─────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:    (k: string)            => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string)            => { delete store[k]; },
    clear:      ()                     => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ── suppress noisy console errors in tests ────────────────────────
vi.spyOn(console, "error").mockImplementation(() => {});
