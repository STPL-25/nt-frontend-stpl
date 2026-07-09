// import { jsPDF } from 'jspdf';
// import { autoTable } from 'jspdf-autotable';

// type AnyRecord = Record<string, unknown>;

// type DetailRow = {
//   label: string;
//   value: string;
// };

// const PAGE_WIDTH = 210;
// const PAGE_HEIGHT = 297;
// const PAGE_MARGIN = 12;
// const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);
// const NAVY: [number, number, number] = [30, 58, 95];
// const MUTED: [number, number, number] = [107, 114, 128];
// const BORDER: [number, number, number] = [209, 213, 219];
// const LIGHT_BG: [number, number, number] = [248, 250, 252];

// function parseJSON<T>(raw: unknown, fallback: T): T {
//   if (raw == null || raw === '') return fallback;
//   if (typeof raw !== 'string') return raw as T;
//   try {
//     return JSON.parse(raw) as T;
//   } catch {
//     return fallback;
//   }
// }

// function toNumber(value: unknown): number {
//   const parsed = Number.parseFloat(String(value ?? 0));
//   return Number.isFinite(parsed) ? parsed : 0;
// }

// function firstValue(records: AnyRecord[], keys: string[]): unknown {
//   for (const record of records) {
//     for (const key of keys) {
//       const value = record[key];
//       if (value != null && String(value).trim() !== '') return value;
//     }
//   }
//   return '';
// }

// function formatAddressValue(value: unknown): string {
//   if (value == null || value === '') return '';

//   let parsed: unknown = value;
//   if (typeof value === 'string') {
//     try {
//       parsed = JSON.parse(value) as unknown;
//     } catch {
//       return value.trim();
//     }
//   }

//   if (Array.isArray(parsed)) {
//     const addresses = parsed.filter(
//       (address): address is AnyRecord => Boolean(address) && typeof address === 'object',
//     );
//     const primary = addresses.find((address) => {
//       const type = String(address.address_type ?? '').toUpperCase();
//       return type === 'PRIMARY' || type === 'BILLING' || type === 'REGISTERED';
//     }) ?? addresses[0];
//     return primary ? formatAddressValue(primary) : '';
//   }

//   if (typeof parsed !== 'object' || parsed == null) return String(parsed).trim();

//   const address = parsed as AnyRecord;
//   const fullAddress = firstValue([address], [
//     'full_address',
//     'address',
//     'address_text',
//     'formatted_address',
//   ]);
//   if (fullAddress) return formatAddressValue(fullAddress);

//   const gstNo = firstValue([address], ['add_gst', 'gst_no', 'gstin']);
//   const doorNo = address.door_no
//     ?? address.building_no
//     ?? address.add_door_no
//     ?? address.add_reg_door_no;

//   return [
//     String(doorNo ?? '').trim() === String(gstNo ?? '').trim() ? '' : doorNo,
//     address.address_line_1 ?? address.address_line1,
//     address.address_line_2 ?? address.address_line2,
//     address.street ?? address.add_street ?? address.add_reg_street,
//     address.area ?? address.locality,
//     address.city ?? address.add_city ?? address.add_reg_city,
//     address.taluk ?? address.district,
//     address.state ?? address.add_state ?? address.add_reg_state,
//     address.country,
//     address.pincode
//       ?? address.pin_code
//       ?? address.postal_code
//       ?? address.add_pin_code
//       ?? address.add_reg_pincode,
//   ].filter((part) => part != null && String(part).trim() !== '').join(', ');
// }

// function addressField(value: unknown, keys: string[]): unknown {
//   if (value == null || value === '') return '';
//   const parsed = typeof value === 'string'
//     ? parseJSON<unknown>(value, value)
//     : value;

//   if (Array.isArray(parsed)) {
//     for (const item of parsed) {
//       const found = addressField(item, keys);
//       if (found != null && String(found).trim() !== '') return found;
//     }
//     return '';
//   }

//   if (typeof parsed !== 'object' || parsed == null) return '';
//   return firstValue([parsed as AnyRecord], keys);
// }

// function companyAddressValue(pr: AnyRecord, poHeader: AnyRecord): unknown {
//   return firstValue([poHeader, pr], [
//     'com_address',
//     'company_address',
//     'com_full_address',
//   ]);
// }

// function branchAddressValue(pr: AnyRecord, poHeader: AnyRecord): unknown {
//   return firstValue([poHeader, pr], [
//     'brn_address',
//     'branch_address',
//     'brn_full_address',
//     'delivery_address',
//   ]);
// }

// function formatCompanyAddress(pr: AnyRecord, poHeader: AnyRecord): string {
//   const formatted = formatAddressValue(companyAddressValue(pr, poHeader));
//   if (formatted) return formatted;

//   return [
//     poHeader.com_door_no ?? pr.com_door_no,
//     poHeader.com_street ?? pr.com_street,
//     poHeader.com_area ?? pr.com_area,
//     poHeader.com_city ?? pr.com_city,
//     poHeader.com_state ?? pr.com_state,
//     poHeader.com_pincode ?? pr.com_pincode,
//   ].filter(Boolean).join(', ');
// }

// function formatBranchAddress(pr: AnyRecord, poHeader: AnyRecord): string {
//   const formatted = formatAddressValue(branchAddressValue(pr, poHeader));
//   if (formatted) return formatted;

