import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");

// ── Popover mock: forwards open/onOpenChange so component state works ──────
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children, open, onOpenChange }: any) => (
    <div
      data-testid="popover-root"
      data-open={String(open)}
      onClick={() => onOpenChange?.(!open)}
    >
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, title, ...rest }: any) => (
    <button onClick={onClick} title={title} {...rest}>{children}</button>
  ),
}));
vi.mock("@/components/ui/badge",       () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/ui/separator",   () => ({ Separator: () => <hr /> }));
vi.mock("sonner",                       () => ({ toast: vi.fn() }));

// ── Mock useAppState with fake socket ──────────────────────────────────────
vi.mock("@/globalState/hooks/useAppState", () => ({
  useAppState: () => ({
    socket:   { on: vi.fn(), off: vi.fn(), connected: false },
    userData: [{ ecno: "EC001", ename: "Test User" }],
  }),
}));

import NotificationBell from "@/components/NotificationBell";

const MOCK_NOTIFS = [
  {
    id: "n1", type: "info", title: "PR Submitted",
    message: "Your PR was submitted", read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "n2", type: "success", title: "PR Approved",
    message: "PR #123 approved", read: true,
    createdAt: new Date().toISOString(),
  },
];

function openBell() {
  // Click the popover-root; mock calls onOpenChange(!false) → open = true → fetch runs
  fireEvent.click(screen.getByTestId("popover-root"));
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { success: true, data: MOCK_NOTIFS, unread: 1 },
    } as any);
    vi.mocked(axios.patch).mockResolvedValue({ data: { success: true } } as any);
    vi.mocked(axios.delete).mockResolvedValue({ data: { success: true } } as any);
  });

  it("renders the bell trigger", () => {
    render(<NotificationBell />);
    expect(screen.getByTestId("popover-trigger")).toBeTruthy();
  });

  it("shows no unread badge before opening", () => {
    render(<NotificationBell />);
    expect(screen.queryByText("1 new")).toBeNull();
  });

  it("calls GET /api/notifications when opened", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
      expect.stringContaining("/api/notifications")
    );
  });

  it("renders notification titles after opening", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => {
      expect(screen.getByText("PR Submitted")).toBeTruthy();
      expect(screen.getByText("PR Approved")).toBeTruthy();
    });
  });

  it("renders notification messages after opening", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => {
      expect(screen.getByText("Your PR was submitted")).toBeTruthy();
      expect(screen.getByText("PR #123 approved")).toBeTruthy();
    });
  });

  it("shows unread count badge after fetch", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => screen.getByText("PR Submitted"));
    // 1 unread notification → badge should show "1"
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("shows 'X new' badge in panel header after fetch", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => screen.getByText("1 new"));
    expect(screen.getByText("1 new")).toBeTruthy();
  });

  it("shows empty state when no notifications returned", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { success: true, data: [], unread: 0 },
    } as any);
    render(<NotificationBell />);
    openBell();
    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeTruthy();
    });
  });

  it("calls PATCH /read-all when 'All read' is clicked", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => screen.getByText("PR Submitted"));
    fireEvent.click(screen.getByTitle("Mark all as read"));
    await waitFor(() => {
      expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(
        expect.stringContaining("/read-all")
      );
    });
  });

  it("hides unread badge after mark-all-read", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => screen.getByText("PR Submitted"));
    fireEvent.click(screen.getByTitle("Mark all as read"));
    await waitFor(() => {
      expect(screen.queryByText("1 new")).toBeNull();
    });
  });

  it("calls DELETE when clear button clicked", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => screen.getByText("PR Submitted"));
    fireEvent.click(screen.getByTitle("Clear all"));
    await waitFor(() => {
      expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(
        expect.stringContaining("/api/notifications")
      );
    });
  });

  it("shows empty state after clearing all", async () => {
    render(<NotificationBell />);
    openBell();
    await waitFor(() => screen.getByText("PR Submitted"));
    fireEvent.click(screen.getByTitle("Clear all"));
    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeTruthy();
    });
  });
});
