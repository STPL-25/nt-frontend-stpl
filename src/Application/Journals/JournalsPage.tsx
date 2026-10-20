import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BookOpen, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/CustomComponent/PageComponents';
import { getErrorMessage } from '@/lib/errors';
import { grnSvcJournals, type JournalLine } from '@/Services/GrnService/grnApi';

const money = (n: number) => Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Journal {
  journal_sno: number; journal_no: string; journal_date: string; source_type: string; narration: string | null;
  status: string; lines: JournalLine[]; hasSuspense: boolean; total: number;
}

const SOURCE_LABEL: Record<string, string> = {
  GRN: 'GRN', INVOICE: 'Invoice', PAYMENT: 'Payment', ADVANCE: 'Advance', INVOICE_ITC: 'ITC reversal',
};

/** Accounts: every journal the system has posted, plus the ones parked in Suspense waiting for an account head. */
const JournalsPage: React.FC = () => {
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(grnSvcJournals);
      setLines(res.data?.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load journals'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const journals = useMemo<Journal[]>(() => {
    const map = new Map<number, Journal>();
    for (const l of lines) {
      let j = map.get(l.journal_sno);
      if (!j) {
        j = {
          journal_sno: l.journal_sno, journal_no: l.journal_no, journal_date: l.journal_date, source_type: l.source_type,
          narration: l.narration, status: l.status, lines: [], hasSuspense: false, total: 0,
        };
        map.set(l.journal_sno, j);
      }
      j.lines.push(l);
      j.total += Number(l.debit);
      if (l.is_suspense) j.hasSuspense = true;
    }
    return [...map.values()].sort((a, b) => b.journal_sno - a.journal_sno);
  }, [lines]);

  const suspense = journals.filter((j) => j.hasSuspense);
  const suspenseTotal = suspense.reduce((s, j) => s + j.lines.filter((l) => l.is_suspense).reduce((a, l) => a + Number(l.debit), 0), 0);

  const table = (list: Journal[]) => (
    <div className="border rounded-xl overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs">Journal</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Source</TableHead>
            <TableHead className="text-xs">Narration</TableHead>
            <TableHead className="text-xs">Account</TableHead>
            <TableHead className="text-xs text-right">Debit</TableHead>
            <TableHead className="text-xs text-right">Credit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.flatMap((j) => j.lines.map((l, i) => (
            <TableRow key={l.line_sno} className={i === 0 ? 'border-t-2' : ''}>
              <TableCell className="text-xs font-medium">{i === 0 ? j.journal_no : ''}</TableCell>
              <TableCell className="text-xs">{i === 0 ? j.journal_date : ''}</TableCell>
              <TableCell className="text-xs">
                {i === 0 && <Badge variant="secondary" className="text-[10px]">{SOURCE_LABEL[j.source_type] ?? j.source_type}</Badge>}
              </TableCell>
              <TableCell className="text-xs">{i === 0 ? j.narration : ''}</TableCell>
              <TableCell className={`text-xs ${Number(l.credit) > 0 ? 'pl-6' : ''}`}>
                {l.head_name}
                {l.is_suspense && <Badge variant="destructive" className="ml-2 text-[10px]">Suspense</Badge>}
              </TableCell>
              <TableCell className="text-xs text-right">{Number(l.debit) > 0 ? money(l.debit) : ''}</TableCell>
              <TableCell className="text-xs text-right">{Number(l.credit) > 0 ? money(l.credit) : ''}</TableCell>
            </TableRow>
          )))}
        </TableBody>
      </Table>
    </div>
  );

  const empty = (text: string) => (
    <div className="text-center py-10 text-muted-foreground border rounded-xl bg-muted/10">
      <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm">{text}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-muted/30 min-h-full">
      <PageHeader icon={BookOpen} title="Journals" description="Entries posted from GRNs, invoices and payments; Suspense = the product has no account head yet">
        <Button
          variant="outline" size="sm"
          className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={fetchAll} disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'mr-1 animate-spin' : 'mr-1'} /> Refresh
        </Button>
      </PageHeader>

      <div className="container mx-auto py-6 px-4">
        <Card className="shadow-md">
          <CardContent className="pt-6 space-y-4">
            <Tabs defaultValue="suspense">
              <TabsList className="mb-3 flex h-auto flex-wrap justify-start">
                <TabsTrigger value="suspense">
                  In Suspense
                  <Badge variant={suspense.length ? 'destructive' : 'secondary'} className="ml-2 text-xs">{suspense.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="all">
                  All journals<Badge variant="secondary" className="ml-2 text-xs">{journals.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="suspense" className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  These GRN values were booked to Suspense because the product (and its sub-category) has no account head. Set the head on
                  Masters &gt; Product; GRNs approved after that post to it. Total in Suspense:{' '}
                  <span className="font-semibold text-red-600">₹{money(suspenseTotal)}</span>
                </p>
                {suspense.length ? table(suspense) : empty('Nothing in Suspense')}
              </TabsContent>

              <TabsContent value="all">
                {journals.length ? table(journals) : empty('No journals posted yet')}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JournalsPage;
