import React from "react";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");

const h = vi.hoisted(() => ({
  socketHandlers: {} as Record<string, (payload: any) => void>,
  openScreen: vi.fn(() => true),
  requestPrTracking: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn() }),
}));

// ── Sheet mock: like Radix, content is only mounted while open ────────────────
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: any) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, title, variant, size, ...rest }: any) => (
    <button onClick={onClick} title={title} {...rest}>{children}</button>
  ),
}));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock("sonner", () => ({ toast: h.toast }));
// The real module opens a Socket.IO connection at import time.
vi.mock("@/Services/Socket", () => ({ SOCKET_NOTIFICATION_NEW: "notification:new" }));
vi.mock("@/hooks/useOpenScreen", () => ({ useOpenScreen: () => h.openScreen }));
vi.mock("@/lib/prTrackLink", () => ({ requestPrTracking: h.requestPrTracking }));

const socket = {
  on: (event: string, handler: (payload: any) => void) => { h.socketHandlers[event] = handler; },
  off: (event: string) => { delete h.socketHandlers[event]; },
  connected: false,
};
vi.mock("@/globalState/hooks/useAppState", () => ({
  useAppState: () => ({ socket, userData: [{ ecno: "EC001", ename: "Test User" }] }),
}));

import NotificationBell from "@/components/NotificationBell";

const now = () => new Date().toISOString();
const MOCK_NOTIFS = [
  { id: "n1", type: "info",    title: "PR Submitted", message: "Your PR was submitted", read: false, createdAt: now() },
  { id: "n2", type: "success", title: "PR Approved",  message: "PR #123 approved",      read: true,  createdAt: now() },
  {
    id: "n3", type: "info", title: "Stock received at store", read: false, createdAt: now(),
    message: 'Your requested item "Rice" for PR PR26270003 has arrived at the store.',
  },
];

const itemFor = (title: string) =>
  screen.getAllByTestId("notification-item").find((el) => within(el).queryByText(title))!;

async function openDrawer() {
  render(<NotificationBell />);
  // Loaded on mount so the badge is right before the drawer is ever opened.
  await waitFor(() => expect(vi.mocked(axios.get)).toHaveBeenCalled());
  fireEvent.click(screen.getByTestId("notification-bell"));
  await waitFor(() => screen.getByTestId("sheet"));
}