//   return [
//     poHeader.brn_door_no ?? poHeader.branch_door_no ?? pr.brn_door_no ?? pr.branch_door_no,
//     poHeader.brn_street ?? poHeader.branch_street ?? pr.brn_street ?? pr.branch_street,
//     poHeader.brn_area ?? poHeader.branch_area ?? pr.brn_area ?? pr.branch_area,
//     poHeader.brn_city ?? poHeader.branch_city ?? pr.brn_city ?? pr.branch_city,
//     poHeader.brn_state ?? poHeader.branch_state ?? pr.brn_state ?? pr.branch_state,
//     poHeader.brn_pincode ?? poHeader.branch_pincode ?? pr.brn_pincode ?? pr.branch_pincode,
//   ].filter(Boolean).join(', ');
// }

// function formatVendorAddress(vendor: AnyRecord, quotation: AnyRecord): string {
//   return formatAddressValue(firstValue([vendor, quotation], [
//     'vendor_address',
//     'kyc_address',
//     'address',
//   ]));
// }

// function formatDate(value?: unknown): string {
//   if (!value) return '-';
//   const stringValue = String(value);
//   const date = new Date(stringValue);
//   if (Number.isNaN(date.getTime())) return stringValue;
//   return date.toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//   });
// }

// function formatMoney(value: number): string {
//   return `INR ${value.toLocaleString('en-IN', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function formatQuantity(value: unknown): string {
//   return toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
// }

// function itemUnitPrice(item: AnyRecord): number {
//   return toNumber(item.agreed_unit_price ?? item.unit_price);
// }

// function itemBase(item: AnyRecord): number {
//   return toNumber(item.qty) * itemUnitPrice(item);
// }

// function itemDiscount(item: AnyRecord): number {
//   return itemBase(item) * (toNumber(item.discount_pct) / 100);
// }

// function calculatedTotalCost(item: AnyRecord): number {
//   return itemBase(item) - itemDiscount(item);
// }

// function itemTotalCost(item: AnyRecord): number {
//   return item.total_cost != null
//     ? toNumber(item.total_cost)
//     : calculatedTotalCost(item);
// }

// function itemNetCost(item: AnyRecord): number {
//   if (item.net_cost != null) return toNumber(item.net_cost);
//   if (item.total_amount != null) return toNumber(item.total_amount);
//   return itemTotalCost(item) * (1 + (toNumber(item.tax_pct) / 100));
// }

// function itemTaxValue(item: AnyRecord): number {
//   return Math.max(0, itemNetCost(item) - itemTotalCost(item));
// }

// function cleanFileName(value: string): string {
//   const cleaned = value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
//   return cleaned || 'Purchase-Order';
// }

// function detailBoxHeight(doc: jsPDF, rows: DetailRow[], boxWidth: number): number {
//   const valueWidth = boxWidth - 31;
//   const contentHeight = rows.reduce((height, row) => {
//     const lines = doc.splitTextToSize(row.value || '-', valueWidth) as string[];
//     return height + Math.max(4.5, lines.length * 3.5);
//   }, 0);
//   return Math.max(30, 14 + contentHeight);
// }

// function drawDetailBox(
//   doc: jsPDF,
//   x: number,
//   y: number,
//   width: number,
//   height: number,
//   title: string,
//   rows: DetailRow[],
// ): void {
//   doc.setFillColor(...LIGHT_BG);
//   doc.setDrawColor(...BORDER);
//   doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(8);
//   doc.setTextColor(...NAVY);
//   doc.text(title.toUpperCase(), x + 3, y + 5.5);
//   doc.setDrawColor(229, 231, 235);
//   doc.line(x + 3, y + 8, x + width - 3, y + 8);

//   let cursorY = y + 13;
//   const valueWidth = width - 31;
//   for (const row of rows) {
//     const lines = doc.splitTextToSize(row.value || '-', valueWidth) as string[];
//     doc.setFont('helvetica', 'normal');
//     doc.setFontSize(7.5);
//     doc.setTextColor(...MUTED);
//     doc.text(row.label, x + 3, cursorY);
//     doc.setFont('helvetica', 'bold');
//     doc.setTextColor(17, 24, 39);
//     doc.text(lines, x + 27, cursorY);
//     cursorY += Math.max(4.5, lines.length * 3.5);
//   }
// }

// function drawHeader(
//   doc: jsPDF,
//   companyName: string,
//   companyAddress: string,
//   companyGstNo: string,
//   poNo: string,
//   poDate: unknown,
//   logoDataUrl?: string,
// ): number {
//   const startY = 12;
//   let cursorY = startY;

//   if (logoDataUrl) {
//     try {
//       const properties = doc.getImageProperties(logoDataUrl);
//       const maxWidth = 42;
//       const maxHeight = 17;
//       const ratio = properties.width / properties.height;
//       const width = Math.min(maxWidth, maxHeight * ratio);
//       const height = width / ratio;
//       doc.addImage(logoDataUrl, PAGE_MARGIN, cursorY, width, height, undefined, 'FAST');
//       cursorY += height + 2.5;
//     } catch {
//       // The company text still identifies the issuer if the image is invalid.
//     }
//   }

//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(11);
//   doc.setTextColor(...NAVY);
//   doc.text(companyName, PAGE_MARGIN, cursorY);
//   cursorY += 4.5;

