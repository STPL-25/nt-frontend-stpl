import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import axios from 'axios';
import { grnSvcGetGRNApprovals, grnSvcGetGRNsByPO } from '@/Services/GrnService/grnApi';

const NAVY: [number, number, number] = [30, 58, 95];
const MUTED: [number, number, number] = [107, 114, 128];

type AnyRecord = Record<string, any>;

const text = (v: unknown) => (v == null || v === '' ? '-' : String(v));
const num = (v: unknown) => (v == null || v === '' ? '-' : String(Number(v)));

function parseItems(raw: unknown): AnyRecord[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

/** Builds the Goods Receipt Note PDF from a GRN row (with items) and its approval history. */
export function buildGRNPdf(grn: AnyRecord, history: AnyRecord[] = []): { doc: jsPDF; fileName: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 12;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold').setFontSize(15);
  doc.text('GOODS RECEIPT NOTE', margin, 13);
  doc.setFontSize(10).setFont('helvetica', 'normal');
  doc.text(text(grn.grn_no), 210 - margin, 13, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    startY: 26,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 32 }, 2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 32 } },
    body: [
      ['PO No', text(grn.po_no), 'Supplier', text(grn.vendor_name)],
      ['Received date', text(grn.received_date), 'Gate entry', text(grn.gate_entry_no)],
      ['Invoice / Doc ref', text(grn.doc_ref_no), 'Challan no', text(grn.challan_no)],
      ['Vehicle no', text(grn.vehicle_no), 'Received by', text(grn.received_by_name ?? grn.received_by)],
      ['Status', text(grn.status), 'Approved on', text(grn.approved_at ? String(grn.approved_at) : '')],
    ],
  });

  const items = parseItems(grn.items);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head: [['#', 'Item', 'HSN', 'Ordered', 'Received', 'Rejected', 'Unit', 'Condition', 'Location']],
    body: items.map((it, i) => [
      i + 1, text(it.prod_name), text(it.hsn_code), num(it.ordered_qty), num(it.received_qty),
      num(it.rejected_qty), text(it.unit_name), text(it.condition), text(it.warehouse_location_name),
    ]),
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8.5 },
  });

  if (grn.remarks) {
    const y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(9).setFont('helvetica', 'bold').text('Remarks', margin, y);
    doc.setFont('helvetica', 'normal').text(doc.splitTextToSize(String(grn.remarks), 186), margin, y + 5);
  }

  if (history.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + (grn.remarks ? 18 : 8),
      head: [['Approval trail', 'By', 'When', 'Comment']],
      body: history.map(h => [text(h.action_type), text(h.status_by), text(h.created_at), text(h.comment)]),
      headStyles: { fillColor: NAVY },
      styles: { fontSize: 8.5 },
    });
  }

  return { doc, fileName: `${String(grn.grn_no ?? 'GRN')}.pdf` };
}

/** Loads a GRN's items + approval trail and downloads its PDF. Best-effort: failures are logged. */
export async function downloadGRNPdf(grn_basic_sno: number, po_basic_sno: number): Promise<void> {
  try {
    const [byPo, appr] = await Promise.all([
      axios.get(grnSvcGetGRNsByPO(po_basic_sno)),
      axios.get(grnSvcGetGRNApprovals({ grn_basic_sno })),
    ]);
    const row = (byPo.data?.data ?? []).find((g: AnyRecord) => g.grn_basic_sno === grn_basic_sno);
    if (!row) return;
    const history: AnyRecord[] = appr.data?.data?.history ?? [];
    const approved_at = [...history].reverse().find(h => h.action_type === 'APPROVED' || h.action_type === 'AUTO_APPROVED')?.created_at;
    const { doc, fileName } = buildGRNPdf({ ...row, approved_at }, history);
    doc.save(fileName);
  } catch (error) {
    console.error('Unable to generate the GRN PDF:', error);
  }
}