describe("NotificationBell drawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(h.socketHandlers)) delete h.socketHandlers[k];
    h.openScreen.mockReturnValue(true);
    vi.mocked(axios.get).mockResolvedValue({ data: { success: true, data: MOCK_NOTIFS, unread: 2 } } as any);
    vi.mocked(axios.patch).mockResolvedValue({ data: { success: true } } as any);
    vi.mocked(axios.delete).mockResolvedValue({ data: { success: true } } as any);
  });

  it("shows the unread count on the bell before the drawer is opened", async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByTestId("notification-bell").textContent).toBe("2"));
    expect(screen.queryByTestId("sheet")).toBeNull();
  });

  it("opens a side drawer listing every notification with its full message", async () => {
    await openDrawer();
    expect(screen.getByText("PR Submitted")).toBeTruthy();
    expect(screen.getByText("PR Approved")).toBeTruthy();
    expect(screen.getByText("Your PR was submitted")).toBeTruthy();
    expect(screen.getByText("2 new")).toBeTruthy();
    expect(screen.getAllByTestId("notification-item")).toHaveLength(3);
  });

  it("filters by Unread and Viewed", async () => {
    await openDrawer();

    fireEvent.click(screen.getByRole("tab", { name: /Unread/ }));
    expect(screen.queryByText("PR Approved")).toBeNull();
    expect(screen.getByText("PR Submitted")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Viewed/ }));
    expect(screen.getByText("PR Approved")).toBeTruthy();
    expect(screen.queryByText("PR Submitted")).toBeNull();
  });

  it("shows the empty state when there is nothing", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { success: true, data: [], unread: 0 } } as any);
    await openDrawer();
    expect(screen.getByText("No notifications yet")).toBeTruthy();
  });

  it("marks a notification viewed when it is clicked", async () => {
    await openDrawer();
    fireEvent.click(itemFor("PR Submitted"));
    await waitFor(() =>
      expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(expect.stringContaining("/api/notifications/n1/read"))
    );
    expect(itemFor("PR Submitted").getAttribute("data-read")).toBe("true");
  });

  it("removes a single notification from the list and the server", async () => {
    await openDrawer();
    fireEvent.click(within(itemFor("PR Approved")).getByTitle("Remove"));

    await waitFor(() => expect(screen.queryByText("PR Approved")).toBeNull());
    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(expect.stringMatching(/\/api\/notifications\/n2$/));
    expect(screen.getByText("PR Submitted")).toBeTruthy();
  });

  it("puts the notification back and reports the error when the removal fails", async () => {
    vi.mocked(axios.delete).mockRejectedValueOnce({ response: { data: { message: "boom" }, status: 500 } });
    await openDrawer();
    fireEvent.click(within(itemFor("PR Approved")).getByTitle("Remove"));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("boom"));
    expect(screen.getByText("PR Approved")).toBeTruthy();
  });

  it("'Remove viewed' deletes only the already-viewed notifications", async () => {
    await openDrawer();
    fireEvent.click(screen.getByTitle("Remove viewed"));

    await waitFor(() => expect(screen.queryByText("PR Approved")).toBeNull());
    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(expect.stringMatching(/\/api\/notifications\/read$/));
    expect(screen.getByText("PR Submitted")).toBeTruthy();
    expect(screen.getByText("Stock received at store")).toBeTruthy();
  });

  it("'All read' marks everything viewed", async () => {
    await openDrawer();
    fireEvent.click(screen.getByTitle("Mark all as read"));

    await waitFor(() =>
      expect(vi.mocked(axios.patch)).toHaveBeenCalledWith(expect.stringContaining("/read-all"))
    );
    await waitFor(() => expect(screen.queryByText("2 new")).toBeNull());
  });

  it("'Clear all' needs a second click before it deletes anything", async () => {
    await openDrawer();
    fireEvent.click(screen.getByTitle("Clear all"));
    expect(vi.mocked(axios.delete)).not.toHaveBeenCalled();
    expect(screen.getByText("Click again to clear all")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Clear all"));
    await waitFor(() => expect(screen.getByText("No notifications yet")).toBeTruthy());
    expect(vi.mocked(axios.delete)).toHaveBeenCalledWith(expect.stringMatching(/\/api\/notifications$/));
  });

  it("offers Track PR on a notification that mentions a PR and opens PR Tracking", async () => {
    await openDrawer();
    fireEvent.click(within(itemFor("Stock received at store")).getByText(/Track PR26270003/));

    expect(h.requestPrTracking).toHaveBeenCalledWith("PR26270003");
    expect(h.openScreen).toHaveBeenCalledWith("PRTrackingPage");
    // The drawer closes once the screen is open.
    await waitFor(() => expect(screen.queryByTestId("sheet")).toBeNull());
  });

  it("tells the user when PR Tracking is not enabled for them", async () => {
    h.openScreen.mockReturnValue(false);
    await openDrawer();
    fireEvent.click(within(itemFor("Stock received at store")).getByText(/Track PR26270003/));

    expect(h.toast.info).toHaveBeenCalled();
    expect(screen.getByTestId("sheet")).toBeTruthy();
  });

  it("adds a notification that arrives live, once", async () => {
    await openDrawer();
    const live = { id: "n9", type: "warning", title: "Live one", message: "just now", read: false, createdAt: now() };

    act(() => h.socketHandlers["notification:new"](live));
    expect(screen.getByText("Live one")).toBeTruthy();
    expect(screen.getAllByTestId("notification-item")).toHaveLength(4);

    act(() => h.socketHandlers["notification:new"](live));
    expect(screen.getAllByTestId("notification-item")).toHaveLength(4);
    // The drawer is open, so no toast on top of it.
    expect(h.toast).not.toHaveBeenCalled();
  });

  it("pops a toast for a live notification while the drawer is closed", async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(vi.mocked(axios.get)).toHaveBeenCalled());

    act(() => h.socketHandlers["notification:new"]({
      id: "n9", type: "warning", title: "Live one", message: "hello", read: false, createdAt: now(),
    }));
    expect(h.toast).toHaveBeenCalledWith("Live one", expect.objectContaining({ description: "hello" }));
  });
});