//   if (companyAddress) {
//     doc.setFont('helvetica', 'normal');
//     doc.setFontSize(7.5);
//     doc.setTextColor(55, 65, 81);
//     const addressLines = doc.splitTextToSize(companyAddress, 108) as string[];
//     doc.text(addressLines, PAGE_MARGIN, cursorY);
//     cursorY += addressLines.length * 3.3;
//   }

//   if (companyGstNo) {
//     doc.setFont('helvetica', 'bold');
//     doc.setFontSize(7.5);
//     doc.setTextColor(55, 65, 81);
//     doc.text(`GST No.: ${companyGstNo}`, PAGE_MARGIN, cursorY);
//     cursorY += 3.5;
//   }

//   const rightX = PAGE_WIDTH - PAGE_MARGIN;
//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(9);
//   doc.setTextColor(...MUTED);
//   doc.text('PURCHASE ORDER', rightX, startY + 1, { align: 'right' });
//   doc.setFontSize(14);
//   doc.setTextColor(...NAVY);
//   doc.text(poNo, rightX, startY + 7, { align: 'right' });
//   doc.setFont('helvetica', 'normal');
//   doc.setFontSize(8);
//   doc.setTextColor(75, 85, 99);
//   doc.text(`PO Date: ${formatDate(poDate)}`, rightX, startY + 12, { align: 'right' });

//   const headerBottom = Math.max(cursorY, startY + 17) + 3;
//   doc.setDrawColor(...NAVY);
//   doc.setLineWidth(0.8);
//   doc.line(PAGE_MARGIN, headerBottom, PAGE_WIDTH - PAGE_MARGIN, headerBottom);
//   return headerBottom + 5;
// }

// function addFooters(doc: jsPDF): void {
//   const pageCount = doc.getNumberOfPages();
//   const generatedOn = new Date().toLocaleString('en-IN');

//   for (let page = 1; page <= pageCount; page += 1) {
//     doc.setPage(page);
//     doc.setDrawColor(229, 231, 235);
//     doc.setLineWidth(0.2);
//     doc.line(PAGE_MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 12);
//     doc.setFont('helvetica', 'normal');
//     doc.setFontSize(7);
//     doc.setTextColor(156, 163, 175);
//     doc.text(`System-generated Purchase Order | Generated on ${generatedOn}`, PAGE_MARGIN, PAGE_HEIGHT - 8);
//     doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
//   }
// }

// function ensurePageSpace(doc: jsPDF, y: number, requiredHeight: number): number {
//   if (y + requiredHeight <= PAGE_HEIGHT - 17) return y;
//   doc.addPage();
//   return 15;
// }

// export function createPOApprovalPdfDocument(
//   pr: AnyRecord,
//   quotation: AnyRecord,
//   approvalData?: AnyRecord,
//   logoDataUrl?: string,
// ): { doc: jsPDF; fileName: string } {
//   const poHeader = parseJSON<AnyRecord>(approvalData?.po_header, {});
//   const vendor = parseJSON<AnyRecord>(approvalData?.vendor, {});
//   const approvedItems = parseJSON<AnyRecord[]>(approvalData?.po_items, []);
//   const quotationItems = parseJSON<AnyRecord[]>(
//     quotation?.quotation_item_details ?? quotation?.items,
//     [],
//   );
//   const items = Array.isArray(approvedItems) && approvedItems.length > 0
//     ? approvedItems
//     : Array.isArray(quotationItems) ? quotationItems : [];

//   const totalCost = items.reduce((sum, item) => sum + itemTotalCost(item), 0);
//   const grandTotal = items.reduce((sum, item) => sum + itemNetCost(item), 0);
//   const taxTotal = grandTotal - totalCost;

//   const poNo = String(poHeader.po_df_no
//     ?? approvalData?.po_no
//     ?? `PO-${String(pr?.pr_no ?? '').replace(/^PR-?/, '')}-${Date.now().toString().slice(-4)}`);
//   const poDate = poHeader.po_date ?? approvalData?.final_approved_on ?? new Date().toISOString();
//   const companyName = String(poHeader.com_name ?? pr?.com_name ?? 'Company Name');
//   const branchName = String(poHeader.brn_name ?? pr?.brn_name ?? '-');
//   const companyAddress = formatCompanyAddress(pr ?? {}, poHeader);
//   const branchAddress = formatBranchAddress(pr ?? {}, poHeader);
//   const vendorAddress = formatVendorAddress(vendor, quotation ?? {});
//   const vendorName = String(vendor.vendor_name ?? vendor.company_name ?? quotation?.company_name ?? '-');
//   const vendorGstNo = String(vendor.gst_no ?? quotation?.gst_no ?? '');
//   const rawCompanyAddress = companyAddressValue(pr ?? {}, poHeader);
//   const rawBranchAddress = branchAddressValue(pr ?? {}, poHeader);
//   const companyGstNo = String(firstValue([poHeader, pr ?? {}], [
//     'com_gst_no',
//     'company_gst_no',
//     'com_gstin',
//     'company_gstin',
//   ]) || addressField(rawCompanyAddress, ['add_gst', 'gst_no', 'gstin']));
//   const branchGstNo = String(firstValue([poHeader, pr ?? {}], [
//     'brn_gst_no',
//     'branch_gst_no',
//     'brn_gstin',
//     'branch_gstin',
//   ]) || addressField(rawBranchAddress, ['add_gst', 'gst_no', 'gstin']) || companyGstNo);

