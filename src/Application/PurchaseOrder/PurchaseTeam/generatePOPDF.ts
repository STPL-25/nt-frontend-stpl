import type { PRRecord, Quotation, POFormState } from './types';
import { formatDate, formatINR, getPRDisplayNo, calcQuotationTotals } from './helpers';

export interface POPDFData {
  pr: PRRecord;
  quotation: Quotation;
  form: POFormState;
  poNumber?: string;
  apiResponse?: unknown;
  targetWindow?: Window | null;
}

interface POHeader {
  com_logo?: string | null;
}

export function openPOPDFWindow(): Window | null {
  const win = window.open('', '_blank', 'width=960,height=760');
  if (!win) return null;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Preparing Purchase Order</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}
    .msg{border:1px solid #e5e7eb;background:white;border-radius:8px;padding:20px 24px;box-shadow:0 12px 30px rgba(15,23,42,.08)}
    .title{font-size:14px;font-weight:700;margin-bottom:6px}
    .sub{font-size:12px;color:#6b7280}
  </style>
</head>
<body>
  <div class="msg">
    <div class="title">Preparing Purchase Order PDF...</div>
    <div class="sub">Please wait while the PO is saved.</div>
  </div>
</body>
</html>`);
  win.document.close();
  return win;
}

export function generatePOPDF(data: POPDFData): boolean {
  const { pr, quotation, form, poNumber, apiResponse, targetWindow } = data;
  const { subtotal, discount, tax, grandTotal } = calcQuotationTotals(quotation.items);

  const displayPoNo = poNumber ?? `PO-${getPRDisplayNo(pr)}-${Date.now().toString().slice(-6)}`;
  const vendorName = quotation.vendor_name ?? quotation.company_name ?? '—';
  const companyLogo = extractPOHeader(apiResponse)?.com_logo?.trim();
  console.log('Company logo URL:', companyLogo);
  const companyLogoHtml = companyLogo
    ? `<img class="company-logo" src="${escapeHtml(companyLogo)}" alt="${escapeHtml(pr.com_name ?? 'Company')} logo">`
    : '';

  const itemRows = quotation.items
    .map(
      (item, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td><strong>${item.prod_name}</strong></td>
      <td>${item.specification || '—'}</td>
      <td class="right">${item.qty}</td>
      <td>${item.unit_name || '—'}</td>
      <td class="right">${formatINR(item.unit_price)}</td>
      <td class="right">${item.discount_pct}%</td>
      <td class="right">${item.tax_pct}%</td>
      <td class="right bold">${formatINR(item.total_amount || item.qty * item.unit_price)}</td>
    </tr>`,
    )
    .join('');

  const deliverySection = form.delivery_address
    ? `<div class="section" style="margin-bottom:16px">
        <div class="section-title">Delivery Address</div>
        <p style="font-size:11px;white-space:pre-line;margin-top:4px">${escapeHtml(form.delivery_address)}</p>
      </div>`
    : '';

  const termsSection = form.terms_conditions
    ? `<div class="section" style="margin-bottom:24px">
        <div class="section-title">Terms &amp; Conditions</div>
        <p style="font-size:11px;white-space:pre-line;margin-top:4px">${escapeHtml(form.terms_conditions)}</p>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  /* <title>Purchase Order — ${displayPoNo}</title>*/
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;padding:20mm 18mm}
    /* Header */
    .po-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4f46e5;padding-bottom:14px;margin-bottom:18px}
    .company-brand{display:flex;align-items:center;gap:12px}
    .company-logo{display:block;max-width:120px;height:52px;object-fit:contain;flex-shrink:0}
    .company-block h1{font-size:20px;color:#4f46e5;font-weight:800;letter-spacing:-0.5px}
    .company-block p{font-size:10px;color:#888;margin-top:2px}
    .po-meta{text-align:right}
    .po-meta .doc-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600}
    .po-meta .doc-no{font-size:18px;font-weight:800;color:#4f46e5;margin-top:2px}
    .po-meta .doc-date{font-size:11px;color:#555;margin-top:3px}
    /* Info grid */
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .section{background:#f8f8ff;border:1px solid #e5e5f0;border-radius:6px;padding:11px 13px}
    .section-title{font-size:9px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:0.8px;margin-bottom:7px;padding-bottom:5px;border-bottom:1px solid #e5e5f0}
    .info-row{display:flex;gap:6px;margin-bottom:4px;font-size:11px}
    .info-row label{color:#888;min-width:90px;flex-shrink:0}
    .info-row span{font-weight:500;color:#1a1a1a}
    /* Table */
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
    thead tr{background:#4f46e5;color:#fff}
    th{padding:8px 7px;font-weight:600;font-size:10px;text-align:left;white-space:nowrap}
    td{padding:7px 7px;border-bottom:1px solid #eee}
    tbody tr:nth-child(even){background:#f9f9ff}
    /* Alignment helpers */
    .center{text-align:center}
    .right{text-align:right}
    .bold{font-weight:600}
    /* Totals */
    .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:20px}
    .totals{width:270px;border:1px solid #e5e5f0;border-radius:6px;overflow:hidden;font-size:11px}
    .t-row{display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #eee}
    .t-row label{color:#666}
    .t-row span{font-weight:500}
    .t-row.grand{background:#4f46e5;color:#fff;font-size:13px;font-weight:700;border-bottom:none}
    .t-row.grand label,.t-row.grand span{color:#fff}
    /* Footer signatures */
    .sig-footer{margin-top:36px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px}
    .sig-block{padding-top:32px;border-top:1px solid #999;text-align:center;font-size:10px;color:#666}
    /* Print */
    @media print{
      body{padding:10mm 12mm}
      @page{margin:10mm}
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="po-header">
    <div class="company-block">
      <div class="company-brand">
        ${companyLogoHtml}
        <div>
          <h1>${escapeHtml(pr.com_name ?? 'Company Name')}</h1>
          <p>${escapeHtml([pr.div_name, pr.brn_name].filter(Boolean).join(' | ') || '')}</p>
          <p style="margin-top:6px;font-size:10px;color:#666">${escapeHtml(pr.dept_name ?? '')}</p>
        </div>
      </div>
    </div>
    <div class="po-meta">
      <div class="doc-label">Purchase Order</div>
      <div class="doc-no">${escapeHtml(displayPoNo)}</div>
      <div class="doc-date">Date: ${formatDate(form.po_date)}</div>
    </div>
  </div>

  <!-- Vendor + PO Info -->
  <div class="grid-2">
    <div class="section">
      <div class="section-title">Vendor Details</div>
      <div class="info-row"><label>Vendor</label><span>${escapeHtml(vendorName)}</span></div>
      <div class="info-row"><label>Quotation Ref</label><span>${escapeHtml(quotation.quotation_ref_no)}</span></div>
      <div class="info-row"><label>Quotation Date</label><span>${formatDate(quotation.quotation_date)}</span></div>
      <div class="info-row"><label>Valid Upto</label><span>${formatDate(quotation.valid_upto)}</span></div>
      <div class="info-row"><label>Payment Terms</label><span>${escapeHtml(quotation.payment_terms || '—')}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Order Details</div>
      <div class="info-row"><label>PR Number</label><span>${escapeHtml(getPRDisplayNo(pr))}</span></div>
      <div class="info-row"><label>PR Date</label><span>${formatDate(pr.reg_date ?? pr.request_date ?? pr.req_date)}</span></div>
      <div class="info-row"><label>Required Date</label><span>${formatDate(form.required_date)}</span></div>
      <div class="info-row"><label>Purpose</label><span>${escapeHtml(form.purpose || '—')}</span></div>
      <div class="info-row"><label>Currency</label><span>${escapeHtml(quotation.currency_code || 'INR')}</span></div>
    </div>
  </div>

  ${deliverySection}

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th class="center" style="width:30px">#</th>
        <th>Item / Product</th>
        <th>Specification</th>
        <th class="right" style="width:50px">Qty</th>
        <th style="width:50px">Unit</th>
        <th class="right" style="width:90px">Unit Price</th>
        <th class="right" style="width:55px">Disc%</th>
        <th class="right" style="width:55px">Tax%</th>
        <th class="right" style="width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <div class="totals">
      <div class="t-row"><label>Subtotal</label><span>${formatINR(subtotal)}</span></div>
      <div class="t-row"><label>Discount</label><span>− ${formatINR(discount)}</span></div>
      <div class="t-row"><label>Tax</label><span>+ ${formatINR(tax)}</span></div>
      <div class="t-row grand"><label>Grand Total</label><span>${formatINR(grandTotal)}</span></div>
    </div>
  </div>

  ${termsSection}

  <!-- Signature block -->
  <div class="sig-footer">
    <div class="sig-block">Prepared By</div>
    <div class="sig-block">Purchase Manager</div>
    <div class="sig-block">Authorized Signatory</div>
  </div>
</body>
</html>`;

  const win = targetWindow ?? window.open('', '_blank', 'width=960,height=760');
  if (!win) {
    alert('Please allow pop-ups for this site to download the PO as PDF.');
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  printWhenImagesReady(win);
  return true;
}

function extractPOHeader(value: unknown): POHeader | null {
  const parsed = parseJSON(value);
  if (!parsed) return null;

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const header = extractPOHeader(item);
      if (header) return header;
    }
    return null;
  }

  if (typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;
  if ('com_logo' in record) return record as POHeader;

  if ('po_header' in record) {
    const header = parseJSON(record.po_header);
    if (header && typeof header === 'object' && !Array.isArray(header)) {
      return header as POHeader;
    }
  }

  for (const key of ['decrypted', 'data']) {
    if (key in record) {
      const header = extractPOHeader(record[key]);
      if (header) return header;
    }
  }

  return null;
}

function parseJSON(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function printWhenImagesReady(win: Window): void {
  let printed = false;
  const print = () => {
    if (printed || win.closed) return;
    printed = true;
    win.focus();
    win.print();
  };

  const pendingImages = Array.from(win.document.images).filter(image => !image.complete);

  if (pendingImages.length === 0) {
    setTimeout(print, 600);
    return;
  }

  let remaining = pendingImages.length;
  const imageSettled = () => {
    remaining -= 1;
    if (remaining === 0) setTimeout(print, 100);
  };

  pendingImages.forEach(image => {
    image.addEventListener('load', imageSettled, { once: true });
    image.addEventListener('error', imageSettled, { once: true });
  });

  // Avoid leaving the preparing window open indefinitely if an image host stalls.
  setTimeout(print, 3000);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
