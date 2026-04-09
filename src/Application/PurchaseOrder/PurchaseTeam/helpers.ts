import type { PRItem, PRRecord, QuotationItem } from './types';

// ── Date / Currency helpers ──────────────────────────────────────────────────

export const today = () => new Date().toISOString().split('T')[0];

export const formatDate = (d?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};

export const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

// ── Data normalisation ───────────────────────────────────────────────────────

export function parseItemDetails(raw: string | PRItem[] | undefined): PRItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(it => ({ ...it, unit_name: it.unit_name ?? it.uom_name ?? it.uom_code }));
  try {
    const parsed: PRItem[] = JSON.parse(raw as string);
    return parsed.map(it => ({ ...it, unit_name: it.unit_name ?? it.uom_name ?? it.uom_code }));
  } catch { return []; }
}

export function normalisePRRows(rows: PRRecord[]): PRRecord[] {
  if (!rows || rows.length === 0) return [];

  if (rows[0]?.pr_item_details !== undefined) {
    return rows.map((r) => ({ ...r, items: parseItemDetails(r.pr_item_details) }));
  }

  if (rows[0]?.items !== undefined) {
    return rows.map((r) => {
      const items = parseItemDetails(r.items as string | PRItem[] | undefined);
      return { ...r, items };
    });
  }

  // Flat/joined rows — group by PR key
  const map = new Map<string, PRRecord>();
  for (const row of rows) {
    const key = String(row.pr_no ?? row.pr_id ?? row.pr_basic_sno ?? '');
    if (!key) continue;
    if (!map.has(key)) {
      const { prod_name, unit_name, quantity, est_cost, ...header } = row;
      map.set(key, { ...header, items: [] });
    }
    const pr = map.get(key)!;
    (pr.items as PRItem[]).push({
      pr_item_sno: (row as any).pr_item_sno,
      prod_sno: (row as any).prod_sno,
      prod_name: row.prod_name,
      specification: (row as any).specification,
      unit_name: row.unit_name ?? (row as any).uom_name ?? (row as any).uom_code,
      unit: (row as any).unit ?? (row as any).uom_sno ?? (row as any).unit_sno,
      qty: row.quantity ?? (row as any).qty ?? (row as any).req_qty,
      est_cost: row.est_cost ?? (row as any).estimated_price,
      budget_sno: (row as any).budget_sno,
    });
  }
  return Array.from(map.values());
}

export function extractQuotationItems(pr: PRRecord): QuotationItem[] {
  const raw: PRItem[] = Array.isArray(pr.items) ? pr.items : [];
  return raw.map((it) => ({
    pr_item_sno: it.pr_item_sno,
    prod_sno: it.prod_sno,
    prod_name: it.prod_name ?? it.item_name ?? '',
    specification: it.specification ?? '',
    qty: Number(it.qty ?? it.quantity ?? (it as any).req_qty ?? 0),
    unit: it.unit ?? (it as any).uom_sno ?? (it as any).unit_sno ?? 0,
    unit_name: it.unit_name ?? it.uom_name ?? it.uom_code ?? '',
    unit_price: 0,
    discount_pct: 0,
    tax_pct: 0,
    total_amount: 0,
    delivery_days: 0,
    remarks: '',
  }));
}

// ── PR display helpers ───────────────────────────────────────────────────────

export function getPRDisplayNo(pr: PRRecord): string {
  return pr.pr_no ?? `PR-${pr.pr_id ?? pr.pr_basic_sno}`;
}

export function getPRItemCount(pr: PRRecord): number {
  return Array.isArray(pr.items) ? pr.items.length : 0;
}

export function getPRItems(pr: PRRecord | null | undefined): PRItem[] {
  if (!pr) return [];
  return Array.isArray(pr.items) ? pr.items : [];
}

/** Build a flat record from a PR suitable for dynamic field rendering */
export function prToFieldRecord(pr: PRRecord): Record<string, any> {
  return {
    ...pr,
    div_brn: [pr.div_name, pr.brn_name].filter(Boolean).join(' / ') || '—',
    request_date: pr.reg_date ?? pr.request_date ?? pr.req_date,
    required_date: pr.required_date ?? pr.req_by_date,
    created_by_name: pr.created_by_name ?? pr.entered_by ?? pr.created_by ?? '—',
  };
}

/** Get quotation total */
export function getQuotationTotal(items: QuotationItem[]): number {
  return items.reduce((s, it) => s + (it.total_amount || it.qty * it.unit_price), 0);
}

/** Calculate quotation totals breakdown */
export function calcQuotationTotals(items: QuotationItem[]) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0);
  const discount = items.reduce((s, it) => s + it.qty * it.unit_price * (it.discount_pct / 100), 0);
  const tax = items.reduce((s, it) => {
    const base = it.qty * it.unit_price * (1 - it.discount_pct / 100);
    return s + base * (it.tax_pct / 100);
  }, 0);
  return { subtotal, discount, tax, grandTotal: subtotal - discount + tax };
}

/** Recalculate a single quotation item's total */
export function recalcItemTotal(item: QuotationItem): QuotationItem {
  const base = item.qty * item.unit_price;
  const afterDiscount = base * (1 - item.discount_pct / 100);
  const total = afterDiscount * (1 + item.tax_pct / 100);
  return { ...item, total_amount: total };
}
