
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, User, Calendar, DollarSign, FileText, ArrowRight, Scale, Star, AlertCircle, TrendingDown, TrendingUp, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ApprovalScreenLayout from '@/LayoutComponent/ApprovalLayout/ApprovalScreenLayout';
import useFetch from '@/hooks/useFetchHook';
import { getPrRecords } from '@/Services/Api';
import App from '@/App';

interface PRItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  specification: string;
}

interface SupplierQuotationItem {
  itemId: string;
  unitPrice: number;
  totalPrice: number;
  leadTime: string;
  availability: 'In Stock' | 'On Order' | 'Custom';
  warranty?: string;
  specifications?: string;
}

interface SupplierQuotation {
  id: string;
  supplierName: string;
  supplierCode: string;
  quotationNumber: string;
  quotationDate: string;
  validUntil: string;
  paymentTerms: string;
  deliveryTerms: string;
  totalAmount: number;
  items: SupplierQuotationItem[];
  shippingCost: number;
  taxAmount: number;
  discount?: number;
  notes?: string;
  rating?: number;
  isRecommended?: boolean;
}

interface PRData {
  prNumber: string;
  requestor: string;
  department: string;
  requestDate: string;
  requiredDate: string;
  totalAmount: number;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Approved' | 'Rejected';
  description: string;
  items: PRItem[];
  attachments?: string[];
  quotations?: SupplierQuotation[];
  branch: string;
  createdBy: string;
}

// API Response Interface
interface APIPRItem {
  pr_no: string;
  reg_date: string;
  required_date: string;
  purpose: string;
  created_by: string;
  pr_item_sno: number;
  prod_sno: number;
  qty: number;
  est_cost: number;
  total_cost: number;
  brn_name: string;
  dept_name: string;
  priority_name: string;
  prod_name: string;
  uom_name: string;
  uom_code: string;
  BRANCH: string;
  dept: string;
  ename: string;
}

interface APIResponse {
  success: boolean;
  data: APIPRItem[];
}

// Transform API response to component format
const transformAPIResponse = (apiData: APIPRItem[]): PRData[] => {
  if (!apiData || apiData.length === 0) return [];

  // Group by PR number
  const groupedByPR = apiData.reduce((acc, item) => {
    if (!acc[item.pr_no]) {
      acc[item.pr_no] = [];
    }
    acc[item.pr_no].push(item);
    return acc;
  }, {} as Record<string, APIPRItem[]>);

  // Convert each group to PRData
  return Object.entries(groupedByPR).map(([prNumber, items]) => {
    const firstItem = items[0];
    
    // Transform items
    const prItems: PRItem[] = items.map(item => ({
      id: item.prod_sno.toString(),
      itemName: item.prod_name,
      quantity: item.qty,
      unit: item.uom_name,
      estimatedPrice: item.est_cost,
      specification: `${item.uom_code.trim()} - ${item.prod_name}`
    }));

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

    return {
      prNumber: prNumber,
      requestor: firstItem.ename,
      department: firstItem.dept_name,
      requestDate: firstItem.reg_date,
      requiredDate: firstItem.required_date,
      totalAmount: totalAmount,
      priority: firstItem.priority_name as 'High' | 'Medium' | 'Low',
      status: 'Pending',
      description: firstItem.purpose,
      items: prItems,
      branch: firstItem.BRANCH,
      createdBy: firstItem.created_by,
      attachments: [],
      quotations: []
    };
  });
};

