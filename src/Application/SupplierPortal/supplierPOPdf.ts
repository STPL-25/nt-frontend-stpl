import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { SupplierPODetail, SupplierPOItem } from '@/Services/SupplierService';
import { formatDate } from './helpers';

/** The saved address may be plain text or a JSON object from the address master (add_door_no, add_street, …). */
export function addressToLines(raw: string | null | undefined): string[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('{')) {
    try {
      const a = JSON.parse(text) as Record<string, unknown>;
      const s = (k: string) => String(a[k] ?? '').replace(/\s+/g, ' ').trim();
      const stateLine = [s('add_state'), s('add_state_code') && `(Code ${s('add_state_code')})`].filter(Boolean).join(' ');
      return [
        s('add_door_no'),
        ...s('add_street').split(/\s*,\s*/),
        s('add_area'),
        [s('add_city'), s('add_pin_code') && `- ${s('add_pin_code')}`].filter(Boolean).join(' '),
        stateLine,
      ].filter(Boolean);
    } catch {
      /* fall through to plain text */
    }
  }
  return text.split(/\r?\n|,\s*/).map((l) => l.trim()).filter(Boolean);
}


const inr = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function termsToLines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);
}

/** Client-side PO PDF for the supplier portal, used when no stored PDF exists. */
export function buildSupplierPOPdf(po: SupplierPODetail, items: SupplierPOItem[]): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Purchase Order - ${po.po_no}` });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PURCHASE ORDER', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(po.com_name ?? '', 14, 22);
  doc.setFont('helvetica', 'bold');
  doc.text(po.po_no, pageW - 14, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(po.po_date)}`, pageW - 14, 22, { align: 'right' });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  const fact = (label: string, value: string, x: number, y: number) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, x, y);
    doc.setFont('helvetica', 'normal'); doc.text((doc.splitTextToSize(value || '-', 85) as string[]), x, y + 5);
  };
  fact('Supplier', po.vendor_name ?? '-', 14, 42);
  fact('Required By', formatDate(po.required_date), 110, 42);
  fact('Purpose', po.purpose ?? '-', 14, 56);

  autoTable(doc, {
    startY: 70,
    head: [['#', 'Item', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: items.map((it, i) => [
      String(i + 1),
      it.specification ? `${it.prod_name}\n${it.specification}` : it.prod_name,
      String(it.ordered_qty),
      it.unit_name || '-',
      inr(it.unit_price),
      inr(it.total_amount),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });
  const tdoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  let y = (tdoc.lastAutoTable?.finalY ?? 80) + 8;

  const total = items.reduce((s, it) => s + Number(it.total_amount ?? 0), 0);
  doc.setFillColor(79, 70, 229);
  doc.rect(pageW - 82, y - 5, 68, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total', pageW - 80, y);
  doc.text(`Rs. ${inr(total)}`, pageW - 16, y, { align: 'right' });
  doc.setTextColor(30, 30, 30);
  y += 14;

  const ensure = (h: number) => { if (y + h > pageH - 15) { doc.addPage(); y = 18; } };
  const title = (t: string) => {
    ensure(14);
    doc.setFillColor(238, 242, 255);
    doc.rect(14, y - 5, 182, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(79, 70, 229);
    doc.text(t, 16, y);
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    y += 7;
  };

  const addr = addressToLines(po.delivery_address);
  if (addr.length) {
    title('Delivery Address');
    addr.forEach((l) => { ensure(5); doc.text(l, 16, y); y += 4.5; });
    y += 5;
  }
  const terms = termsToLines(po.terms_conditions);
  if (terms.length) {
    title('Terms & Conditions');
    terms.forEach((t, i) => {
      const w = doc.splitTextToSize(t, 170) as string[];
      ensure(w.length * 4.5 + 1);
      doc.text(`${i + 1}.`, 16, y);
      doc.text(w, 23, y);
      y += w.length * 4.5 + 1.5;
    });
  }
  return doc;
}