//   const doc = new jsPDF({
//     orientation: 'portrait',
//     unit: 'mm',
//     format: 'a4',
//     compress: true,
//   });
//   doc.setProperties({
//     title: `Purchase Order - ${poNo}`,
//     subject: 'Purchase Order',
//     author: companyName,
//     creator: 'Non-Trade Purchase Order System',
//   });

//   let cursorY = drawHeader(
//     doc,
//     companyName,
//     companyAddress,
//     companyGstNo,
//     poNo,
//     poDate,
//     logoDataUrl,
//   );

//   const boxGap = 6;
//   const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
//   const deliveryRows: DetailRow[] = [
//     { label: 'Branch', value: branchName },
//     { label: 'Address', value: branchAddress || '-' },
//     { label: 'GST No.', value: branchGstNo || '-' },
//   ];
//   const vendorRows: DetailRow[] = [
//     { label: 'Vendor', value: vendorName },
//     { label: 'Address', value: vendorAddress || '-' },
//     { label: 'GST No.', value: vendorGstNo || '-' },
//   ];
//   const boxHeight = Math.max(
//     detailBoxHeight(doc, deliveryRows, boxWidth),
//     detailBoxHeight(doc, vendorRows, boxWidth),
//   );
//   drawDetailBox(doc, PAGE_MARGIN, cursorY, boxWidth, boxHeight, 'Delivery Details', deliveryRows);
//   drawDetailBox(
//     doc,
//     PAGE_MARGIN + boxWidth + boxGap,
//     cursorY,
//     boxWidth,
//     boxHeight,
//     'Vendor Details',
//     vendorRows,
//   );
//   cursorY += boxHeight + 7;

//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(9);
//   doc.setTextColor(...NAVY);
//   doc.text('ITEMS ORDERED', PAGE_MARGIN, cursorY);
//   cursorY += 2;

//   const itemRows = items.map((item, index) => {
//     const itemDescription = [item.prod_name ?? item.item_name ?? '-', item.prod_code, item.specification]
//       .filter((value) => value != null && String(value).trim() !== '')
//       .map(String)
//       .join('\n');
//     return [
//       String(index + 1),
//       itemDescription,
//       formatQuantity(item.qty ?? item.quantity),
//       String(item.uom_name ?? item.unit_name ?? '-'),
//       formatMoney(itemUnitPrice(item)),
//       `${formatQuantity(item.discount_pct)}%\n${formatMoney(itemDiscount(item))}`,
//       `${formatQuantity(item.tax_pct)}%\n${formatMoney(itemTaxValue(item))}`,
//       formatMoney(itemTotalCost(item)),
//       formatMoney(itemNetCost(item)),
//     ];
//   });

//   autoTable(doc, {
//     startY: cursorY,
//     head: [[
//       '#',
//       'Item / Product',
//       'Qty',
//       'Unit',
//       'Unit Price',
//       'Discount',
//       'Tax',
//       'Total Cost',
//       'Net Cost',
//     ]],
//     body: itemRows.length > 0
//       ? itemRows
//       : [['', 'No items', '', '', '', '', '', '', '']],
//     theme: 'grid',
//     margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 18 },
//     styles: {
//       font: 'helvetica',
//       fontSize: 6.8,
//       cellPadding: 1.5,
//       lineColor: [229, 231, 235],
//       lineWidth: 0.15,
//       textColor: [31, 41, 55],
//       valign: 'middle',
//       overflow: 'linebreak',
//     },
//     headStyles: {
//       fillColor: NAVY,
//       textColor: [255, 255, 255],
//       fontStyle: 'bold',
//       fontSize: 6.4,
//       halign: 'left',
//     },
//     alternateRowStyles: { fillColor: [249, 250, 251] },
//     columnStyles: {
//       0: { cellWidth: 7, halign: 'center' },
//       1: { cellWidth: 42 },
//       2: { cellWidth: 11, halign: 'right' },
//       3: { cellWidth: 14 },
//       4: { cellWidth: 22, halign: 'right' },
//       5: { cellWidth: 20, halign: 'right' },
//       6: { cellWidth: 20, halign: 'right' },
//       7: { cellWidth: 24, halign: 'right' },
//       8: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
//     },
//   });

//   const tableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
//   cursorY = (tableDoc.lastAutoTable?.finalY ?? cursorY) + 7;
//   cursorY = ensurePageSpace(doc, cursorY, 25);