const PRApprovalScreen: React.FC = () => {
  const [selectedPR, setSelectedPR] = useState<PRData | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<string | null>(null);
  const [prList, setPrList] = useState<PRData[]>([]);

  // Fetch PR records using custom hook
  const { data, loading: fetchLoading, error } = useFetch(getPrRecords);
  // Transform and set PR list when data changes
  useEffect(() => {
    if (data && !fetchLoading) {
      setPrList(data.data);
    }
  }, [data, fetchLoading]);

  const handlePRSelect = (pr: PRData) => {
    setSelectedPR(pr);
    setSelectedQuotation(null);
  };

  const handleAction = (action: string) => {
    setActionType(action as 'approve' | 'reject');
    setShowApprovalDialog(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const payload = {
      prNumber: selectedPR?.prNumber,
      action: actionType,
      comments,
      selectedQuotationId: selectedQuotation
    };
    
    try {
      // Make your API call here
      // await fetch('/api/pr-approval', { method: 'POST', body: JSON.stringify(payload) });
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Approval payload:', payload);
    } catch (error) {
      console.error('Error submitting approval:', error);
    } finally {
      setLoading(false);
      setShowApprovalDialog(false);
      setComments('');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium': return 'default';
      case 'Low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
      case 'Approved': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
      case 'Rejected': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLowestPrice = () => {
    if (!selectedPR?.quotations || selectedPR.quotations.length === 0) return null;
    return Math.min(...selectedPR.quotations.map(q => q.totalAmount));
  };

  const getBestValue = (quotation: SupplierQuotation) => {
    const lowestPrice = getLowestPrice();
    if (!lowestPrice) return false;
    return quotation.totalAmount === lowestPrice;
  };

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400">
            Error Loading Data
          </h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  // Handle loading state
  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Clock className="h-16 w-16 text-slate-300 dark:text-slate-700 mx-auto animate-spin" />
          <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400">
            Loading Purchase Requisitions...
          </h3>
        </div>
      </div>
    );
  }

  return (
    <>
    <ApprovalScreenLayout 
      approvalName="Purchase Requisitions"
      prList={prList}
      selectedPR={selectedPR}
      handlePRSelect={handlePRSelect}
      handleAction={handleAction}
      showApprovalDialog={showApprovalDialog}
      setShowApprovalDialog={setShowApprovalDialog}
      action={actionType}
      comments={comments}
      setComments={setComments}
      handleSubmit={handleSubmit}
      loading={loading}
      actionType={actionType}
    />
    </>
    //       <div className="p-4 border-b border-slate-200 dark:border-slate-800">
    //         <h2 className="text-lg font-bold">Purchase Requisitions</h2>
    //         <p className="text-sm text-slate-600 dark:text-slate-400">{prList.length} total requests</p>
    //       </div>

    //       <ScrollArea className="flex-1">
    //         <div className="p-2 space-y-2">
    //           {prList.map((pr) => (
    //             <Card
    //               key={pr.prNumber}
    //               className={`cursor-pointer transition-all hover:shadow-md ${
    //                 selectedPR?.prNumber === pr.prNumber
    //                   ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20'
    //                   : ''
    //               }`}
    //               onClick={() => handlePRSelect(pr)}
    //             >
    //               <CardContent className="p-3">
    //                 <div className="space-y-2">
    //                   <div className="flex items-start justify-between">
    //                     <div className="flex-1">
    //                       <p className="font-semibold text-sm">{pr.prNumber}</p>
    //                       <p className="text-xs text-slate-600 dark:text-slate-400">{pr.requestor}</p>
    //                     </div>
    //                     <ChevronRight className={`h-4 w-4 ${selectedPR?.prNumber === pr.prNumber ? 'text-blue-600' : 'text-slate-400'}`} />
    //                   </div>

    //                   <div className="flex flex-wrap gap-1">
    //                     <Badge variant={getPriorityColor(pr.priority)} className="text-xs">
    //                       {pr.priority}
    //                     </Badge>
    //                     <Badge className={`text-xs ${getStatusColor(pr.status)}`}>
    //                       {pr.status}
    //                     </Badge>
    //                   </div>

    //                   <div className="space-y-1">
    //                     <div className="flex justify-between text-xs">
    //                       <span className="text-slate-600 dark:text-slate-400">Department:</span>
    //                       <span className="font-medium">{pr.department}</span>
    //                     </div>
    //                     <div className="flex justify-between text-xs">
    //                       <span className="text-slate-600 dark:text-slate-400">Amount:</span>
    //                       <span className="font-semibold">₹{pr.totalAmount.toLocaleString('en-IN')}</span>
    //                     </div>
    //                     <div className="flex justify-between text-xs">
    //                       <span className="text-slate-600 dark:text-slate-400">Items:</span>
    //                       <span className="font-medium">{pr.items.length}</span>
    //                     </div>
    //                   </div>

    //                   <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2">
    //                     {pr.description}
    //                   </p>
    //                 </div>
    //               </CardContent>
    //             </Card>
    //           ))}
    //         </div>
    //       </ScrollArea>
    //     </div>

    //     {/* Right Side - PR Details */}
    //     <div className="flex-1 overflow-auto">
    //       {!selectedPR ? (
    //         <div className="flex items-center justify-center h-full">
    //           <div className="text-center space-y-3">
    //             <FileText className="h-16 w-16 text-slate-300 dark:text-slate-700 mx-auto" />
    //             <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400">
    //               No PR Selected
    //             </h3>
    //             <p className="text-sm text-slate-500 dark:text-slate-500">
    //               Select a purchase requisition from the left panel to view details
    //             </p>
    //           </div>
    //         </div>
    //       ) : (
    //         <div className="p-4 md:p-6 lg:p-8">
    //           <div className="mx-auto space-y-6">
    //             {/* Header */}
    //             <div className="flex items-center justify-between">
    //               <h1 className="text-3xl font-bold">PR Approval</h1>
    //               <Badge variant="outline" className="text-sm">
    //                 <Clock className="mr-1 h-4 w-4" />
    //                 Approval Pending
    //               </Badge>
    //             </div>

    //             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    //               {/* Main PR Details */}
    //               <div className="lg:col-span-2 space-y-6">
    //                 {/* PR Header Card */}
    //                 <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
    //                   <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
    //                     <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
    //                       <div className="flex-1">
    //                         <div className="flex items-center gap-3 flex-wrap">
    //                           <CardTitle className="text-2xl">
    //                             {selectedPR.prNumber}
    //                           </CardTitle>
    //                           <Badge variant={getPriorityColor(selectedPR.priority)}>
    //                             {selectedPR.priority} Priority
    //                           </Badge>
    //                           <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/20">
    //                             <Clock className="mr-1 h-3 w-3" />
    //                             {selectedPR.status}
    //                           </Badge>
    //                         </div>
    //                         <CardDescription className="mt-2 text-base">
    //                           {selectedPR.description}
    //                         </CardDescription>
    //                       </div>
    //                     </div>
    //                   </CardHeader>

    //                   <CardContent className="pt-6 space-y-6">
    //                     {/* Requestor Info */}
    //                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    //                       <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
    //                         <User className="h-5 w-5 text-blue-600 mt-0.5" />
    //                         <div>
    //                           <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
    //                             Requestor
    //                           </p>
    //                           <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
    //                             {selectedPR.requestor}
    //                           </p>
    //                           <p className="text-sm text-slate-600 dark:text-slate-400">
    //                             {selectedPR.department}
    //                           </p>
    //                         </div>
    //                       </div>

    //                       <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
    //                         <Calendar className="h-5 w-5 text-purple-600 mt-0.5" />
    //                         <div>
    //                           <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
    //                             Request Date
    //                           </p>
    //                           <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
    //                             {new Date(selectedPR.requestDate).toLocaleDateString('en-IN')}
    //                           </p>
    //                         </div>
    //                       </div>

    //                       <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
    //                         <Calendar className="h-5 w-5 text-orange-600 mt-0.5" />
    //                         <div>
    //                           <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
    //                             Required By
    //                           </p>
    //                           <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
    //                             {new Date(selectedPR.requiredDate).toLocaleDateString('en-IN')}
    //                           </p>
    //                         </div>
    //                       </div>

    //                       <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
    //                         <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
    //                         <div>
    //                           <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
    //                             Total Amount
    //                           </p>
    //                           <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
    //                             ₹{selectedPR.totalAmount.toLocaleString('en-IN')}
    //                           </p>
    //                         </div>
    //                       </div>
    //                     </div>

    //                     <Separator />

    //                     {/* Items Table */}
    //                     <div>
    //                       <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
    //                         <FileText className="h-5 w-5" />
    //                         Requested Items
    //                       </h3>
    //                       <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
    //                         <table className="w-full">
    //                           <thead className="bg-slate-100 dark:bg-slate-900">
    //                             <tr>
    //                               <th className="text-left p-3 text-sm font-semibold">Item Name</th>
    //                               <th className="text-left p-3 text-sm font-semibold">Specification</th>
    //                               <th className="text-right p-3 text-sm font-semibold">Quantity</th>
    //                               <th className="text-right p-3 text-sm font-semibold">Est. Price</th>
    //                               <th className="text-right p-3 text-sm font-semibold">Total</th>
    //                             </tr>
    //                           </thead>
    //                           <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
    //                             {selectedPR.items.map((item) => (
    //                               <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
    //                                 <td className="p-3 font-medium">{item.itemName}</td>
    //                                 <td className="p-3 text-sm text-slate-600 dark:text-slate-400">
    //                                   {item.specification}
    //                                 </td>
    //                                 <td className="p-3 text-right">
    //                                   {item.quantity} {item.unit}
    //                                 </td>
    //                                 <td className="p-3 text-right">
    //                                   ₹{item.estimatedPrice.toLocaleString('en-IN')}
    //                                 </td>
    //                                 <td className="p-3 text-right font-semibold">
    //                                   ₹{(item.quantity * item.estimatedPrice).toLocaleString('en-IN')}
    //                                 </td>
    //                               </tr>
    //                             ))}
    //                           </tbody>
    //                         </table>
    //                       </div>
    //                     </div>

    //                     {/* Quotations Summary - Only if quotations exist */}
    //                     {selectedPR.quotations && selectedPR.quotations.length > 0 && (
    //                       <div>
    //                         <div className="flex items-center justify-between mb-4">
    //                           <h3 className="text-lg font-semibold flex items-center gap-2">
    //                             <Scale className="h-5 w-5" />
    //                             Supplier Quotations ({selectedPR.quotations.length})
    //                           </h3>
    //                           <Button 
    //                             variant="outline" 
    //                             onClick={() => setShowComparisonDialog(true)}
    //                             className="gap-2"
    //                           >
    //                             <Scale className="h-4 w-4" />
    //                             Compare Quotations
    //                           </Button>
    //                         </div>
                            
    //                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    //                           {selectedPR.quotations.map((quotation) => (
    //                             <Card 
    //                               key={quotation.id} 
    //                               className={`cursor-pointer transition-all hover:shadow-md ${
    //                                 selectedQuotation === quotation.id 
    //                                   ? 'ring-2 ring-blue-500 shadow-md' 
    //                                   : ''
    //                               } ${quotation.isRecommended ? 'border-green-500' : ''}`}
    //                               onClick={() => setSelectedQuotation(quotation.id)}
    //                             >
    //                               <CardContent className="p-4">
    //                                 <div className="flex items-start justify-between mb-2">
    //                                   <div className="flex-1">
    //                                     <p className="font-semibold text-sm">{quotation.supplierName}</p>
    //                                     <p className="text-xs text-slate-600 dark:text-slate-400">
    //                                       {quotation.quotationNumber}
    //                                     </p>
    //                                   </div>
    //                                   {quotation.isRecommended && (
    //                                     <Badge variant="default" className="bg-green-600 text-xs">
    //                                       <Star className="h-3 w-3 mr-1" />
    //                                       Recommended
    //                                     </Badge>
    //                                   )}
    //                                   {getBestValue(quotation) && !quotation.isRecommended && (
    //                                     <Badge variant="default" className="bg-blue-600 text-xs">
    //                                       <TrendingDown className="h-3 w-3 mr-1" />
    //                                       Best Price
    //                                     </Badge>
    //                                   )}
    //                                 </div>
    //                                 <div className="space-y-2">
    //                                   <div className="flex justify-between items-center">
    //                                     <span className="text-xs text-slate-600 dark:text-slate-400">Total Amount</span>
    //                                     <span className="text-lg font-bold">
    //                                       ₹{quotation.totalAmount.toLocaleString('en-IN')}
    //                                     </span>
    //                                   </div>
    //                                   <div className="flex justify-between text-xs">
    //                                     <span className="text-slate-600 dark:text-slate-400">Delivery</span>
    //                                     <span className="font-medium">{quotation.deliveryTerms}</span>
    //                                   </div>
    //                                   <div className="flex justify-between text-xs">
    //                                     <span className="text-slate-600 dark:text-slate-400">Payment</span>
    //                                     <span className="font-medium">{quotation.paymentTerms}</span>
    //                                   </div>
    //                                   {quotation.rating && (
    //                                     <div className="flex items-center gap-1 text-xs">
    //                                       <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
    //                                       <span className="font-medium">{quotation.rating}/5</span>
    //                                     </div>
    //                                   )}
    //                                 </div>
    //                               </CardContent>
    //                             </Card>
    //                           ))}
    //                         </div>
    //                       </div>
    //                     )}

    //                     {/* Attachments */}
    //                     {selectedPR.attachments && selectedPR.attachments.length > 0 && (
    //                       <div>
    //                         <h3 className="text-sm font-semibold mb-2 text-slate-600 dark:text-slate-400">
    //                           Attachments
    //                         </h3>
    //                         <div className="flex flex-wrap gap-2">
    //                           {selectedPR.attachments.map((file, index) => (
    //                             <Badge key={index} variant="secondary" className="cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800">
    //                               <FileText className="mr-1 h-3 w-3" />
    //                               {file}
    //                             </Badge>
    //                           ))}
    //                         </div>
    //                       </div>
    //                     )}
    //                   </CardContent>
    //                 </Card>
    //               </div>

    //               {/* Action Panel */}
    //               <div className="lg:col-span-1">
    //                 <Card className="shadow-lg sticky top-6">
    //                   <CardHeader>
    //                     <CardTitle>Approval Actions</CardTitle>
    //                     <CardDescription>
    //                       Review the details and take action
    //                     </CardDescription>
    //                   </CardHeader>
    //                   <CardContent className="space-y-4">
    //                     {selectedPR.quotations && selectedPR.quotations.length > 0 && (
    //                       <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
    //                         <div className="flex items-start gap-2">
    //                           <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
    //                           <div className="text-sm">
    //                             <p className="font-medium text-blue-900 dark:text-blue-100">
    //                               Quotation Selection
    //                             </p>
    //                             <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
    //                               {selectedQuotation 
    //                                 ? 'Quotation selected for approval' 
    //                                 : 'Please select a quotation before approving'}
    //                             </p>
    //                           </div>
    //                         </div>
    //                       </div>
    //                     )}

    //                     <Button
    //                       onClick={() => handleAction('approve')}
    //                       className="w-full h-12 text-base bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
    //                       size="lg"
    //                       disabled={selectedPR.quotations && selectedPR.quotations.length > 0 && !selectedQuotation}
    //                     >
    //                       <CheckCircle2 className="mr-2 h-5 w-5" />
    //                       Approve Request
    //                     </Button>

    //                     <Button
    //                       onClick={() => handleAction('reject')}
    //                       variant="destructive"
    //                       className="w-full h-12 text-base"
    //                       size="lg"
    //                     >
    //                       <XCircle className="mr-2 h-5 w-5" />
    //                       Reject Request
    //                     </Button>

    //                     <Separator className="my-4" />

    //                     {/* Quick Info */}
    //                     <div className="space-y-3 text-sm">
    //                       <div className="flex justify-between">
    //                         <span className="text-slate-600 dark:text-slate-400">Status</span>
    //                         <Badge variant="outline">{selectedPR.status}</Badge>
    //                       </div>
    //                       <div className="flex justify-between">
    //                         <span className="text-slate-600 dark:text-slate-400">Items</span>
    //                         <span className="font-semibold">{selectedPR.items.length}</span>
    //                       </div>
    //                       <div className="flex justify-between">
    //                         <span className="text-slate-600 dark:text-slate-400">Department</span>
    //                         <span className="font-semibold">{selectedPR.department}</span>
    //                       </div>
    //                       <div className="flex justify-between">
    //                         <span className="text-slate-600 dark:text-slate-400">Branch</span>
    //                         <span className="font-semibold">{selectedPR.branch}</span>
    //                       </div>
    //                       {selectedPR.quotations && (
    //                         <div className="flex justify-between">
    //                           <span className="text-slate-600 dark:text-slate-400">Quotations</span>
    //                           <span className="font-semibold">{selectedPR.quotations.length}</span>
    //                         </div>
    //                       )}
    //                     </div>
    //                   </CardContent>
    //                 </Card>
    //               </div>
    //             </div>
    //           </div>
    //         </div>
    //       )}
    //     </div>
    //   </div>

    //   {/* Approval/Rejection Dialog */}
    //   <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
    //     <DialogContent className="sm:max-w-[500px]">
    //       <DialogHeader>
    //         <DialogTitle className="flex items-center gap-2">
    //           {actionType === 'approve' ? (
    //             <>
    //               <CheckCircle2 className="h-5 w-5 text-green-600" />
    //               Approve Purchase Requisition
    //             </>
    //           ) : (
    //             <>
    //               <XCircle className="h-5 w-5 text-red-600" />
    //               Reject Purchase Requisition
    //             </>
    //           )}
    //         </DialogTitle>
    //         <DialogDescription>
    //           {actionType === 'approve'
    //             ? 'Add any comments or notes for this approval.'
    //             : 'Please provide a reason for rejecting this request.'}
    //         </DialogDescription>
    //       </DialogHeader>

    //       <div className="space-y-4 py-4">
    //         {actionType === 'approve' && selectedQuotation && (
    //           <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
    //             <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
    //               Selected Quotation
    //             </p>
    //             <p className="text-sm text-green-700 dark:text-green-300">
    //               {selectedPR?.quotations?.find(q => q.id === selectedQuotation)?.supplierName}
    //             </p>
    //           </div>
    //         )}

    //         <div className="space-y-2">
    //           <Label htmlFor="comments">
    //             Comments {actionType === 'reject' && '(Required)'}
    //           </Label>
    //           <Textarea
    //             id="comments"
    //             placeholder={
    //               actionType === 'approve'
    //                 ? 'Enter any additional notes...'
    //                 : 'Explain the reason for rejection...'
    //             }
    //             value={comments}
    //             onChange={(e) => setComments(e.target.value)}
    //             rows={4}
    //             className="resize-none"
    //           />
    //         </div>

    //         <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2">
    //           <div className="flex justify-between text-sm">
    //             <span className="text-slate-600 dark:text-slate-400">PR Number</span>
    //             <span className="font-semibold">{selectedPR?.prNumber}</span>
    //           </div>
    //           <div className="flex justify-between text-sm">
    //             <span className="text-slate-600 dark:text-slate-400">Amount</span>
    //             <span className="font-semibold">₹{selectedPR?.totalAmount.toLocaleString('en-IN')}</span>
    //           </div>
    //         </div>
    //       </div>

    //       <DialogFooter>
    //         <Button
    //           variant="outline"
    //           onClick={() => setShowApprovalDialog(false)}
    //           disabled={loading}
    //         >
    //           Cancel
    //         </Button>
    //         <Button
    //           onClick={handleSubmit}
    //           disabled={loading || (actionType === 'reject' && !comments.trim())}
    //           className={
    //             actionType === 'approve'
    //               ? 'bg-green-600 hover:bg-green-700'
    //               : 'bg-red-600 hover:bg-red-700'
    //           }
    //         >
    //           {loading ? (
    //             <>Loading...</>
    //           ) : (
    //             <>
    //               {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
    //               <ArrowRight className="ml-2 h-4 w-4" />
    //             </>
    //           )}
    //         </Button>
    //       </DialogFooter>
    //     </DialogContent>
    //   </Dialog>
    // </div>
  );
};

export default PRApprovalScreen;
// PRApprovalScreen.tsx

// interface APIPRItem {
//   pr_no: string;
//   reg_date: string;
//   required_date: string;
//   purpose: string;
//   created_by: string;
//   pr_item_sno: number;
//   prod_sno: number;
//   qty: number;
//   est_cost: number;
//   total_cost: number;
//   brn_name: string;
//   dept_name: string;
//   priority_name: string;
//   prod_name: string;
//   uom_name: string;
//   uom_code: string;
//   BRANCH: string;
//   dept: string;
//   ename: string;
// }
// interface PRData {
//   prNumber: string;
//   requestor: string;
//   department: string;
//   requestDate: string;
//   requiredDate: string;
//   totalAmount: number;
//   priority: 'High' | 'Medium' | 'Low';
//   status: 'Pending' | 'Approved' | 'Rejected';
//   description: string;
//   items: PRItem[];
//   attachments?: string[];
//   quotations?: SupplierQuotation[];
//   branch: string;
//   createdBy: string;
// }



// const transformAPIResponse = (apiData: APIPRItem[]): PRData[] => {
//   if (!apiData || apiData.length === 0) return [];

//   // Group by PR number
//   const groupedByPR = apiData.reduce((acc, item) => {
//     if (!acc[item.pr_no]) {
//       acc[item.pr_no] = [];
//     }
//     acc[item.pr_no].push(item);
//     return acc;
//   }, {} as Record<string, APIPRItem[]>);

//   // Convert each group to PRData
//   return Object.entries(groupedByPR).map(([prNumber, items]) => {
//     const firstItem = items[0];
    
//     // Transform items
//     const prItems: PRItem[] = items.map(item => ({
//       id: item.prod_sno.toString(),
//       itemName: item.prod_name,
//       quantity: item.qty,
//       unit: item.uom_name,
//       estimatedPrice: item.est_cost,
//       specification: `${item.uom_code.trim()} - ${item.prod_name}`
//     }));

//     // Calculate total amount
//     const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

//     return {
//       prNumber: prNumber,
//       requestor: firstItem.ename,
//       department: firstItem.dept_name,
//       requestDate: firstItem.reg_date,
//       requiredDate: firstItem.required_date,
//       totalAmount: totalAmount,
//       priority: firstItem.priority_name as 'High' | 'Medium' | 'Low',
//       status: 'Pending',
//       description: firstItem.purpose,
//       items: prItems,
//       branch: firstItem.BRANCH,
//       createdBy: firstItem.created_by,
//       attachments: [],
//       quotations: []
//     };
//   });
// };

// import React, { useState, useEffect } from 'react';
// import { Card, CardContent } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import { Separator } from '@/components/ui/separator';
// import { User, Calendar, DollarSign, FileText, ChevronRight } from 'lucide-react';
// import { ApprovalLayout,ApprovalRecord, ApprovalAction } from '@/LayoutComponent/ApprovalLayout/ApprovalScreenLayout';
// import useFetch from '@/hooks/useFetchHook';
// import { getPrRecords } from '@/Services/Api';

// // Your existing interfaces
// interface PRItem {
//   id: string;
//   itemName: string;
//   quantity: number;
//   unit: string;
//   estimatedPrice: number;
//   specification: string;
// }

// interface PRRecord extends ApprovalRecord<PRItem> {
//   id: string;
//   prNumber: string;
//   requestor: string;
//   department: string;
//   requestDate: string;
//   requiredDate: string;
//   totalAmount: number;
//   priority: 'High' | 'Medium' | 'Low';
//   status: 'Pending' | 'Approved' | 'Rejected';
//   description: string;
//   branch: string;
//   items: PRItem[];
//   quotations?: any[];
//   metadata: {
//     requestor: string;
//     department: string;
//     branch: string;
//   };
// }

// const PRApprovalScreen: React.FC = () => {
//   const [prList, setPrList] = useState<PRRecord[]>([]);
//   const [selectedPR, setSelectedPR] = useState<PRRecord | null>(null);
//   const [selectedQuotation, setSelectedQuotation] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);
//   const { data } = useFetch(getPrRecords);
// console.log(data)
//   useEffect(() => {
//     // Fetch your data
//     const datas = transformAPIResponse(data?.data || []);
//     setPrList(datas);
//     setLoading(false);
//   }, [data]);

//   const getPriorityColor = (priority: string) => {
//     switch (priority) {
//       case 'High': return 'destructive';
//       case 'Medium': return 'default';
//       case 'Low': return 'secondary';
//       default: return 'default';
//     }
//   };

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'Pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
//       case 'Approved': return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
//       case 'Rejected': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
//       default: return 'bg-gray-100 text-gray-800';
//     }
//   };

//   const handleApprove = async (action: ApprovalAction) => {
//     console.log('Approving:', action);
//     // await fetch('/api/pr-approval', { method: 'POST', body: JSON.stringify(action) });
//   };

//   const handleReject = async (action: ApprovalAction) => {
//     console.log('Rejecting:', action);
//     // await fetch('/api/pr-rejection', { method: 'POST', body: JSON.stringify(action) });
//   };

//   return (
//     <ApprovalLayout<PRRecord, PRItem>
//       records={prList}
//       selectedRecord={selectedPR}
//       title="Purchase Requisitions"
//       emptyStateMessage="Select a purchase requisition from the left panel to view details"
//       loading={loading}
//       onRecordSelect={setSelectedPR}
//       onApprove={handleApprove}
//       onReject={handleReject}
//       canApprove={(pr) => {
//         if (pr.quotations && pr.quotations.length > 0 && !selectedQuotation) {
//           return { valid: false, message: 'Please select a quotation before approving' };
//         }
//         return { valid: true };
//       }}
//       // Render list card
//       renderListCard={(pr, isSelected, onSelect) => (
//         <Card
//           key={pr.id}
//           className={`cursor-pointer transition-all hover:shadow-md ${
//             isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''
//           }`}
//           onClick={onSelect}
//         >
//           <CardContent className="p-3">
//             <div className="space-y-2">
//               <div className="flex items-start justify-between">
//                 <div className="flex-1">
//                   <p className="font-semibold text-sm">{pr.prNumber}</p>
//                   <p className="text-xs text-slate-600 dark:text-slate-400">{pr.requestor}</p>
//                 </div>
//                 <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
//               </div>

//               <div className="flex flex-wrap gap-1">
//                 <Badge variant={getPriorityColor(pr.priority)} className="text-xs">{pr.priority}</Badge>
//                 <Badge className={`text-xs ${getStatusColor(pr.status)}`}>{pr.status}</Badge>
//               </div>

//               <div className="space-y-1">
//                 <div className="flex justify-between text-xs">
//                   <span className="text-slate-600 dark:text-slate-400">Department:</span>
//                   <span className="font-medium">{pr.department}</span>
//                 </div>
//                 <div className="flex justify-between text-xs">
//                   <span className="text-slate-600 dark:text-slate-400">Amount:</span>
//                   <span className="font-semibold">₹{pr.totalAmount.toLocaleString('en-IN')}</span>
//                 </div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       )}
//       // Render detail header
//       renderDetailHeader={(pr) => (
//         <div className="flex items-center justify-between">
//           <h1 className="text-3xl font-bold">PR Approval</h1>
//           <Badge variant="outline">Approval Pending</Badge>
//         </div>
//       )}
//       // Render detail content
//       renderDetailContent={(pr) => (
//         <Card className="shadow-lg">
//           <CardContent className="pt-6 space-y-6">
//             {/* Requestor Info Grid */}
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
//                 <User className="h-5 w-5 text-blue-600 mt-0.5" />
//                 <div>
//                   <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Requestor</p>
//                   <p className="text-base font-semibold">{pr.requestor}</p>
//                   <p className="text-sm text-slate-600 dark:text-slate-400">{pr.department}</p>
//                 </div>
//               </div>

//               <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
//                 <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
//                 <div>
//                   <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Amount</p>
//                   <p className="text-base font-semibold">₹{pr.totalAmount.toLocaleString('en-IN')}</p>
//                 </div>
//               </div>
//             </div>

//             <Separator />

//             {/* Items Table */}
//             <div>
//               <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
//                 <FileText className="h-5 w-5" />
//                 Requested Items
//               </h3>
//               <div className="overflow-x-auto rounded-lg border">
//                 <table className="w-full">
//                   <thead className="bg-slate-100 dark:bg-slate-900">
//                     <tr>
//                       <th className="text-left p-3 text-sm font-semibold">Item Name</th>
//                       <th className="text-right p-3 text-sm font-semibold">Quantity</th>
//                       <th className="text-right p-3 text-sm font-semibold">Est. Price</th>
//                       <th className="text-right p-3 text-sm font-semibold">Total</th>
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y">
//                     {pr.items.map((item) => (
//                       <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
//                         <td className="p-3 font-medium">{item.itemName}</td>
//                         <td className="p-3 text-right">{item.quantity} {item.unit}</td>
//                         <td className="p-3 text-right">₹{item.estimatedPrice.toLocaleString('en-IN')}</td>
//                         <td className="p-3 text-right font-semibold">
//                           ₹{(item.quantity * item.estimatedPrice).toLocaleString('en-IN')}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       )}
//       // Render action panel info
//       renderActionPanel={(pr) => (
//         <>
//           <Separator className="my-4" />
//           <div className="space-y-3 text-sm">
//             <div className="flex justify-between">
//               <span className="text-slate-600 dark:text-slate-400">Status</span>
//               <Badge variant="outline">{pr.status}</Badge>
//             </div>
//             <div className="flex justify-between">
//               <span className="text-slate-600 dark:text-slate-400">Items</span>
//               <span className="font-semibold">{pr.items.length}</span>
//             </div>
//             <div className="flex justify-between">
//               <span className="text-slate-600 dark:text-slate-400">Department</span>
//               <span className="font-semibold">{pr.department}</span>
//             </div>
//           </div>
//         </>
//       )}
//     />
//   );
// };

// export default PRApprovalScreen;
