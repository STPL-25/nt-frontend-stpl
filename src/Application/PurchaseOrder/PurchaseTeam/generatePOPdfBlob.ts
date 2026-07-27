import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { PRRecord, Quotation, POFormState } from './types';
import { formatDate, formatINR, getPRDisplayNo, calcQuotationTotals } from './helpers';

export interface POPdfInput {
  pr: PRRecord;
  quotation: Quotation;
  form: POFormState;
  poNo: string;
}

/** Renders the PO as a PDF Blob (client-side) so it can be uploaded to the backend and emailed to the supplier. */
export function buildPOPdfBlob({ pr, quotation, form, poNo }: POPdfInput): Blob {
  const { subtotal, discount, tax, grandTotal } = calcQuotationTotals(quotation.items);
  const vendorName = quotation.vendor_name ?? quotation.company_name ?? '-';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Purchase Order - ${poNo}`, subject: 'Purchase Order', creator: 'Non-Trade Purchase Order System' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(79, 70, 229);
  doc.text('PURCHASE ORDER', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`PO Number: ${poNo}`, 14, 26);
  doc.text(`Date: ${formatDate(form.po_date)}`, 14, 32);

  doc.setFont('helvetica', 'bold');
  doc.text('Vendor', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(vendorName, 14, 48);

  doc.setFont('helvetica', 'bold');
  doc.text('PR Number', 110, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(getPRDisplayNo(pr), 110, 48);

  doc.setFont('helvetica', 'bold');
  doc.text('Required By', 14, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(form.required_date), 14, 64);

  doc.setFont('helvetica', 'bold');
  doc.text('Purpose', 110, 58);
  doc.setFont('helvetica', 'normal');
  const purposeLines = doc.splitTextToSize(form.purpose || '-', 85) as string[];
  doc.text(purposeLines, 110, 64);

  const rows = quotation.items.map((item, idx) => [
    String(idx + 1),
    item.prod_name,
    String(item.qty),
    item.unit_name || '-',
    formatINR(item.unit_price),
    `${item.discount_pct}%`,
    `${item.tax_pct}%`,
    formatINR(item.total_amount || item.qty * item.unit_price),
  ]);

  autoTable(doc, {
    startY: 74,
    head: [['#', 'Item', 'Qty', 'Unit', 'Rate', 'Disc%', 'Tax%', 'Amount']],
    body: rows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
  });

  const tableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  let y = (tableDoc.lastAutoTable?.finalY ?? 80) + 8;

  const totalsX = 130;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('Subtotal', totalsX, y);
  doc.text(formatINR(subtotal), 196, y, { align: 'right' });
  y += 6;
  doc.text('Discount', totalsX, y);
  doc.text(`- ${formatINR(discount)}`, 196, y, { align: 'right' });
  y += 6;
  doc.text('Tax', totalsX, y);
  doc.text(`+ ${formatINR(tax)}`, 196, y, { align: 'right' });
  y += 8;
  doc.setFillColor(79, 70, 229);
  doc.rect(totalsX - 2, y - 5, 68, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Grand Total', totalsX, y);
  doc.text(formatINR(grandTotal), 196, y, { align: 'right' });
  doc.setTextColor(30, 30, 30);

  y += 16;
  if (form.terms_conditions) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Terms & Conditions', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const termLines = doc.splitTextToSize(form.terms_conditions, 180) as string[];
    doc.text(termLines, 14, y);
    y += termLines.length * 4 + 6;
  }
  if (form.delivery_address) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Delivery Address', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const addrLines = doc.splitTextToSize(form.delivery_address, 180) as string[];
    doc.text(addrLines, 14, y);
  }

  return doc.output('blob');
}
