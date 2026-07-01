import spaceLogo from '@/assets/space.png';

type AnyRecord = Record<string, unknown>;

function parseJSON<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompanyAddress(pr: AnyRecord, poHeader: AnyRecord): string {
  const raw = poHeader.com_address ?? pr.com_address ?? '';
  if (raw) return String(raw);

  return [
    poHeader.com_door_no ?? pr.com_door_no,
    poHeader.com_street ?? pr.com_street,
    poHeader.com_area ?? pr.com_area,
    poHeader.com_city ?? pr.com_city,
    poHeader.com_state ?? pr.com_state,
    poHeader.com_pincode ?? pr.com_pincode,
  ].filter(Boolean).join(', ');
}

function formatVendorAddress(vendor: AnyRecord, quotation: AnyRecord): string {
  const addresses = parseJSON<AnyRecord[]>(
    vendor.vendor_address ?? quotation.kyc_address,
    [],
  );
  if (!Array.isArray(addresses) || addresses.length === 0) return '';

  const primary = addresses.find((address) => {
    const type = String(address.address_type ?? '').toUpperCase();
    return type === 'PRIMARY' || type === 'BILLING';
  }) ?? addresses[0];

  return [
    primary.door_no,
    primary.street,
    primary.area,
    primary.city,
    primary.taluk,
    primary.state,
    primary.pincode,
  ].filter(Boolean).join(', ');
}

