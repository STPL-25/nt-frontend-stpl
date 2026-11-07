// The TDS rate box on the Payment page (sql/75 typed rate, sql/84 who entered it).

/**
 * What a TDS rate box may hold: digits and one decimal point, at most 3 decimals (the database keeps 3).
 * (An earlier version filtered with /[^d.]/ - no backslash - which removed every digit, so nothing could be typed.)
 */
export const cleanRateInput = (raw: string): string => {
  const s = String(raw ?? '').replace(/[^\d.]/g, '');
  const [whole, ...rest] = s.split('.');
  return rest.length === 0 ? whole : `${whole}.${rest.join('').slice(0, 3)}`;
};

/** Why a typed rate cannot be used (empty = fine; blank = "use the section's own rate"). */
export const rateProblem = (raw: string | null | undefined): string => {
  const t = String(raw ?? '').trim();
  if (t === '') return '';
  const n = Number(t);
  if (!Number.isFinite(n)) return 'Enter the TDS rate as a number, e.g. 2 or 2.5';
  if (n < 0 || n > 100) return 'The TDS rate must be between 0 and 100 percent';
  return '';
};

/** "KTM1148 · 04 Nov 2026 17:54" - who entered a rate and when; 'not recorded' for a rate set before sql/84. */
export const enteredLine = (by: string | null | undefined, at: string | null | undefined): string => {
  const who = String(by ?? '').trim();
  if (!who) return 'not recorded';
  const when = String(at ?? '').trim();
  const d = when ? new Date(when.replace(' ', 'T')) : null;
  const shown = d && !Number.isNaN(d.getTime())
    ? `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : when;
  return shown ? `${who} · ${shown}` : who;
};
