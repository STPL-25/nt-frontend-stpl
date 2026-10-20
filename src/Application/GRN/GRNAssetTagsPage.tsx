import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { ChevronRight, Loader2, Package, Printer, QrCode, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SidebarDetailLayout from '@/LayoutComponent/SidebarDetailLayout';
import {
  DetailEmptyState, DetailHero, Panel, SearchInput, SelectableCard, StatusPill,
} from '@/CustomComponent/ServiceComponents/ServiceParts';
import { grnSvcAssetTagGRNs, grnSvcGenerateAssetTags, grnSvcAssetTagsPrinted } from '@/Services/GrnService/grnApi';
import { formatDate } from './GRN/helpers';

interface TagGRN {
  grn_basic_sno: number; grn_no: string; po_no?: string; vendor_name?: string; received_date?: string;
  item_count: number; unit_count: number; tag_count: number;
}
interface Tag {
  tag_code: string; grn_item_sno: number; unit_no: number; prod_name: string; specification?: string;
  unit_name?: string; hsn_code?: string; item_units: number; print_count: number;
  prod_code?: string; grn_date?: string; asset_branch?: string;
}

// The QR encodes only the short unique asset no (e.g. AST-00057-001): a small, low-density symbol that
// scans reliably on a small sticker label. Product details are looked up from the asset no when scanned.
const SIZES_CM = [1, 1.5, 2] as const;
const GAP_MM = 4;

const qrSvg = (text: string) => QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'L' });

/** Opens a print sheet with one square QR label per tag. */
async function printLabels(tags: Tag[], sizeCm: number) {
  const cells = (await Promise.all(tags.map(async t => `<div class="l">${await qrSvg(t.tag_code)}<div class="c">${t.tag_code}</div></div>`))).join('');
  const w = window.open('', '_blank');
  if (!w) { toast.error('Allow pop-ups to print the labels'); return false; }
  w.document.write(`<!doctype html><html><head><title>Asset tags</title><style>
    @page { size: A4; margin: 10mm; }
    body { margin: 0; }
    .sheet { display: flex; flex-wrap: wrap; gap: ${GAP_MM}mm; }
    .l { width: ${sizeCm + 0.6}cm; padding: 0.15cm 0.3cm; box-sizing: border-box; text-align: center; break-inside: avoid; }
    .l svg { width: ${sizeCm}cm; height: ${sizeCm}cm; display: block; margin: 0 auto; shape-rendering: crispEdges; }
    .c { margin-top: 0.1cm; font: 600 ${Math.max(5, Math.round(sizeCm * 4.5))}pt Arial, sans-serif; line-height: 1; white-space: nowrap; }
  </style></head><body><div class="sheet">${cells}</div>
  <script>var done=false;function go(){if(done)return;done=true;window.print();}window.onafterprint=function(){window.close();};window.onload=function(){setTimeout(go,200)}<\/script></body></html>`);
  w.document.close();
  return true;
}