function formatDate(value?: unknown): string {
  if (!value) return '-';
  const stringValue = String(value);
  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return stringValue;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value?: unknown): string {
  if (!value) return '-';
  const stringValue = String(value);
  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return stringValue;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: unknown): string {
  return toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function itemUnitPrice(item: AnyRecord): number {
  return toNumber(item.agreed_unit_price ?? item.unit_price);
}

function itemBase(item: AnyRecord): number {
  return toNumber(item.qty) * itemUnitPrice(item);
}

function itemDiscount(item: AnyRecord): number {
  return itemBase(item) * (toNumber(item.discount_pct) / 100);
}

function calculatedTotalCost(item: AnyRecord): number {
  return itemBase(item) - itemDiscount(item);
}

function itemTotalCost(item: AnyRecord): number {
  return item.total_cost != null
    ? toNumber(item.total_cost)
    : calculatedTotalCost(item);
}

function itemNetCost(item: AnyRecord): number {
  if (item.net_cost != null) return toNumber(item.net_cost);
  if (item.total_amount != null) return toNumber(item.total_amount);
  return itemTotalCost(item) * (1 + (toNumber(item.tax_pct) / 100));
}

function itemTaxValue(item: AnyRecord): number {
  return Math.max(0, itemNetCost(item) - itemTotalCost(item));
}

/**
 * Opens the browser print dialog for the final Purchase Order returned by the
 * approval API. The API's po_header, vendor and po_items values are the source
 * of truth; the PR/quotation records are retained as a legacy fallback.
 */
export function generatePOApprovalPdf(
  pr: AnyRecord,
  quotation: AnyRecord,
  approvalData?: AnyRecord,
): void {
  const poHeader = parseJSON<AnyRecord>(approvalData?.po_header, {});
  const vendor = parseJSON<AnyRecord>(approvalData?.vendor, {});
  const approvedItems = parseJSON<AnyRecord[]>(approvalData?.po_items, []);
  const quotationItems = parseJSON<AnyRecord[]>(quotation?.quotation_item_details, []);
  const items = Array.isArray(approvedItems) && approvedItems.length > 0
    ? approvedItems
    : quotationItems;

  const totalCost = items.reduce((sum, item) => sum + itemTotalCost(item), 0);
  const grandTotal = items.reduce((sum, item) => sum + itemNetCost(item), 0);
  const taxTotal = grandTotal - totalCost;

  const poNo = String(poHeader.po_df_no
    ?? approvalData?.po_no
    ?? `PO-${String(pr?.pr_no ?? '').replace(/^PR-?/, '')}-${Date.now().toString().slice(-4)}`);
  const poDate = poHeader.po_date ?? approvalData?.final_approved_on ?? new Date().toISOString();
  const prNo = poHeader.source_pr_no ?? approvalData?.pr_no ?? pr?.pr_no;
  const companyName = poHeader.com_name ?? pr?.com_name ?? 'Company Name';
  const divisionName = poHeader.div_name ?? pr?.div_name;
  const branchName = poHeader.brn_name ?? pr?.brn_name;
  const departmentName = poHeader.dept_name ?? pr?.dept_name;
  const companyAddress = formatCompanyAddress(pr ?? {}, poHeader);
  const vendorAddress = formatVendorAddress(vendor, quotation ?? {});
  const vendorName = vendor.vendor_name ?? quotation?.company_name;
  const vendorCode = vendor.vendor_code ?? quotation?.supp_code;
  const contactPerson = vendor.contact_person ?? quotation?.contact_person;
  const vendorMobile = vendor.vendor_mobile ?? quotation?.mobile_number;
  const vendorEmail = vendor.vendor_email ?? quotation?.email;
  const gstNo = vendor.gst_no ?? quotation?.gst_no;
  const panNo = vendor.pan_no ?? quotation?.pan_no;
  const terms = poHeader.terms_conditions ?? quotation?.payment_terms;
  const approvedByName = approvalData?.final_approved_by_name;
  const approvedBy = approvalData?.final_approved_by;
  const approvedOn = approvalData?.final_approved_on;


  const itemRows = items.map((item, index) => `
    <tr>
      <td class="c">${index + 1}</td>
      <td>
        <strong>${escapeHtml(item.prod_name)}</strong>
        ${item.prod_code ? `<br/><span class="sub">${escapeHtml(item.prod_code)}</span>` : ''}
        ${item.specification ? `<br/><span class="sub">${escapeHtml(item.specification)}</span>` : ''}
      </td>
      <td class="r">${formatQuantity(item.qty)}</td>
      <td>${escapeHtml(item.uom_name ?? item.unit_name ?? '-')}</td>
      <td class="r">${formatINR(itemUnitPrice(item))}</td>
      <td class="r disc">
        <span class="rate-percent">${formatQuantity(item.discount_pct)}%</span>
        <span class="rate-value">${formatINR(itemDiscount(item))}</span>
      </td>
      <td class="r tax">
        <span class="rate-percent">${formatQuantity(item.tax_pct)}%</span>
        <span class="rate-value">${formatINR(itemTaxValue(item))}</span>
      </td>
      <td class="r">${formatINR(itemTotalCost(item))}</td>
      <td class="r bold">${formatINR(itemNetCost(item))}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Purchase Order - ${escapeHtml(poNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}
  .page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 13mm}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:12px;margin-bottom:14px}
  .company-block{display:flex;flex-direction:column;gap:4px;max-width:62%}
  .company-block .logo-row{display:flex;align-items:center;gap:10px}
  .company-block .logo-row img{height:48px;width:auto;object-fit:contain}
  .company-block h1{font-size:18px;font-weight:800;color:#1e3a5f}
  .company-block p{font-size:10px;color:#555;margin-top:2px}
  .badge{display:inline-block;background:#16a34a;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:10px;text-transform:uppercase;margin-top:4px}
  .po-meta{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
  .po-meta .doc-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600}
  .po-meta .doc-no{font-size:17px;font-weight:800;color:#1e3a5f}
  .po-meta .qr-wrap{margin-top:4px;border:1px solid #e5e7eb;border-radius:4px;padding:3px;background:#fff;display:inline-block}
  .po-meta .doc-date{font-size:10px;color:#555}
  .com-addr{font-size:9px;color:#374151;margin-top:3px;line-height:1.5;max-width:300px}
  .qr-po-no{font-size:8px;color:#444;text-align:center;margin-top:3px;font-family:monospace;font-weight:700;letter-spacing:.3px}
  .vendor-addr{font-size:9px;color:#374151;margin-top:2px;line-height:1.5}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
  .box{border:1px solid #d1d5db;border-radius:4px;padding:9px 11px}
  .box-title{font-size:9px;font-weight:700;text-transform:uppercase;color:#1e3a5f;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:7px;letter-spacing:.4px}
  .ir{display:flex;gap:6px;margin-bottom:3px;font-size:10px;line-height:1.35}
  .ir label{color:#6b7280;min-width:90px;flex-shrink:0}
  .ir span{font-weight:600;color:#111;overflow-wrap:anywhere}
  .items-title{font-size:10px;font-weight:700;text-transform:uppercase;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px;margin-bottom:10px;letter-spacing:.4px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:9px}
  thead tr{background:#1e3a5f;color:#fff}
  th{padding:6px 4px;font-weight:700;font-size:8px;text-align:left;white-space:nowrap;text-transform:uppercase}
  td{padding:6px 4px;border-bottom:1px solid #eee;vertical-align:middle}
  tbody tr:nth-child(even){background:#f9fafb}
  .sub{font-size:8px;color:#6b7280}
  .c{text-align:center}.r{text-align:right}.bold{font-weight:700}
  .disc{color:#d97706}.tax{color:#2563eb}
  .rate-percent{display:block;font-weight:700}
  .rate-value{display:block;margin-top:2px;font-size:7px;white-space:nowrap;color:#4b5563}
  .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:14px}
  .totals{width:270px;border:1px solid #d1d5db;border-radius:4px;overflow:hidden;font-size:10px}
  .t-row{display:flex;justify-content:space-between;padding:5px 11px;border-bottom:1px solid #eee}
  .t-row.grand{background:#1e3a5f;color:#fff;font-size:12px;font-weight:700;border-bottom:none}
  .t-row.grand label,.t-row.grand span{color:#fff}
  .trail{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:4px;padding:8px 11px;margin-bottom:14px}
  .trail-title{font-size:9px;font-weight:700;text-transform:uppercase;color:#166534;border-bottom:1px solid #bbf7d0;padding-bottom:4px;margin-bottom:6px;letter-spacing:.4px}
  .trail-row{display:flex;flex-wrap:wrap;gap:14px;font-size:10px;color:#374151}
  .trail-row strong{color:#111}
  .sig-footer{margin-top:28px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px}
  .sig-block{padding-top:28px;border-top:1px solid #9ca3af;text-align:center;font-size:9px;color:#6b7280}
  .sig-name{display:block;color:#111;font-weight:700;margin-bottom:2px}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{padding:8mm 10mm}
    @page{size:A4;margin:8mm}
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="company-block">
      <div class="logo-row">
        <img src="${spaceLogo}" alt="Logo"/>
        <h1>${escapeHtml(companyName)}</h1>
      </div>
      ${companyAddress ? `<p class="com-addr">${escapeHtml(companyAddress)}</p>` : ''}
      <p>${escapeHtml([divisionName, branchName].filter(Boolean).join(' | '))}</p>
      <p>${escapeHtml(departmentName ?? '')}</p>
    </div>
    <div class="po-meta">
      <div class="doc-label">Purchase Order</div>
      <div class="doc-no">${escapeHtml(poNo)}</div>
      <div class="qr-wrap">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&amp;data=${encodeURIComponent(poNo)}" alt="QR ${escapeHtml(poNo)}" width="80" height="80"/>
        <div class="qr-po-no">${escapeHtml(poNo)}</div>
      </div>
      <div class="doc-date">PO Date: ${formatDate(poDate)}</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="box">
      <div class="box-title">Vendor Details</div>
      <div class="ir"><label>Vendor</label><span>${escapeHtml(vendorName ?? '-')}</span></div>
      ${vendorCode ? `<div class="ir"><label>Vendor Code</label><span>${escapeHtml(vendorCode)}</span></div>` : ''}
      ${contactPerson ? `<div class="ir"><label>Contact Person</label><span>${escapeHtml(contactPerson)}</span></div>` : ''}
      ${vendorMobile ? `<div class="ir"><label>Mobile</label><span>${escapeHtml(vendorMobile)}</span></div>` : ''}
      ${vendorEmail ? `<div class="ir"><label>Email</label><span>${escapeHtml(vendorEmail)}</span></div>` : ''}
      ${gstNo ? `<div class="ir"><label>GST No.</label><span>${escapeHtml(gstNo)}</span></div>` : ''}
      ${panNo ? `<div class="ir"><label>PAN No.</label><span>${escapeHtml(panNo)}</span></div>` : ''}
      ${vendorAddress ? `<div class="ir"><label>Address</label><span class="vendor-addr">${escapeHtml(vendorAddress)}</span></div>` : ''}
    </div>
    <div class="box">
      <div class="box-title">Order Details</div>
      <div class="ir"><label>PR Number</label><span>${escapeHtml(prNo ?? '-')}</span></div>
      <div class="ir"><label>PO Number</label><span>${escapeHtml(poNo)}</span></div>
      <div class="ir"><label>PR Date</label><span>${formatDate(poHeader.pr_reg_date ?? pr?.reg_date)}</span></div>
      <div class="ir"><label>Required By</label><span>${formatDate(poHeader.pr_required_date ?? pr?.required_date)}</span></div>
      <div class="ir"><label>Department</label><span>${escapeHtml(departmentName ?? '-')}</span></div>
      ${terms ? `<div class="ir"><label>Terms</label><span>${escapeHtml(terms)}</span></div>` : ''}
    </div>
  </div>

  <div class="items-title">Items Ordered</div>
  <table>
    <thead>
      <tr>
        <th class="c" style="width:24px">#</th>
        <th>Item / Product</th>
        <th class="r" style="width:42px">Qty</th>
        <th style="width:38px">Unit</th>
        <th class="r" style="width:72px">Unit Price</th>
        <th class="r" style="width:62px">Discount</th>
        <th class="r" style="width:62px">Tax</th>
        <th class="r" style="width:75px">Total Cost</th>
        <th class="r" style="width:75px">Net Cost</th>
      </tr>
    </thead>
    <tbody>${itemRows || '<tr><td colspan="9" style="text-align:center;color:#6b7280;padding:12px">No items</td></tr>'}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="t-row"><label>Total Cost</label><span>${formatINR(totalCost)}</span></div>
      <div class="t-row"><label>Tax</label><span>${formatINR(taxTotal)}</span></div>
      <div class="t-row grand"><label>Grand Total</label><span>${formatINR(grandTotal)}</span></div>
    </div>
  </div>

  ${approvedBy || approvedByName || approvedOn ? `
    <div class="trail">
      <div class="trail-title">Final Approval</div>
      <div class="trail-row">
        <span>Approved by: <strong>${escapeHtml(approvedByName ?? approvedBy ?? '-')}</strong>${approvedByName && approvedBy ? ` (${escapeHtml(approvedBy)})` : ''}</span>
        <span>Approved on: <strong>${formatDateTime(approvedOn)}</strong></span>
      </div>
    </div>` : ''}

  <div class="sig-footer">
    <div class="sig-block">Prepared By</div>
    <div class="sig-block">Purchase Manager</div>
    <div class="sig-block">
      ${approvedByName ? `<span class="sig-name">${escapeHtml(approvedByName)}</span>` : ''}
      Authorised Signatory
    </div>
  </div>

  <p style="text-align:center;font-size:9px;color:#9ca3af;margin-top:20px">
    System-generated Purchase Order | Generated on ${new Date().toLocaleString('en-IN')}
  </p>
</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=960,height=760');
  if (!printWindow) {
    alert('Please allow pop-ups for this site to download the PO PDF.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
  }, 800);
}