//   const totalsWidth = 70;
//   const totalsX = PAGE_WIDTH - PAGE_MARGIN - totalsWidth;
//   const totalRows = [
//     ['Total Cost', formatMoney(totalCost)],
//     ['Tax', formatMoney(taxTotal)],
//   ];
//   doc.setDrawColor(...BORDER);
//   doc.setLineWidth(0.2);
//   doc.rect(totalsX, cursorY, totalsWidth, 18, 'S');
//   totalRows.forEach(([label, value], index) => {
//     const rowY = cursorY + 4.5 + (index * 5);
//     doc.setFont('helvetica', 'normal');
//     doc.setFontSize(8);
//     doc.setTextColor(...MUTED);
//     doc.text(label, totalsX + 3, rowY);
//     doc.setTextColor(31, 41, 55);
//     doc.text(value, totalsX + totalsWidth - 3, rowY, { align: 'right' });
//   });
//   doc.setFillColor(...NAVY);
//   doc.rect(totalsX, cursorY + 12, totalsWidth, 8, 'F');
//   doc.setFont('helvetica', 'bold');
//   doc.setFontSize(9);
//   doc.setTextColor(255, 255, 255);
//   doc.text('Grand Total', totalsX + 3, cursorY + 17);
//   doc.text(formatMoney(grandTotal), totalsX + totalsWidth - 3, cursorY + 17, { align: 'right' });

//   addFooters(doc);
//   return { doc, fileName: `${cleanFileName(poNo)}.pdf` };
// }

// async function blobToDataUrl(blob: Blob): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = () => resolve(String(reader.result));
//     reader.onerror = () => reject(reader.error ?? new Error('Unable to read company logo'));
//     reader.readAsDataURL(blob);
//   });
// }

// async function loadLogoDataUrl(url: string): Promise<string | undefined> {
//   if (!url) return undefined;
//   if (url.startsWith('data:')) return url;

//   const controller = new AbortController();
//   const timeout = window.setTimeout(() => controller.abort(), 4000);
//   try {
//     const response = await fetch(url, { signal: controller.signal });
//     if (!response.ok) return undefined;
//     return await blobToDataUrl(await response.blob());
//   } catch {
//     return undefined;
//   } finally {
//     window.clearTimeout(timeout);
//   }
// }

// /**
//  * Creates and directly downloads the final approved Purchase Order as a PDF.
//  * API PO data is preferred, with the PR and quotation retained as fallbacks.
//  */
// export async function generatePOApprovalPdf(
//   pr: AnyRecord,
//   quotation: AnyRecord,
//   approvalData?: AnyRecord,
// ): Promise<void> {
//   try {
//     const poHeader = parseJSON<AnyRecord>(approvalData?.po_header, {});
//     const logoUrl = String(firstValue([poHeader, pr ?? {}], ['com_logo', 'company_logo']));
//     const logoDataUrl = await loadLogoDataUrl(logoUrl);
//     const { doc, fileName } = createPOApprovalPdfDocument(
//       pr,
//       quotation,
//       approvalData,
//       logoDataUrl,
//     );
//     doc.save(fileName);
//   } catch (error) {
//     console.error('Unable to generate Purchase Order PDF:', error);
//     alert('Unable to download the Purchase Order PDF. Please try again.');
//   }
// }
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

type AnyRecord = Record<string, unknown>;

type DetailRow = {
  label: string;
  value: string;
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const PAGE_MARGIN = 12;
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);
const NAVY: [number, number, number] = [30, 58, 95];
const ACCENT: [number, number, number] = [16, 118, 110];
const MUTED: [number, number, number] = [107, 114, 128];
const BORDER: [number, number, number] = [209, 213, 219];
const LIGHT_BG: [number, number, number] = [248, 250, 252];

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

function firstValue(records: AnyRecord[], keys: string[]): unknown {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (value != null && String(value).trim() !== '') return value;
    }
  }
  return '';
}

function formatAddressValue(value: unknown): string {
  if (value == null || value === '') return '';

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return value.trim();
    }
  }

  if (Array.isArray(parsed)) {
    const addresses = parsed.filter(
      (address): address is AnyRecord => Boolean(address) && typeof address === 'object',
    );
    const primary = addresses.find((address) => {
      const type = String(address.address_type ?? '').toUpperCase();
      return type === 'PRIMARY' || type === 'BILLING' || type === 'REGISTERED';
    }) ?? addresses[0];
    return primary ? formatAddressValue(primary) : '';
  }

  if (typeof parsed !== 'object' || parsed == null) return String(parsed).trim();

  const address = parsed as AnyRecord;
  const fullAddress = firstValue([address], [
    'full_address',
    'address',
    'address_text',
    'formatted_address',
  ]);
  if (fullAddress) return formatAddressValue(fullAddress);

  const gstNo = firstValue([address], ['add_gst', 'gst_no', 'gstin']);
  const doorNo = address.door_no
    ?? address.building_no
    ?? address.add_door_no
    ?? address.add_reg_door_no;

  return [
    String(doorNo ?? '').trim() === String(gstNo ?? '').trim() ? '' : doorNo,
    address.address_line_1 ?? address.address_line1,
    address.address_line_2 ?? address.address_line2,
    address.street ?? address.add_street ?? address.add_reg_street,
    address.area ?? address.locality,
    address.city ?? address.add_city ?? address.add_reg_city,
    address.taluk ?? address.district,
    address.state ?? address.add_state ?? address.add_reg_state,
    address.country,
    address.pincode
      ?? address.pin_code
      ?? address.postal_code
      ?? address.add_pin_code
      ?? address.add_reg_pincode,
  ].filter((part) => part != null && String(part).trim() !== '').join(', ');
}

function addressField(value: unknown, keys: string[]): unknown {
  if (value == null || value === '') return '';
  const parsed = typeof value === 'string'
    ? parseJSON<unknown>(value, value)
    : value;

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = addressField(item, keys);
      if (found != null && String(found).trim() !== '') return found;
    }
    return '';
  }

  if (typeof parsed !== 'object' || parsed == null) return '';
  return firstValue([parsed as AnyRecord], keys);
}

