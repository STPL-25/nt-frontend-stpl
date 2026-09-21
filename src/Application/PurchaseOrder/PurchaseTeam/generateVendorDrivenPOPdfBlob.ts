import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

interface VendorDrivenPOItem {
  prod_name?: string;
  qty?: number;
  unit_name?: string;
  rate?: number;
  discount_pct?: number;
  gst_pct?: number;
  total_amount?: number;
}

export interface VendorDrivenPOPdfInput {
  po_no: string;
  po_date?: string;
  required_date?: string;
  purpose?: string;
  company_name?: string;
  pr_no?: string;
  items: VendorDrivenPOItem[];
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

/**
 * Renders a vendor-driven PO as a PDF Blob (client-side, same jsPDF approach
 * as generatePOPdfBlob.ts) so it can be auto-uploaded to the backend and
 * emailed to the vendor immediately after the PR's final approval — this
 * flow has no quotation step and no manual "Send to Supplier" click.
 */
export function buildVendorDrivenPOPdfBlob({
  po_no,
  po_date,
  required_date,
  purpose,
  company_name,
  pr_no,
  items,
}: VendorDrivenPOPdfInput): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Purchase Order - ${po_no}`,
    subject: 'Purchase Order',
    creator: 'Non-Trade Purchase Order System',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(79, 70, 229);
  doc.text('PURCHASE ORDER', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`PO Number: ${po_no}`, 14, 26);
  doc.text(`Date: ${formatDate(po_date)}`, 14, 32);

  doc.setFont('helvetica', 'bold');
  doc.text('Vendor', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(company_name || '-', 14, 48);

  doc.setFont('helvetica', 'bold');
  doc.text('PR Number', 110, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(pr_no || '-', 110, 48);

  doc.setFont('helvetica', 'bold');
  doc.text('Required By', 14, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(required_date), 14, 64);

  doc.setFont('helvetica', 'bold');
  doc.text('Purpose', 110, 58);
  doc.setFont('helvetica', 'normal');
  const purposeLines = doc.splitTextToSize(purpose || '-', 85) as string[];
  doc.text(purposeLines, 110, 64);

  const safeItems = Array.isArray(items) ? items : [];
  const rows = safeItems.map((item, idx) => [
    String(idx + 1),
    item.prod_name || '-',
    String(item.qty ?? 0),
    item.unit_name || '-',
    formatINR(Number(item.rate) || 0),
    `${Number(item.discount_pct) || 0}%`,
    `${Number(item.gst_pct) || 0}%`,
    formatINR(Number(item.total_amount) || 0),
  ]);

  autoTable(doc, {
    startY: 74,
    head: [['#', 'Item', 'Qty', 'Unit', 'Rate', 'Disc%', 'GST%', 'Amount']],
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
  const grandTotal = safeItems.reduce((sum, it) => sum + (Number(it.total_amount) || 0), 0);
  const y = (tableDoc.lastAutoTable?.finalY ?? 80) + 8;

  const totalsX = 130;
  doc.setFillColor(79, 70, 229);
  doc.rect(totalsX - 2, y - 5, 68, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Grand Total', totalsX, y);
  doc.text(formatINR(grandTotal), 196, y, { align: 'right' });

  return doc.output('blob');
}
