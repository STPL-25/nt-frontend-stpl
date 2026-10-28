import React from 'react';
import { ArrowLeft, CheckCircle2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Callout, Panel } from '@/CustomComponent/ServiceComponents/ServiceParts';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { DispatchCreateResult } from '@/Services/SupplierService';

interface Props {
  result: DispatchCreateResult;
  onBack: () => void;
  onPrint: (delivery_sno: number) => void;
}

const SupplierDispatchSummary: React.FC<Props> = ({ result, onBack, onPrint }) => {
  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to purchase orders
      </Button>

      <Callout tone="success" icon={CheckCircle2}>Dispatch <b>{result.dispatch_slip_no}</b> was created.</Callout>

      <Panel icon={Printer} title="Delivery slips" description="Print a delivery slip for each shipment below - every LR gets its own printable paper." bodyClassName="p-0">
        <div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>LR No.</TableHead>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead className="text-right">Print</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.deliveries.map((d) => (
                  <TableRow key={d.delivery_sno}>
                    <TableCell className="font-medium">{d.lr_no ?? '— (Direct)'}</TableCell>
                    <TableCell>{d.invoice_no}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => onPrint(d.delivery_sno)}>
                        <Printer className="h-3.5 w-3.5" /> Print slip
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default SupplierDispatchSummary;