function companyAddressValue(pr: AnyRecord, poHeader: AnyRecord): unknown {
  return firstValue([poHeader, pr], [
    'com_address',
    'company_address',
    'com_full_address',
  ]);
}

function branchAddressValue(pr: AnyRecord, poHeader: AnyRecord): unknown {
  return firstValue([poHeader, pr], [
    'brn_address',
    'branch_address',
    'brn_full_address',
    'delivery_address',
  ]);
}

function formatCompanyAddress(pr: AnyRecord, poHeader: AnyRecord): string {
  const formatted = formatAddressValue(companyAddressValue(pr, poHeader));
  if (formatted) return formatted;

  return [
    poHeader.com_door_no ?? pr.com_door_no,
    poHeader.com_street ?? pr.com_street,
    poHeader.com_area ?? pr.com_area,
    poHeader.com_city ?? pr.com_city,
    poHeader.com_state ?? pr.com_state,
    poHeader.com_pincode ?? pr.com_pincode,
  ].filter(Boolean).join(', ');
}

function formatBranchAddress(pr: AnyRecord, poHeader: AnyRecord): string {
  const formatted = formatAddressValue(branchAddressValue(pr, poHeader));
  if (formatted) return formatted;

  return [
    poHeader.brn_door_no ?? poHeader.branch_door_no ?? pr.brn_door_no ?? pr.branch_door_no,
    poHeader.brn_street ?? poHeader.branch_street ?? pr.brn_street ?? pr.branch_street,
    poHeader.brn_area ?? poHeader.branch_area ?? pr.brn_area ?? pr.branch_area,
    poHeader.brn_city ?? poHeader.branch_city ?? pr.brn_city ?? pr.branch_city,
    poHeader.brn_state ?? poHeader.branch_state ?? pr.brn_state ?? pr.branch_state,
    poHeader.brn_pincode ?? poHeader.branch_pincode ?? pr.brn_pincode ?? pr.branch_pincode,
  ].filter(Boolean).join(', ');
}

