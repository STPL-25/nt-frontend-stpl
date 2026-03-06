

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, User, Calendar, DollarSign, FileText, ArrowRight, AlertCircle, ChevronRight, Package, Menu, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePrApprovalSideCardDatas } from '@/FieldDatas/PrApprovalData';
import { FieldType } from '@/FieldDatas/SignUpData';
import { useMemo, useState } from 'react';

interface ApprovalScreenLayoutProps {
  approvalName: string;
  prList: any[];
  selectedPR: any;
  handlePRSelect: (pr: any) => void;
  handleAction: (action: string) => void;
  showApprovalDialog: boolean;
  setShowApprovalDialog: (show: boolean) => void;
  action: string;
  comments: string;
  setComments: (comments: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  actionType: 'approve' | 'reject';
}

function ApprovalScreenLayout({ 
  approvalName, 
  prList, 
  selectedPR, 
  handlePRSelect, 
  handleAction, 
  showApprovalDialog, 
  setShowApprovalDialog, 
  action,
  comments, 
  setComments, 
  handleSubmit, 
  loading, 
  actionType
}: ApprovalScreenLayoutProps) {
  const sideCardFieldsForPr = usePrApprovalSideCardDatas();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Helper to parse items and calculate total
  const parseAndEnrichPR = (pr: any) => {
    if (!pr) return null;

    let parsedItems = [];
    let totalCost = 0;

    try {
      if (typeof pr.items === 'string') {
        parsedItems = JSON.parse(pr.items);
      } else if (Array.isArray(pr.items)) {
        parsedItems = pr.items;
      }

      totalCost = parsedItems.reduce((sum: number, item: any) => 
        sum + (parseFloat(item.total_cost) || 0), 0
      );
    } catch (error) {
      console.error('Error parsing PR items:', error);
    }

    return {
      ...pr,
      parsedItems,
      totalCost,
      status: pr.status || 'Pending Approval'
    };
  };

  const enrichedSelectedPR = useMemo(() => 
    parseAndEnrichPR(selectedPR), [selectedPR]
  );

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  // PR List Item Component (reusable for both desktop and mobile)
  const PRListItem = ({ pr, isSelected, onClick }: any) => {
    const enrichedPR = parseAndEnrichPR(pr);

    return (
      <Card
        className={`cursor-pointer transition-all hover:shadow-md border ${
          isSelected
            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
        onClick={onClick}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-2.5">
            {/* Header with PR Number and Employee */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-50 truncate">
                  {pr.pr_no}
                </p>
                {pr.ename && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                    {pr.ename}
                  </p>
                )}
              </div>
              <ChevronRight 
                className={`h-4 w-4 flex-shrink-0 transition-transform ${
                  isSelected 
                    ? 'text-blue-600 dark:text-blue-400 transform translate-x-0.5' 
                    : 'text-slate-400 dark:text-slate-600'
                }`} 
              />
            </div>

            {/* Dynamic Fields */}
            <div className="space-y-1.5 text-xs sm:text-sm">
              {/* Priority Badge */}
              {pr.priority_name && (
                <div className="flex items-center gap-1.5">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      pr.priority_name === 'High' 
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-300 text-red-700 dark:text-red-400'
                        : pr.priority_name === 'Medium'
                        ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 text-yellow-700 dark:text-yellow-400'
                        : 'bg-green-50 dark:bg-green-950/20 border-green-300 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {pr.priority_name}
                  </Badge>
                </div>
              )}

              {/* Branch and Department */}
              {pr.brn_name && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Branch:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50 truncate text-right" title={pr.brn_name}>
                    {pr.brn_name}
                  </span>
                </div>
              )}

              {pr.dept_name && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Dept:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50 truncate text-right" title={pr.dept_name}>
                    {pr.dept_name}
                  </span>
                </div>
              )}

              {/* Dates */}
              {pr.reg_date && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Created:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">
                    {formatDate(pr.reg_date)}
                  </span>
                </div>
              )}

              {pr.required_date && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Required:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">
                    {formatDate(pr.required_date)}
                  </span>
                </div>
              )}

              <Separator className="my-1.5" />

              {/* Items count and total */}
              {enrichedPR && (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Items:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {enrichedPR.parsedItems.length}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 pt-0.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Total:</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      ₹{enrichedPR.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Purpose/Description */}
            {pr.purpose && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2 leading-relaxed">
                  {pr.purpose}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // PR List Sidebar Content
  const PRListContent = () => (
    <>
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
              {approvalName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {prList.length} pending request{prList.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden ml-2"
            onClick={() => setIsMobileSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable PR List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2 sm:p-3 space-y-2">
            {prList.map((pr: any) => (
              <PRListItem
                key={pr.pr_no}
                pr={pr}
                isSelected={selectedPR?.pr_no === pr.pr_no}
                onClick={() => {
                  handlePRSelect(pr);
                  setIsMobileSidebarOpen(false); // Close mobile sidebar on selection
                }}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </>
  );

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden">
      <div className="flex h-full">
        {/* Desktop Sidebar - Hidden on mobile/tablet */}
        <div className="hidden lg:flex w-80 xl:w-96 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex-col h-full">
          <PRListContent />
        </div>

        {/* Mobile Sidebar - Sheet (Drawer) */}
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetContent side="left" className="w-[85vw] sm:w-96 p-0 flex flex-col">
            <PRListContent />
          </SheetContent>
        </Sheet>

        {/* Right Side - PR Details */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
          {/* Mobile Header with Menu Button */}
          <div className="lg:hidden flex-shrink-0 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="flex items-center gap-2"
              >
                <Menu className="h-4 w-4" />
                <span className="hidden xs:inline">PR List</span>
              </Button>
              {selectedPR && (
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedPR.pr_no}</p>
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {prList.length} pending
              </Badge>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto">
            {!enrichedSelectedPR ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center space-y-3">
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-slate-300 dark:text-slate-700 mx-auto" />
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-600 dark:text-slate-400">
                    No PR Selected
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 max-w-sm">
                    Select a purchase requisition from the {window.innerWidth < 1024 ? 'menu' : 'left panel'} to view details
                  </p>
                  <Button
                    variant="outline"
                    className="lg:hidden mt-4"
                    onClick={() => setIsMobileSidebarOpen(true)}
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    View PR List
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-4 md:p-6 lg:p-8">
                <div className="mx-auto space-y-4 sm:space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Purchase Requisition</h1>
                    <Badge variant="outline" className="text-xs sm:text-sm">
                      <Clock className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      {enrichedSelectedPR.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                    {/* Main PR Details */}
                    <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                      {/* PR Header Card */}
                      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 sm:p-6">
                          <div className="flex flex-col gap-3 sm:gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                <CardTitle className="text-lg sm:text-xl lg:text-2xl">
                                  {enrichedSelectedPR.pr_no}
                                </CardTitle>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    enrichedSelectedPR.priority_name === 'High' 
                                      ? 'bg-red-50 dark:bg-red-950/20 border-red-300 text-red-700 dark:text-red-400'
                                      : enrichedSelectedPR.priority_name === 'Medium'
                                      ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 text-yellow-700 dark:text-yellow-400'
                                      : 'bg-green-50 dark:bg-green-950/20 border-green-300 text-green-700 dark:text-green-400'
                                  }`}
                                >
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  {enrichedSelectedPR.priority_name} Priority
                                </Badge>
                              </div>
                              <CardDescription className="mt-2 text-sm sm:text-base">
                                {enrichedSelectedPR.purpose}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-6 p-4 sm:p-6">
                          {/* Requestor Info Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                              <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Requestor
                                </p>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50 truncate">
                                  {enrichedSelectedPR.ename}
                                </p>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                                  {enrichedSelectedPR.dept_name}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Branch
                                </p>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50 truncate">
                                  {enrichedSelectedPR.brn_name}
                                </p>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                                  {enrichedSelectedPR.BRANCH}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Request Date
                                </p>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50">
                                  {formatDate(enrichedSelectedPR.reg_date)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                                  Required By
                                </p>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50">
                                  {formatDate(enrichedSelectedPR.required_date)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <Separator />

                          {/* Items Section */}
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                              Requested Items ({enrichedSelectedPR.parsedItems.length})
                            </h3>
                            
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100 dark:bg-slate-900">
                                  <tr>
                                    <th className="text-left p-2 lg:p-3 text-xs lg:text-sm font-semibold">S.No</th>
                                    <th className="text-left p-2 lg:p-3 text-xs lg:text-sm font-semibold">Product Name</th>
                                    <th className="text-left p-2 lg:p-3 text-xs lg:text-sm font-semibold">Branch</th>
                                    <th className="text-left p-2 lg:p-3 text-xs lg:text-sm font-semibold">Department</th>
                                    <th className="text-right p-2 lg:p-3 text-xs lg:text-sm font-semibold">Quantity</th>
                                    <th className="text-right p-2 lg:p-3 text-xs lg:text-sm font-semibold">Est. Cost</th>
                                    <th className="text-right p-2 lg:p-3 text-xs lg:text-sm font-semibold">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                  {enrichedSelectedPR.parsedItems.map((item: any, index: number) => (
                                    <tr key={item.prod_sno || index} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                      <td className="p-2 lg:p-3 text-slate-600 dark:text-slate-400">{index + 1}</td>
                                      <td className="p-2 lg:p-3">
                                        <div className="font-medium">{item.prod_name}</div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">
                                          {item.priority_name} Priority
                                        </div>
                                      </td>
                                      <td className="p-2 lg:p-3 text-xs lg:text-sm">{item.brn_name}</td>
                                      <td className="p-2 lg:p-3 text-xs lg:text-sm">{item.dept_name}</td>
                                      <td className="p-2 lg:p-3 text-right">
                                        <span className="font-medium">{parseFloat(item.qty).toLocaleString('en-IN')}</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">
                                          {item.uom_name}
                                        </span>
                                      </td>
                                      <td className="p-2 lg:p-3 text-right text-xs lg:text-sm">
                                        ₹{parseFloat(item.est_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="p-2 lg:p-3 text-right font-semibold text-xs lg:text-sm">
                                        ₹{parseFloat(item.total_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="bg-slate-50 dark:bg-slate-900 font-semibold">
                                    <td colSpan={6} className="p-2 lg:p-3 text-right text-xs lg:text-sm">Grand Total:</td>
                                    <td className="p-2 lg:p-3 text-right text-green-600 dark:text-green-400 text-xs lg:text-sm">
                                      ₹{enrichedSelectedPR.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                              {enrichedSelectedPR.parsedItems.map((item: any, index: number) => (
                                <Card key={item.prod_sno || index} className="overflow-hidden">
                                  <CardContent className="p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{item.prod_name}</p>
                                        <Badge variant="outline" className="text-xs mt-1">
                                          {item.priority_name} Priority
                                        </Badge>
                                      </div>
                                      <span className="text-xs text-slate-600 dark:text-slate-400">#{index + 1}</span>
                                    </div>
                                    
                                    <Separator />
                                    
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-slate-600 dark:text-slate-400">Branch:</span>
                                        <p className="font-medium truncate">{item.brn_name}</p>
                                      </div>
                                      <div>
                                        <span className="text-slate-600 dark:text-slate-400">Dept:</span>
                                        <p className="font-medium truncate">{item.dept_name}</p>
                                      </div>
                                      <div>
                                        <span className="text-slate-600 dark:text-slate-400">Quantity:</span>
                                        <p className="font-medium">
                                          {parseFloat(item.qty).toLocaleString('en-IN')} {item.uom_name}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="text-slate-600 dark:text-slate-400">Est. Cost:</span>
                                        <p className="font-medium">
                                          ₹{parseFloat(item.est_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <Separator />
                                    
                                    <div className="flex justify-between items-center pt-1">
                                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total:</span>
                                      <span className="font-bold text-green-600 dark:text-green-400">
                                        ₹{parseFloat(item.total_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                              
                              {/* Mobile Grand Total */}
                              <Card className="bg-slate-50 dark:bg-slate-900">
                                <CardContent className="p-3">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">Grand Total:</span>
                                    <span className="font-bold text-lg text-green-600 dark:text-green-400">
                                      ₹{enrichedSelectedPR.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Action Panel */}
                    <div className="xl:col-span-1">
                      <Card className="shadow-lg xl:sticky xl:top-6">
                        <CardHeader className="p-4 sm:p-6">
                          <CardTitle className="text-base sm:text-lg">Approval Actions</CardTitle>
                          <CardDescription className="text-xs sm:text-sm">
                            Review the details and take action
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                          <Button
                            onClick={() => handleAction('approve')}
                            className="w-full h-10 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                            size="lg"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                            Approve Request
                          </Button>

                          <Button
                            onClick={() => handleAction('reject')}
                            variant="destructive"
                            className="w-full h-10 sm:h-12 text-sm sm:text-base"
                            size="lg"
                          >
                            <XCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                            Reject Request
                          </Button>

                          <Separator className="my-3 sm:my-4" />

                          {/* Quick Info */}
                          <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 dark:text-slate-400">Status</span>
                              <Badge variant="outline" className="text-xs">{enrichedSelectedPR.status}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 dark:text-slate-400">Priority</span>
                              <Badge 
                                variant="outline"
                                className={`text-xs ${
                                  enrichedSelectedPR.priority_name === 'High' 
                                    ? 'bg-red-50 dark:bg-red-950/20'
                                    : enrichedSelectedPR.priority_name === 'Medium'
                                    ? 'bg-yellow-50 dark:bg-yellow-950/20'
                                    : 'bg-green-50 dark:bg-green-950/20'
                                }`}
                              >
                                {enrichedSelectedPR.priority_name}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 dark:text-slate-400">Items</span>
                              <span className="font-semibold">{enrichedSelectedPR.parsedItems.length}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-slate-600 dark:text-slate-400">Department</span>
                              <span className="font-semibold truncate text-right" title={enrichedSelectedPR.dept_name}>
                                {enrichedSelectedPR.dept_name}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 dark:text-slate-400">Branch</span>
                              <span className="font-semibold">{enrichedSelectedPR.brn_name}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center pt-1 sm:pt-2">
                              <span className="text-slate-600 dark:text-slate-400">Total Amount</span>
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-base sm:text-lg text-green-600 dark:text-green-400">
                                  ₹{enrichedSelectedPR.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval/Rejection Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  Approve Purchase Requisition
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  Reject Purchase Requisition
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {actionType === 'approve'
                ? 'Add any comments or notes for this approval.'
                : 'Please provide a reason for rejecting this request.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            {actionType === 'approve' && (
              <div className="p-2.5 sm:p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-xs sm:text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                  Confirming Approval
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  This requisition will proceed to the next stage
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="comments" className="text-xs sm:text-sm">
                Comments {actionType === 'reject' && <span className="text-red-600">*</span>}
              </Label>
              <Textarea
                id="comments"
                placeholder={
                  actionType === 'approve'
                    ? 'Enter any additional notes...'
                    : 'Explain the reason for rejection...'
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
            </div>

            {enrichedSelectedPR && (
              <div className="p-3 sm:p-4 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-slate-400">PR Number</span>
                  <span className="font-semibold">{enrichedSelectedPR.pr_no}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Requestor</span>
                  <span className="font-semibold truncate ml-2" title={enrichedSelectedPR.ename}>
                    {enrichedSelectedPR.ename}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Total Amount</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    ₹{enrichedSelectedPR.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={loading}
              className="w-full sm:w-auto text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || (actionType === 'reject' && !comments.trim())}
              className={`w-full sm:w-auto text-sm ${
                actionType === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                  <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ApprovalScreenLayout;
