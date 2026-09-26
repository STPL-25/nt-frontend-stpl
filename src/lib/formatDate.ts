// en-IN date helpers shared by the tracking / status screens. Both return null (not
// "Invalid Date") for empty or unparseable input so callers can `&&` them into JSX.
//
// A note on time zones: SQL Server `datetime` columns are stored as a plain clock time (no
// zone) and the API's mssql driver reads them as if that clock time were UTC, so a row stored as
// "2026-09-05 18:19" reaches the browser as "2026-09-05T18:19:00.000Z". Rendering that in the
// viewer's local zone (IST) would show 11:49 pm — 5½ hours off. So a string that carries a zone
// marker is rendered IN UTC, which gives back exactly the clock time that was stored. Strings
// with no marker (the notification service's createdAt) and Date objects are already local.

const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function resolve(value?: string | number | Date | null): { date: Date; utc: boolean } | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { date, utc: typeof value === "string" && HAS_ZONE.test(value.trim()) };
}

/** "24 Sep 2026" */
export function formatDate(value?: string | number | Date | null): string | null {
  const r = resolve(value);
  if (!r) return value ? String(value) : null;
  return r.date.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", ...(r.utc ? { timeZone: "UTC" } : {}),
  });
}

/** "24 Sep 2026, 03:41 pm" */
export function formatDateTime(value?: string | number | Date | null): string | null {
  const r = resolve(value);
  if (!r) return value ? String(value) : null;
  return r.date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    ...(r.utc ? { timeZone: "UTC" } : {}),
  });
}

/** "just now" / "5m ago" / "3h ago" / "2d ago" — falls back to the date after a week. */
export function timeAgo(value?: string | number | Date | null, now: number = Date.now()): string {
  const r = resolve(value);
  if (!r) return "";
  const mins = Math.floor((now - r.date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value) ?? "";
}