function formatVendorAddress(vendor: AnyRecord, quotation: AnyRecord): string {
  return formatAddressValue(firstValue([vendor, quotation], [
    'vendor_address',
    'kyc_address',
    'address',
  ]));
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

function formatMoney(value: number): string {
  return `INR ${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQuantity(value: unknown): string {
  return toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
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

function cleanFileName(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  return cleaned || 'Purchase-Order';
}

function detailBoxHeight(doc: jsPDF, rows: DetailRow[], boxWidth: number): number {
  const valueWidth = boxWidth - 31;
  const contentHeight = rows.reduce((height, row) => {
    const lines = doc.splitTextToSize(row.value || '-', valueWidth) as string[];
    return height + Math.max(4.5, lines.length * 3.5);
  }, 0);
  return Math.max(30, 14 + contentHeight);
}

function drawDetailBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  rows: DetailRow[],
): void {
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(title.toUpperCase(), x + 3, y + 5.5);
  doc.setDrawColor(229, 231, 235);
  doc.line(x + 3, y + 8, x + width - 3, y + 8);

  let cursorY = y + 13;
  const valueWidth = width - 31;
  for (const row of rows) {
    const lines = doc.splitTextToSize(row.value || '-', valueWidth) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(row.label, x + 3, cursorY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(lines, x + 27, cursorY);
    cursorY += Math.max(4.5, lines.length * 3.5);
  }
}

function ensurePageSpace(doc: jsPDF, y: number, requiredHeight: number): number {
  if (y + requiredHeight <= PAGE_HEIGHT - 17) return y;
  doc.addPage();
  return 15;
}

function drawWatermark(doc: jsPDF, text: string): void {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(70);
    doc.setTextColor(...NAVY);
    doc.text(text, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
      align: 'center',
      angle: 35,
    });
    doc.restoreGraphicsState();
  }
}

function drawTermsBlock(doc: jsPDF, y: number, terms: string[]): number {
  const height = 8 + terms.length * 4;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, height, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('TERMS & CONDITIONS', PAGE_MARGIN + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(55, 65, 81);
  terms.forEach((line, i) => {
    doc.text(`\u2022 ${line}`, PAGE_MARGIN + 3, y + 9 + i * 4);
  });
  return y + height + 6;
}

function drawSignatureBlock(doc: jsPDF, y: number): number {
  const colWidth = CONTENT_WIDTH / 3;
  const labels = ['Prepared By', 'Checked By', 'Approved By'];
  doc.setDrawColor(...BORDER);
  labels.forEach((label, i) => {
    const x = PAGE_MARGIN + i * colWidth;
    doc.line(x + 5, y + 12, x + colWidth - 5, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 5, y + 16);
  });
  return y + 22;
}

function drawHeader(
  doc: jsPDF,
  companyName: string,
  companyAddress: string,
  companyGstNo: string,
  poNo: string,
  poDate: unknown,
  logoDataUrl?: string,
): number {
  const startY = 12;
  let cursorY = startY;

  if (logoDataUrl) {
    try {
      const properties = doc.getImageProperties(logoDataUrl);
      const maxWidth = 60;
      const maxHeight = 40;
      const ratio = properties.width / properties.height;
      const width = Math.min(maxWidth, maxHeight * ratio);
      const height = width / ratio;
      doc.addImage(logoDataUrl, PAGE_MARGIN, cursorY, width, height, undefined, 'FAST');
      cursorY += height + 2.5;
    } catch {
      // Company text still identifies the issuer if the image is invalid.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(companyName, PAGE_MARGIN, cursorY);
  cursorY += 4.5;

  if (companyAddress) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    const addressLines = doc.splitTextToSize(companyAddress, 108) as string[];
    doc.text(addressLines, PAGE_MARGIN, cursorY);
    cursorY += addressLines.length * 3.3;
  }

  if (companyGstNo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    doc.text(`GST No.: ${companyGstNo}`, PAGE_MARGIN, cursorY);
    cursorY += 3.5;
  }

  const rightX = PAGE_WIDTH - PAGE_MARGIN;
  doc.setFillColor(...ACCENT);
  doc.roundedRect(rightX - 55, startY - 2, 55, 15, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('PURCHASE ORDER', rightX - 2, startY + 3, { align: 'right' });
  doc.setFontSize(13);
  doc.text(poNo, rightX - 2, startY + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`PO Date: ${formatDate(poDate)}`, rightX - 2, startY + 12.5, { align: 'right' });

  const headerBottom = Math.max(cursorY, startY + 17) + 3;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(PAGE_MARGIN, headerBottom, PAGE_WIDTH - PAGE_MARGIN, headerBottom);
  return headerBottom + 5;
}

function addFooters(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const generatedOn = new Date().toLocaleString('en-IN');

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(`System-generated Purchase Order | Generated on ${generatedOn}`, PAGE_MARGIN, PAGE_HEIGHT - 8);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
  }
}

export function createPOApprovalPdfDocument(
  pr: AnyRecord,
  quotation: AnyRecord,
  approvalData?: AnyRecord,
  logoDataUrl?: string,
  terms: string[] = [
    'Payment Terms: As per agreed vendor contract.',
    'Delivery must be completed within the agreed lead time.',
    'This PO is valid for 30 days from the date of issue.',
  ],
): { doc: jsPDF; fileName: string } {
  const poHeader = parseJSON<AnyRecord>(approvalData?.po_header, {});
  const vendor = parseJSON<AnyRecord>(approvalData?.vendor, {});
  const approvedItems = parseJSON<AnyRecord[]>(approvalData?.po_items, []);
  const quotationItems = parseJSON<AnyRecord[]>(
    quotation?.quotation_item_details ?? quotation?.items,
    [],
  );
  const items = Array.isArray(approvedItems) && approvedItems.length > 0
    ? approvedItems
    : Array.isArray(quotationItems) ? quotationItems : [];

  const totalCost = items.reduce((sum, item) => sum + itemTotalCost(item), 0);
  const grandTotal = items.reduce((sum, item) => sum + itemNetCost(item), 0);
  const taxTotal = grandTotal - totalCost;
  const discountTotal = items.reduce((sum, item) => sum + itemDiscount(item), 0);

  const poNo = String(poHeader.po_df_no
    ?? approvalData?.po_no
    ?? `PO-${String(pr?.pr_no ?? '').replace(/^PR-?/, '')}-${Date.now().toString().slice(-4)}`);
  const poDate = poHeader.po_date ?? approvalData?.final_approved_on ?? new Date().toISOString();
  const companyName = String(poHeader.com_name ?? pr?.com_name ?? 'Company Name');
  const branchName = String(poHeader.brn_name ?? pr?.brn_name ?? '-');
  const companyAddress = formatCompanyAddress(pr ?? {}, poHeader);
  const branchAddress = formatBranchAddress(pr ?? {}, poHeader);
  const vendorAddress = formatVendorAddress(vendor, quotation ?? {});
  const vendorName = String(vendor.vendor_name ?? vendor.company_name ?? quotation?.company_name ?? '-');
  const vendorGstNo = String(vendor.gst_no ?? quotation?.gst_no ?? '');
  const rawCompanyAddress = companyAddressValue(pr ?? {}, poHeader);
  const rawBranchAddress = branchAddressValue(pr ?? {}, poHeader);
  const companyGstNo = String(firstValue([poHeader, pr ?? {}], [
    'com_gst_no',
    'company_gst_no',
    'com_gstin',
    'company_gstin',
  ]) || addressField(rawCompanyAddress, ['add_gst', 'gst_no', 'gstin']));
  const branchGstNo = String(firstValue([poHeader, pr ?? {}], [
    'brn_gst_no',
    'branch_gst_no',
    'brn_gstin',
    'branch_gstin',
  ]) || addressField(rawBranchAddress, ['add_gst', 'gst_no', 'gstin']) || companyGstNo);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  doc.setProperties({
    title: `Purchase Order - ${poNo}`,
    subject: 'Purchase Order',
    author: companyName,
    creator: 'Non-Trade Purchase Order System',
  });

  let cursorY = drawHeader(
    doc,
    companyName,
    companyAddress,
    companyGstNo,
    poNo,
    poDate,
    logoDataUrl,
  );

  const boxGap = 6;
  const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
  const deliveryRows: DetailRow[] = [
    { label: 'Branch', value: branchName },
    { label: 'Address', value: branchAddress || '-' },
    { label: 'GST No.', value: branchGstNo || '-' },
  ];
  const vendorRows: DetailRow[] = [
    { label: 'Vendor', value: vendorName },
    { label: 'Address', value: vendorAddress || '-' },
    { label: 'GST No.', value: vendorGstNo || '-' },
  ];
  const boxHeight = Math.max(
    detailBoxHeight(doc, deliveryRows, boxWidth),
    detailBoxHeight(doc, vendorRows, boxWidth),
  );
  cursorY = ensurePageSpace(doc, cursorY, boxHeight);
  drawDetailBox(doc, PAGE_MARGIN, cursorY, boxWidth, boxHeight, 'Delivery Details', deliveryRows);
  drawDetailBox(
    doc,
    PAGE_MARGIN + boxWidth + boxGap,
    cursorY,
    boxWidth,
    boxHeight,
    'Vendor Details',
    vendorRows,
  );
  cursorY += boxHeight + 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('ITEMS ORDERED', PAGE_MARGIN, cursorY);
  cursorY += 2;

  const itemRows = items.map((item, index) => {
    const itemDescription = [item.prod_name ?? item.item_name ?? '-', item.prod_code, item.specification]
      .filter((value) => value != null && String(value).trim() !== '')
      .map(String)
      .join('\n');
    return [
      String(index + 1),
      itemDescription,
      formatQuantity(item.qty ?? item.quantity),
      String(item.uom_name ?? item.unit_name ?? '-'),
      formatMoney(itemUnitPrice(item)),
      `${formatQuantity(item.discount_pct)}%\n${formatMoney(itemDiscount(item))}`,
      `${formatQuantity(item.tax_pct)}%\n${formatMoney(itemTaxValue(item))}`,
      formatMoney(itemTotalCost(item)),
      formatMoney(itemNetCost(item)),
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [[
      '#',
      'Item / Product',
      'Qty',
      'Unit',
      'Unit Price',
      'Discount',
      'Tax',
      'Total Cost',
      'Net Cost',
    ]],
    body: itemRows.length > 0
      ? itemRows
      : [['', 'No items', '', '', '', '', '', '', '']],
    theme: 'grid',
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 30 },
    styles: {
      font: 'helvetica',
      fontSize: 6.8,
      cellPadding: 1.5,
      lineColor: [229, 231, 235],
      lineWidth: 0.15,
      textColor: [31, 41, 55],
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.4,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 11, halign: 'right' },
      3: { cellWidth: 14 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
  });

  const tableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  cursorY = (tableDoc.lastAutoTable?.finalY ?? cursorY) + 7;
  cursorY = ensurePageSpace(doc, cursorY, 30);

  const totalsWidth = 78;
  const totalsX = PAGE_WIDTH - PAGE_MARGIN - totalsWidth;
  const totalRows = [
    ['Total Cost', formatMoney(totalCost)],
    ['Discount', `- ${formatMoney(discountTotal)}`],
    ['Tax', formatMoney(taxTotal)],
  ];
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(totalsX, cursorY, totalsWidth, 4.5 + totalRows.length * 5, 'S');
  totalRows.forEach(([label, value], index) => {
    const rowY = cursorY + 4.5 + (index * 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, totalsX + 3, rowY);
    doc.setTextColor(31, 41, 55);
    doc.text(value, totalsX + totalsWidth - 3, rowY, { align: 'right' });
  });
  const grandY = cursorY + 4.5 + totalRows.length * 5;
  doc.setFillColor(...ACCENT);
  doc.rect(totalsX, grandY, totalsWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Grand Total', totalsX + 3, grandY + 5.5);
  doc.text(formatMoney(grandTotal), totalsX + totalsWidth - 3, grandY + 5.5, { align: 'right' });

  cursorY = grandY + 14;
  cursorY = ensurePageSpace(doc, cursorY, 40);
  cursorY = drawTermsBlock(doc, cursorY, terms);
  cursorY = ensurePageSpace(doc, cursorY, 25);
  drawSignatureBlock(doc, cursorY);

  addFooters(doc);
  if (approvalData?.final_approved_on) drawWatermark(doc, 'APPROVED');

  return { doc, fileName: `${cleanFileName(poNo)}.pdf` };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read company logo'));
    reader.readAsDataURL(blob);
  });
}

async function loadLogoDataUrl(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return undefined;
    return await blobToDataUrl(await response.blob());
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Creates and directly downloads the final approved Purchase Order as a PDF.
 * API PO data is preferred, with the PR and quotation retained as fallbacks.
 */
export async function generatePOApprovalPdf(
  pr: AnyRecord,
  quotation: AnyRecord,
  approvalData?: AnyRecord,
): Promise<void> {
  try {
    const poHeader = parseJSON<AnyRecord>(approvalData?.po_header, {});
    const logoUrl = String(firstValue([poHeader, pr ?? {}], ['com_logo', 'company_logo']));
    const logoDataUrl = await loadLogoDataUrl(logoUrl);
    const { doc, fileName } = createPOApprovalPdfDocument(
      pr,
      quotation,
      approvalData,
      logoDataUrl,
    );
    doc.save(fileName);
  } catch (error) {
    console.error('Unable to generate Purchase Order PDF:', error);
    alert('Unable to download the Purchase Order PDF. Please try again.');
  }
}