import { describe, it, expect } from "vitest";
import { extractPrNo, dayLabel, groupByDay } from "@/lib/notifications";
import { formatDate, formatDateTime, timeAgo } from "@/lib/formatDate";

describe("extractPrNo", () => {
  it("prefers data.pr_no", () => {
    expect(extractPrNo({ title: "x", message: "PR PR26270003", data: { pr_no: "PR26270099" } })).toBe("PR26270099");
  });

  it("falls back to a PR number quoted in the message (older notifications have no data)", () => {
    expect(
      extractPrNo({ title: "Stock received", message: "…for PR PR26270003 has arrived at the store." })
    ).toBe("PR26270003");
  });

  it("understands split and vendor-driven numbers", () => {
    expect(extractPrNo({ title: "", message: "see PR26270026/1 now" })).toBe("PR26270026/1");
    expect(extractPrNo({ title: "VPR2627-0009 approved", message: "" })).toBe("VPR2627-0009");
  });

  it("returns null when there is no PR number", () => {
    expect(extractPrNo({ title: "Stock issued to you", message: "Requisition SR-12. PR #123 approved" })).toBeNull();
  });
});

describe("dayLabel / groupByDay", () => {
  const now = new Date(2026, 8, 24, 15, 0, 0); // 24 Sep 2026

  it("labels today and yesterday", () => {
    expect(dayLabel(new Date(2026, 8, 24, 1, 0).toISOString(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 8, 23, 23, 0).toISOString(), now)).toBe("Yesterday");
  });

  // ICU versions disagree on "Sep" vs "Sept" for en-IN, so match the stable prefix.
  it("uses the date for older days", () => {
    expect(dayLabel(new Date(2026, 8, 10, 12, 0).toISOString(), now)).toMatch(/^10 Sep\w* 2026$/);
  });

  it("groups consecutive items under one heading, keeping order", () => {
    const items = [
      { id: "a", createdAt: new Date(2026, 8, 24, 14, 0).toISOString() },
      { id: "b", createdAt: new Date(2026, 8, 24, 9, 0).toISOString() },
      { id: "c", createdAt: new Date(2026, 8, 22, 9, 0).toISOString() },
    ];
    const groups = groupByDay(items, now);
    expect(groups.map((g) => g.label)).toEqual(["Today", expect.stringMatching(/^22 Sep\w* 2026$/)]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("formatDate helpers", () => {
  it("return null for empty input rather than 'Invalid Date'", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDateTime("")).toBeNull();
  });

  it("formats a date", () => {
    expect(formatDate("2026-09-24T10:00:00")).toMatch(/^24 Sep\w* 2026$/);
  });

  it("renders a zone-marked DB timestamp as the clock time that was stored, whatever the viewer's zone", () => {
    // stored as 2026-09-05 18:19 (server clock) -> serialised by the driver as ...18:19:00.000Z
    expect(formatDateTime("2026-09-05T18:19:00.000Z")).toMatch(/^05 Sep\w* 2026, 06:19/i);
    // a late-evening entry must not roll over to the next day
    expect(formatDate("2026-09-05T23:30:00.000Z")).toMatch(/^05 Sep/);
  });

  it("leaves an unmarked (already local) timestamp alone", () => {
    expect(formatDateTime("2026-09-24T15:43:49.510")).toMatch(/^24 Sep\w* 2026, 03:43/i);
  });

  it("timeAgo steps through minutes, hours, days", () => {
    const now = new Date(2026, 8, 24, 12, 0, 0).getTime();
    expect(timeAgo(new Date(now - 30_000), now)).toBe("just now");
    expect(timeAgo(new Date(now - 5 * 60_000), now)).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000), now)).toBe("3h ago");
    expect(timeAgo(new Date(now - 2 * 86_400_000), now)).toBe("2d ago");
  });
});