/** Small on-screen preview of a tag's QR (the printed label shows the asset no below). */
const QrPreview: React.FC<{ code: string; size?: number }> = ({ code, size = 56 }) => {
  const [svg, setSvg] = useState('');
  useEffect(() => { qrSvg(code).then(setSvg).catch(() => setSvg('')); }, [code]);
  return <div style={{ width: size, height: size }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
};

/** After GRN approval: a unique QR tag for every received unit, printable as a sticker with the asset no below. */
const GRNAssetTagsPage: React.FC = () => {
  const [grns, setGrns] = useState<TagGRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [sizeCm, setSizeCm] = useState<number>(2);
  const [opened, setOpened] = useState<Tag | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(grnSvcAssetTagGRNs);
      setGrns(res.data?.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to load approved GRNs');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => grns.find(g => g.grn_basic_sno === selectedId) ?? null, [grns, selectedId]);

  // opening a GRN creates any missing tags (idempotent), so every unit always has its unique id
  useEffect(() => {
    setTags([]); setPicked(new Set()); setOpened(null);
    if (!selectedId) return;
    setTagsLoading(true);
    axios.post(grnSvcGenerateAssetTags, { grn_basic_sno: selectedId })
      .then(res => {
        const list: Tag[] = res.data?.data ?? [];
        setTags(list);
        setPicked(new Set());
        setGrns(prev => prev.map(g => g.grn_basic_sno === selectedId ? { ...g, tag_count: list.length } : g));
      })
      .catch(err => toast.error(err?.response?.data?.error ?? 'Failed to generate asset tags'))
      .finally(() => setTagsLoading(false));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return grns.filter(g => !q || [g.grn_no, g.po_no, g.vendor_name].some(v => (v ?? '').toLowerCase().includes(q)));
  }, [grns, search]);

  const byItem = useMemo(() => {
    const m = new Map<number, Tag[]>();
    tags.forEach(t => m.set(t.grn_item_sno, [...(m.get(t.grn_item_sno) ?? []), t]));
    return [...m.values()];
  }, [tags]);

  const unprinted = useMemo(() => tags.filter(t => t.print_count === 0), [tags]);

  const toggle = (codes: string[], on: boolean) =>
    setPicked(prev => { const n = new Set(prev); codes.forEach(c => (on ? n.add(c) : n.delete(c))); return n; });

  // Print-once: the server hands out each tag for printing a single time. We only print the codes it
  // returns, so a double click or a second attempt cannot produce another copy.
  const print = async (list: Tag[]) => {
    const fresh = list.filter(t => t.print_count === 0);
    if (fresh.length === 0 || printing) return;
    setPrinting(true);
    try {
      const res = await axios.post(grnSvcAssetTagsPrinted, { tag_codes: fresh.map(t => t.tag_code) });
      const claimed: string[] = res.data?.data?.claimed ?? [];
      if (claimed.length === 0) { toast.error('These labels were already printed'); return; }
      setTags(prev => prev.map(t => (claimed.includes(t.tag_code) ? { ...t, print_count: 1 } : t)));
      setPicked(prev => { const n = new Set(prev); claimed.forEach(c => n.delete(c)); return n; });
      await printLabels(fresh.filter(t => claimed.includes(t.tag_code)), sizeCm);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to print the labels');
    } finally {
      setPrinting(false);
    }
  };

  const detailContent = selected ? (
    <div className="space-y-4 px-3 py-4 sm:px-5">
      <DetailHero
        icon={QrCode}
        eyebrow="Asset tags"
        title={selected.grn_no}
        subtitle={selected.vendor_name}
        badges={<StatusPill tone="success">GRN approved</StatusPill>}
        metrics={[
          { label: 'PO', value: selected.po_no ?? '—', valueClassName: 'text-base @md:text-base' },
          { label: 'Items', value: selected.item_count },
          { label: 'Tags (units)', value: tags.length || selected.unit_count, accent: true },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Click a unit to see its QR. Each label can be printed only once. {picked.size} of {unprinted.length} unprinted selected.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sizeCm}
            onChange={e => setSizeCm(Number(e.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-xs"
            aria-label="Label size"
          >
            {SIZES_CM.map(c => <option key={c} value={c}>{c} cm label</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={unprinted.length === 0} onClick={() => toggle(unprinted.map(t => t.tag_code), picked.size !== unprinted.length)}>
            {picked.size === unprinted.length && unprinted.length > 0 ? 'Clear selection' : 'Select all unprinted'}
          </Button>
          <Button size="sm" disabled={picked.size === 0 || printing} onClick={() => print(tags.filter(t => picked.has(t.tag_code)))}>
            <Printer className="mr-1 h-4 w-4" /> Print {picked.size} label{picked.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      {opened && (
        <Panel
          icon={QrCode}
          title={`QR for ${opened.tag_code}`}
          action={
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" disabled={opened.print_count > 0 || printing} onClick={() => print([opened])}>
                <Printer className="mr-1 h-3.5 w-3.5" /> {opened.print_count > 0 ? 'Already printed' : 'Print this QR'}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpened(null)}>Close</Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-start gap-5">
            <QrPreview code={opened.tag_code} size={160} />
            <dl className="grid min-w-0 flex-1 grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[11px] uppercase text-muted-foreground">Product name</dt><dd className="font-semibold">{opened.prod_name}</dd></div>
              <div><dt className="text-[11px] uppercase text-muted-foreground">Product code</dt><dd className="font-semibold">{opened.prod_code ?? '—'}</dd></div>
              <div><dt className="text-[11px] uppercase text-muted-foreground">GRN date</dt><dd className="font-semibold">{formatDate(opened.grn_date)}</dd></div>
              <div><dt className="text-[11px] uppercase text-muted-foreground">Asset branch</dt><dd className="font-semibold">{opened.asset_branch ?? '—'}</dd></div>
              <div><dt className="text-[11px] uppercase text-muted-foreground">AST no</dt><dd className="font-mono font-semibold">{opened.tag_code}</dd></div>
              <div className="col-span-2 text-xs text-muted-foreground">The QR holds only the asset no; it is assigned to this product unit.</div>
            </dl>
          </div>
        </Panel>
      )}

      {tagsLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : tags.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No whole accepted units on this GRN, so there is nothing to tag.
        </p>
      ) : byItem.map(list => {
        const first = list[0];
        const codes = list.filter(t => t.print_count === 0).map(t => t.tag_code);
        const all = codes.length > 0 && codes.every(c => picked.has(c));
        return (
          <Panel
            key={first.grn_item_sno}
            icon={Package}
            title={`${first.prod_name} (${list.length} unit${list.length !== 1 ? 's' : ''})`}
            description={[first.specification, first.hsn_code ? `HSN ${first.hsn_code}` : ''].filter(Boolean).join(' · ') || undefined}
            action={
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={codes.length === 0} onClick={() => toggle(codes, !all)}>{all ? 'Deselect' : 'Select'} item</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={codes.length === 0 || printing} onClick={() => print(list)}>
                  <Printer className="mr-1 h-3.5 w-3.5" /> {codes.length === 0 ? 'Printed' : 'Print item'}
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 @md:grid-cols-3 @3xl:grid-cols-4">
              {list.map(t => (
                <div key={t.tag_code} className={cn('flex items-center gap-3 rounded-lg border p-2.5', picked.has(t.tag_code) && 'border-primary bg-primary/5')}>
                  <input type="checkbox" disabled={t.print_count > 0} checked={picked.has(t.tag_code)} onChange={e => toggle([t.tag_code], e.target.checked)} aria-label={`Select ${t.tag_code}`} />
                  <button type="button" onClick={() => setOpened(t)} className="min-w-0 flex-1 text-left text-xs hover:text-primary">
                    <span className="block font-mono font-semibold">{t.tag_code}</span>
                    <span className="block text-muted-foreground">Unit {t.unit_no} of {t.item_units} · click to create QR</span>
                    {t.print_count > 0 && <span className="block font-medium text-green-700">Printed - cannot be reprinted</span>}
                  </button>
                  <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  ) : null;

  return (
    <SidebarDetailLayout
      sidebarTitle="GRN Asset Tags"
      sidebarCount={grns.length}
      sidebarCountLabel="approved GRN"
      sidebarCountLabelPlural="approved GRNs"
      sidebarCountQualifier=""
      listItems={(closeSheet) => (
        <>
          <div className="sticky top-0 z-10 -mx-2 -mt-2 flex items-center gap-2 bg-white px-2 pb-2 pt-2 sm:-mx-3 sm:-mt-3 sm:px-3 sm:pt-3 dark:bg-slate-950">
            <SearchInput value={search} onChange={setSearch} placeholder="Search GRN, PO, supplier…" className="min-w-0 flex-1" />
            <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={load} disabled={loading} aria-label="Refresh list">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          {loading && grns.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{search ? 'No matches found' : 'No approved GRNs yet'}</p>
          ) : filtered.map(g => {
            const active = g.grn_basic_sno === selectedId;
            return (
              <SelectableCard key={g.grn_basic_sno} selected={active} onClick={() => { setSelectedId(g.grn_basic_sno); closeSheet(); }}>
                <span className="flex items-start justify-between gap-2">
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-semibold">{g.grn_no}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{g.vendor_name ?? '—'}</span>
                  </span>
                  <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', active ? 'translate-x-0.5 text-primary' : 'text-muted-foreground/60')} />
                </span>
                <span className="mt-2.5 block">
                  <StatusPill tone={g.tag_count >= g.unit_count && g.unit_count > 0 ? 'success' : 'neutral'}>
                    {g.tag_count > 0 ? `${g.tag_count} tags` : 'Tags not created'}
                  </StatusPill>
                </span>
                <span className="mt-3 block space-y-1 text-xs">
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">PO</span><span className="font-medium">{g.po_no ?? '—'}</span></span>
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">Units</span><span className="font-medium">{g.unit_count}</span></span>
                  <span className="flex justify-between gap-3"><span className="text-muted-foreground">Received</span><span className="font-medium">{formatDate(g.received_date)}</span></span>
                </span>
              </SelectableCard>
            );
          })}
        </>
      )}
      hasSelection={!!selected}
      detailContent={detailContent}
      emptyContent={
        <DetailEmptyState icon={QrCode} title="Select an approved GRN" description="Each received unit gets its own unique QR tag to print and stick on the product for asset management." />
      }
      mobileListLabel="Approved GRNs"
      mobileSelectionTitle={selected?.grn_no}
    />
  );
};

export default GRNAssetTagsPage;
