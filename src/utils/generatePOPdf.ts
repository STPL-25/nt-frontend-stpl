/**
 * Generates a Purchase Order PDF by opening a print-ready window.
 * Triggered after PR approval reaches FINAL_STAGE.
 */

interface PRItem {
  prod_name?: string;
  item_name?: string;
  unit_name?: string;
  quantity?: number;
  qty?: number;
  est_cost?: number;
  estimated_price?: number;
}

interface ApprovalResult {
  pr_no: string;
  approved_by: string;
  approved_on: string;
  stages_processed: number;
  next_approver: string;
}

function formatDate(d?: string) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

export function generatePOPdf(pr: any, approvalResult: ApprovalResult) {
  // Parse items
  let items: PRItem[] = [];
  if (pr.items) {
    if (typeof pr.items === 'string') {
      try { items = JSON.parse(pr.items); } catch { items = []; }
    } else if (Array.isArray(pr.items)) {
      items = pr.items;
    }
  } else if (pr.prod_name) {
    // flat row
    items = [{ prod_name: pr.prod_name, unit_name: pr.unit_name, quantity: pr.quantity, est_cost: pr.est_cost }];
  }

  const subtotal = items.reduce((sum, it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1);
    const price = Number(it.est_cost ?? it.estimated_price ?? 0);
    return sum + qty * price;
  }, 0);

  const poNumber = `PO-${approvalResult.pr_no.replace('PR-', '')}`;
  const generatedOn = formatDate(approvalResult.approved_on);

  const itemRows = items
    .map((it, idx) => {
      const qty = Number(it.quantity ?? it.qty ?? 1);
      const price = Number(it.est_cost ?? it.estimated_price ?? 0);
      const total = qty * price;
      return `
        <tr>
          <td class="sl">${idx + 1}</td>
          <td>${it.prod_name ?? it.item_name ?? '—'}</td>
          <td class="center">${it.unit_name ?? 'pcs'}</td>
          <td class="right">${qty}</td>
          <td class="right">${price > 0 ? formatINR(price) : '—'}</td>
          <td class="right">${price > 0 ? formatINR(total) : '—'}</td>
        </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Purchase Order — ${poNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 16mm; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 14px; }
  .company-block h1 { font-size: 18px; font-weight: 700; color: #1e3a5f; letter-spacing: 0.5px; }
  .company-block p { font-size: 10px; color: #555; margin-top: 2px; }
  .po-meta { text-align: right; }
  .po-meta h2 { font-size: 16px; font-weight: 700; color: #1e3a5f; }
  .po-meta table { margin-left: auto; margin-top: 4px; border-collapse: collapse; }
  .po-meta td { padding: 1px 6px 1px 0; font-size: 10px; color: #444; }
  .po-meta td:first-child { font-weight: 600; color: #1a1a1a; }

  /* Status badge */
  .badge { display: inline-block; background: #22c55e; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 10px; letter-spacing: 0.5px; text-transform: uppercase; }

  /* Info grid */
  .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .info-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px 10px; }
  .info-box h3 { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 6px; letter-spacing: 0.4px; }
  .info-box .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .info-box .label { font-size: 9px; color: #6b7280; }
  .info-box .value { font-size: 10px; font-weight: 600; color: #111; text-align: right; max-width: 60%; word-break: break-word; }

  /* Items table */
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 3px; margin-bottom: 8px; letter-spacing: 0.4px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table.items thead tr { background: #1e3a5f; color: #fff; }
  table.items thead th { padding: 6px 8px; font-size: 9px; font-weight: 700; text-align: left; text-transform: uppercase; letter-spacing: 0.3px; }
  table.items thead th.right { text-align: right; }
  table.items thead th.center { text-align: center; }
  table.items tbody tr { border-bottom: 1px solid #e5e7eb; }
  table.items tbody tr:nth-child(even) { background: #f9fafb; }
  table.items tbody td { padding: 5px 8px; font-size: 10px; vertical-align: middle; }
  table.items tbody td.sl { color: #6b7280; width: 28px; }
  table.items tbody td.right { text-align: right; }
  table.items tbody td.center { text-align: center; }

  /* Totals */
  .totals { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .totals-box { width: 220px; }
  .totals-box .t-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  .totals-box .t-row.grand { font-weight: 700; font-size: 12px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; border-top: 2px solid #1e3a5f; padding: 5px 0; }

  /* Approval trail */
  .approval-trail { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px 10px; margin-bottom: 14px; }
  .approval-trail h3 { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; letter-spacing: 0.4px; }
  .approval-trail .trail-row { display: flex; gap: 20px; font-size: 10px; }
  .approval-trail .trail-row span { color: #374151; }
  .approval-trail .trail-row strong { color: #111; }

  /* Footer */
  .footer { border-top: 1px solid #d1d5db; padding-top: 8px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer .note { font-size: 9px; color: #9ca3af; max-width: 60%; }
  .footer .sign { text-align: right; }
  .footer .sign .sign-line { width: 120px; border-bottom: 1px solid #374151; margin-bottom: 3px; margin-left: auto; }
  .footer .sign p { font-size: 9px; color: #6b7280; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 10mm 12mm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="company-block">
      <h1>${pr.com_name ?? 'Company Name'}</h1>
      <p>${[pr.div_name, pr.brn_name].filter(Boolean).join(' | ') || '&nbsp;'}</p>
      <p style="margin-top:6px"><span class="badge">&#10003; Fully Approved</span></p>
    </div>
    <div class="po-meta">
      <h2>PURCHASE ORDER</h2>
      <table>
        <tr><td>PO Number</td><td><strong>${poNumber}</strong></td></tr>
        <tr><td>PR Reference</td><td>${approvalResult.pr_no}</td></tr>
        <tr><td>PO Date</td><td>${generatedOn}</td></tr>
        <tr><td>Department</td><td>${pr.dept_name ?? '—'}</td></tr>
      </table>
    </div>
  </div>

  <!-- Info grid -->
  <div class="info-section">
    <div class="info-box">
      <h3>Requisition Details</h3>
      <div class="row"><span class="label">Requested By</span><span class="value">${pr.entered_by ?? pr.created_by ?? '—'}</span></div>
      <div class="row"><span class="label">Request Date</span><span class="value">${formatDate(pr.request_date ?? pr.req_date)}</span></div>
      <div class="row"><span class="label">Required By</span><span class="value">${formatDate(pr.required_date ?? pr.req_by_date)}</span></div>
      <div class="row"><span class="label">Priority</span><span class="value">${pr.priority_name ?? '—'}</span></div>
      <div class="row"><span class="label">Purpose</span><span class="value">${pr.purpose ?? '—'}</span></div>
    </div>
    <div class="info-box">
      <h3>Approval Info</h3>
      <div class="row"><span class="label">Approved By</span><span class="value">${approvalResult.approved_by}</span></div>
      <div class="row"><span class="label">Approved On</span><span class="value">${generatedOn}</span></div>
      <div class="row"><span class="label">Stages Processed</span><span class="value">${approvalResult.stages_processed}</span></div>
      <div class="row"><span class="label">Status</span><span class="value" style="color:#16a34a;font-weight:700">FINAL STAGE</span></div>
    </div>
  </div>

  <!-- Items -->
  <div class="section-title">Items Ordered</div>
  <table class="items">
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Item / Product</th>
        <th class="center" style="width:60px">Unit</th>
        <th class="right" style="width:60px">Qty</th>
        <th class="right" style="width:90px">Est. Unit Price</th>
        <th class="right" style="width:90px">Est. Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  ${subtotal > 0 ? `
  <div class="totals">
    <div class="totals-box">
      <div class="t-row"><span>Sub Total</span><span>${formatINR(subtotal)}</span></div>
      <div class="t-row grand"><span>Grand Total (Est.)</span><span>${formatINR(subtotal)}</span></div>
    </div>
  </div>` : ''}

  <!-- Approval trail -->
  <div class="approval-trail">
    <h3>Approval Trail</h3>
    <div class="trail-row">
      <span>Approved by: <strong>${approvalResult.approved_by}</strong></span>
      <span>On: <strong>${generatedOn}</strong></span>
      <span>PR: <strong>${approvalResult.pr_no}</strong></span>
      <span>Stage: <strong>Final</strong></span>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="note">
      This is a system-generated Purchase Order. Estimated prices are indicative and subject to vendor confirmation.<br/>
      Generated on ${new Date().toLocaleString('en-IN')}.
    </div>
    <div class="sign">
      <div class="sign-line"></div>
      <p>Authorised Signatory</p>
    </div>
  </div>

</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for images/styles to load then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
