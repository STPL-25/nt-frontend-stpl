// pages/StoreRequisitionPage.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

// Types
interface Product {
  id: string;
  productCode: string;
  productName: string;
  category: string;
  availableQuantity: number;
  unit: string;
  location: string;
  reorderLevel: number;
}

interface RequisitionItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  requestedQuantity: number;
  approvedQuantity: number;
  issuedQuantity: number;
  pendingQuantity: number;
  unit: string;
  remarks?: string;
}

interface StoreRequisition {
  requisitionId: string;
  requisitionNumber: string;
  department: string;
  departmentCode: string;
  requestedBy: string;
  requestedByEmail: string;
  requestedDate: string;
  approvedDate?: string;
  status: 'pending' | 'approved' | 'partial' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  items: RequisitionItem[];
}

interface IssueItem {
  itemId: string;
  quantity: number;
  remarks: string;
}

// Mock Data
const mockProducts: Product[] = [
  {
    id: 'PRD001',
    productCode: 'GOLD-24K-BAR',
    productName: '24K Gold Bar 10g',
    category: 'Precious Metals',
    availableQuantity: 150,
    unit: 'pcs',
    location: 'Vault-A-01',
    reorderLevel: 50
  },
  {
    id: 'PRD002',
    productCode: 'SILVER-999-COIN',
    productName: 'Silver Coin 999 Purity',
    category: 'Precious Metals',
    availableQuantity: 500,
    unit: 'pcs',
    location: 'Vault-A-02',
    reorderLevel: 100
  },
  {
    id: 'PRD003',
    productCode: 'DIAMOND-1CT-RND',
    productName: 'Diamond 1 Carat Round Cut',
    category: 'Gemstones',
    availableQuantity: 25,
    unit: 'pcs',
    location: 'Vault-B-01',
    reorderLevel: 10
  },
  {
    id: 'PRD004',
    productCode: 'PLATINUM-WIRE',
    productName: 'Platinum Wire 0.5mm',
    category: 'Precious Metals',
    availableQuantity: 200,
    unit: 'meters',
    location: 'Vault-A-03',
    reorderLevel: 50
  },
  {
    id: 'PRD005',
    productCode: 'GOLD-CHAIN-18K',
    productName: '18K Gold Chain 20g',
    category: 'Finished Goods',
    availableQuantity: 80,
    unit: 'pcs',
    location: 'Showcase-01',
    reorderLevel: 20
  },
  {
    id: 'PRD006',
    productCode: 'SAPPHIRE-BLUE',
    productName: 'Blue Sapphire 0.5 Carat',
    category: 'Gemstones',
    availableQuantity: 15,
    unit: 'pcs',
    location: 'Vault-B-02',
    reorderLevel: 5
  },
  {
    id: 'PRD007',
    productCode: 'GOLD-BISCUIT-22K',
    productName: '22K Gold Biscuit 100g',
    category: 'Precious Metals',
    availableQuantity: 50,
    unit: 'pcs',
    location: 'Vault-A-01',
    reorderLevel: 20
  },
  {
    id: 'PRD008',
    productCode: 'PEARL-CULTURED',
    productName: 'Cultured Pearl 8mm',
    category: 'Gemstones',
    availableQuantity: 300,
    unit: 'pcs',
    location: 'Vault-B-03',
    reorderLevel: 100
  }
];

const mockRequisitions: StoreRequisition[] = [
  {
    requisitionId: 'REQ001',
    requisitionNumber: 'SR-2026-001',
    department: 'Manufacturing',
    departmentCode: 'MFG',
    requestedBy: 'Rajesh Kumar',
    requestedByEmail: 'rajesh.kumar@stpl.com',
    requestedDate: '2026-01-08T09:30:00',
    approvedDate: '2026-01-08T14:00:00',
    status: 'approved',
    priority: 'high',
    items: [
      {
        id: 'ITEM001',
        productId: 'PRD001',
        productCode: 'GOLD-24K-BAR',
        productName: '24K Gold Bar 10g',
        requestedQuantity: 50,
        approvedQuantity: 40,
        issuedQuantity: 0,
        pendingQuantity: 40,
        unit: 'pcs'
      },
      {
        id: 'ITEM002',
        productId: 'PRD002',
        productCode: 'SILVER-999-COIN',
        productName: 'Silver Coin 999 Purity',
        requestedQuantity: 100,
        approvedQuantity: 100,
        issuedQuantity: 0,
        pendingQuantity: 100,
        unit: 'pcs'
      },
      {
        id: 'ITEM003',
        productId: 'PRD004',
        productCode: 'PLATINUM-WIRE',
        productName: 'Platinum Wire 0.5mm',
        requestedQuantity: 150,
        approvedQuantity: 120,
        issuedQuantity: 0,
        pendingQuantity: 120,
        unit: 'meters'
      }
    ]
  },
  {
    requisitionId: 'REQ002',
    requisitionNumber: 'SR-2026-002',
    department: 'Jewelry Design',
    departmentCode: 'JWD',
    requestedBy: 'Priya Sharma',
    requestedByEmail: 'priya.sharma@stpl.com',
    requestedDate: '2026-01-07T11:00:00',
    approvedDate: '2026-01-07T16:30:00',
    status: 'partial',
    priority: 'medium',
    items: [
      {
        id: 'ITEM004',
        productId: 'PRD003',
        productCode: 'DIAMOND-1CT-RND',
        productName: 'Diamond 1 Carat Round Cut',
        requestedQuantity: 10,
        approvedQuantity: 8,
        issuedQuantity: 5,
        pendingQuantity: 3,
        unit: 'pcs'
      },
      {
        id: 'ITEM005',
        productId: 'PRD006',
        productCode: 'SAPPHIRE-BLUE',
        productName: 'Blue Sapphire 0.5 Carat',
        requestedQuantity: 12,
        approvedQuantity: 10,
        issuedQuantity: 6,
        pendingQuantity: 4,
        unit: 'pcs'
      },
      {
        id: 'ITEM006',
        productId: 'PRD008',
        productCode: 'PEARL-CULTURED',
        productName: 'Cultured Pearl 8mm',
        requestedQuantity: 50,
        approvedQuantity: 50,
        issuedQuantity: 30,
        pendingQuantity: 20,
        unit: 'pcs'
      }
    ]
  },
  {
    requisitionId: 'REQ003',
    requisitionNumber: 'SR-2026-003',
    department: 'Quality Control',
    departmentCode: 'QC',
    requestedBy: 'Amit Patel',
    requestedByEmail: 'amit.patel@stpl.com',
    requestedDate: '2026-01-09T08:00:00',
    approvedDate: '2026-01-09T10:00:00',
    status: 'approved',
    priority: 'urgent',
    items: [
      {
        id: 'ITEM007',
        productId: 'PRD007',
        productCode: 'GOLD-BISCUIT-22K',
        productName: '22K Gold Biscuit 100g',
        requestedQuantity: 20,
        approvedQuantity: 15,
        issuedQuantity: 0,
        pendingQuantity: 15,
        unit: 'pcs'
      },
      {
        id: 'ITEM008',
        productId: 'PRD002',
        productCode: 'SILVER-999-COIN',
        productName: 'Silver Coin 999 Purity',
        requestedQuantity: 75,
        approvedQuantity: 60,
        issuedQuantity: 0,
        pendingQuantity: 60,
        unit: 'pcs'
      }
    ]
  },
  {
    requisitionId: 'REQ004',
    requisitionNumber: 'SR-2026-004',
    department: 'Retail Sales',
    departmentCode: 'RTS',
    requestedBy: 'Sneha Reddy',
    requestedByEmail: 'sneha.reddy@stpl.com',
    requestedDate: '2026-01-06T13:00:00',
    approvedDate: '2026-01-06T15:00:00',
    status: 'completed',
    priority: 'low',
    items: [
      {
        id: 'ITEM009',
        productId: 'PRD005',
        productCode: 'GOLD-CHAIN-18K',
        productName: '18K Gold Chain 20g',
        requestedQuantity: 30,
        approvedQuantity: 25,
        issuedQuantity: 25,
        pendingQuantity: 0,
        unit: 'pcs'
      }
    ]
  },
  {
    requisitionId: 'REQ005',
    requisitionNumber: 'SR-2026-005',
    department: 'Export Division',
    departmentCode: 'EXP',
    requestedBy: 'Mohammed Ali',
    requestedByEmail: 'mohammed.ali@stpl.com',
    requestedDate: '2026-01-09T10:30:00',
    status: 'pending',
    priority: 'high',
    items: [
      {
        id: 'ITEM010',
        productId: 'PRD001',
        productCode: 'GOLD-24K-BAR',
        productName: '24K Gold Bar 10g',
        requestedQuantity: 100,
        approvedQuantity: 0,
        issuedQuantity: 0,
        pendingQuantity: 0,
        unit: 'pcs'
      },
      {
        id: 'ITEM011',
        productId: 'PRD003',
        productCode: 'DIAMOND-1CT-RND',
        productName: 'Diamond 1 Carat Round Cut',
        requestedQuantity: 15,
        approvedQuantity: 0,
        issuedQuantity: 0,
        pendingQuantity: 0,
        unit: 'pcs'
      }
    ]
  }
];

const StoreRequisitionPage: React.FC = () => {
  const [requisitions, setRequisitions] = useState<StoreRequisition[]>([]);
  const [selectedRequisition, setSelectedRequisition] = useState<StoreRequisition | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [issueItems, setIssueItems] = useState<Map<string, IssueItem>>(new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  useEffect(() => {
    // Simulate API call with mock data
    loadMockData();
  }, [filterStatus]);

  const loadMockData = () => {
    setLoading(true);
    
    // Simulate network delay
    setTimeout(() => {
      setProducts(mockProducts);
      
      // Filter requisitions based on status
      let filtered = mockRequisitions;
      if (filterStatus !== 'all') {
        filtered = mockRequisitions.filter(req => req.status === filterStatus);
      }
      
      setRequisitions(filtered);
      setLoading(false);
    }, 500);
  };

  const handleSelectRequisition = (requisition: StoreRequisition) => {
    setSelectedRequisition(requisition);
    setIssueItems(new Map());
    setError('');
    setSuccess('');
  };

  const handleQuantityChange = (itemId: string, quantity: number, remarks: string = '') => {
    setIssueItems(prev => {
      const updated = new Map(prev);
      if (quantity > 0) {
        updated.set(itemId, { itemId, quantity, remarks });
      } else {
        updated.delete(itemId);
      }
      return updated;
    });
  };

  const handleRemarksChange = (itemId: string, remarks: string) => {
    setIssueItems(prev => {
      const updated = new Map(prev);
      const existing = updated.get(itemId);
      if (existing) {
        updated.set(itemId, { ...existing, remarks });
      }
      return updated;
    });
  };

  const getAvailableStock = (productId: string): number => {
    const product = products.find(p => p.id === productId);
    return product?.availableQuantity || 0;
  };

  const getMaxIssueQuantity = (item: RequisitionItem): number => {
    const availableStock = getAvailableStock(item.productId);
    const pendingToIssue = item.approvedQuantity - item.issuedQuantity;
    return Math.min(availableStock, pendingToIssue);
  };

  const validateIssue = (): { valid: boolean; message: string } => {
    if (issueItems.size === 0) {
      return { valid: false, message: 'Please select at least one item to issue' };
    }

    for (const [itemId, issueData] of issueItems.entries()) {
      const item = selectedRequisition?.items.find(i => i.id === itemId);
      if (!item) continue;

      const maxQty = getMaxIssueQuantity(item);
      if (issueData.quantity > maxQty) {
        return { 
          valid: false, 
          message: `${item.productName}: Cannot issue more than ${maxQty} ${item.unit}` 
        };
      }
    }

    return { valid: true, message: '' };
  };

  const handleIssueProducts = () => {
    const validation = validateIssue();
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      if (!selectedRequisition) return;

      // Update requisition items with issued quantities
      const updatedItems = selectedRequisition.items.map(item => {
        const issueData = issueItems.get(item.id);
        if (issueData) {
          const newIssuedQty = item.issuedQuantity + issueData.quantity;
          return {
            ...item,
            issuedQuantity: newIssuedQty,
            pendingQuantity: item.approvedQuantity - newIssuedQty,
            remarks: issueData.remarks
          };
        }
        return item;
      });

      // Update product quantities
      const updatedProducts = products.map(product => {
        const issuedForProduct = Array.from(issueItems.values())
          .filter(issue => {
            const item = selectedRequisition.items.find(i => i.id === issue.itemId);
            return item?.productId === product.id;
          })
          .reduce((sum, issue) => sum + issue.quantity, 0);

        if (issuedForProduct > 0) {
          return {
            ...product,
            availableQuantity: product.availableQuantity - issuedForProduct
          };
        }
        return product;
      });

      // Determine new status
      const allIssued = updatedItems.every(item => item.pendingQuantity === 0);
      const someIssued = updatedItems.some(item => item.issuedQuantity > 0);
      const newStatus = allIssued ? 'completed' : (someIssued ? 'partial' : selectedRequisition.status);

      const updatedRequisition = {
        ...selectedRequisition,
        items: updatedItems,
        status: newStatus as StoreRequisition['status']
      };

      // Update state
      setProducts(updatedProducts);
      setRequisitions(prev => 
        prev.map(req => req.requisitionId === updatedRequisition.requisitionId ? updatedRequisition : req)
      );
      setSelectedRequisition(updatedRequisition);
      setIssueItems(new Map());
      setSuccess('Products issued successfully! Inventory updated.');
      setShowConfirmDialog(false);
      setLoading(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    }, 1000);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, icon: AlertCircle, className: 'bg-yellow-100 text-yellow-800' },
      approved: { variant: 'default' as const, icon: CheckCircle2, className: 'bg-blue-100 text-blue-800' },
      partial: { variant: 'outline' as const, icon: Package, className: 'bg-orange-100 text-orange-800' },
      completed: { variant: 'default' as const, icon: CheckCircle2, className: 'bg-green-100 text-green-800' },
      rejected: { variant: 'destructive' as const, icon: XCircle, className: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-800 border-gray-300',
      medium: 'bg-blue-100 text-blue-800 border-blue-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      urgent: 'bg-red-100 text-red-800 border-red-300'
    };

    return (
      <Badge className={`${priorityColors[priority as keyof typeof priorityColors]} border`}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const filteredRequisitions = requisitions.filter(req =>
    req.requisitionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.requestedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTotalIssueQuantity = () => {
    return Array.from(issueItems.values()).reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store Requisitions</h1>
          <p className="text-muted-foreground">Issue products to approved requisitions</p>
        </div>
        <Button onClick={loadMockData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {/* {error && (
        <Alert variant="destructive" className="animate-in fade-in duration-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 animate-in fade-in duration-300">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )} */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Requisitions List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Requisitions List</CardTitle>
            <CardDescription>Select a requisition to issue products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search by number, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Requisitions List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {loading && !requisitions.length ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Loading requisitions...</p>
                </div>
              ) : filteredRequisitions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No requisitions found
                </p>
              ) : (
                filteredRequisitions.map(req => (
                  <Card
                    key={req.requisitionId}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedRequisition?.requisitionId === req.requisitionId
                        ? 'border-primary shadow-md bg-primary/5'
                        : ''
                    }`}
                    onClick={() => handleSelectRequisition(req)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-semibold text-sm">{req.requisitionNumber}</p>
                          <p className="text-xs text-muted-foreground">{req.department}</p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">
                          {new Date(req.requestedDate).toLocaleDateString('en-IN')}
                        </span>
                        {getPriorityBadge(req.priority)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Requested by: <span className="font-medium text-foreground">{req.requestedBy}</span>
                      </p>
                      <p className="text-xs">
                        <span className="font-medium">{req.items.length}</span> item(s)
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Requisition Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>
                  {selectedRequisition
                    ? `Requisition ${selectedRequisition.requisitionNumber}`
                    : 'Select a Requisition'}
                </CardTitle>
                <CardDescription>
                  {selectedRequisition
                    ? `Issue products from inventory`
                    : 'Choose a requisition from the list to start'}
                </CardDescription>
              </div>
              {selectedRequisition && (
                <div className="flex gap-2">
                  {getStatusBadge(selectedRequisition.status)}
                  {getPriorityBadge(selectedRequisition.priority)}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {!selectedRequisition ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No requisition selected</p>
                <p className="text-sm">Select a requisition from the left panel to continue</p>
              </div>
            ) : (
              <>
                {/* Requisition Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg border">
                  <div>
                    <Label className="text-xs text-muted-foreground">Department</Label>
                    <p className="text-sm font-medium">{selectedRequisition.department}</p>
                    <p className="text-xs text-muted-foreground">({selectedRequisition.departmentCode})</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Requested By</Label>
                    <p className="text-sm font-medium">{selectedRequisition.requestedBy}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Requested Date</Label>
                    <p className="text-sm font-medium">
                      {new Date(selectedRequisition.requestedDate).toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedRequisition.requestedDate).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Items</Label>
                    <p className="text-sm font-medium">{selectedRequisition.items.length}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[120px]">Product Code</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead className="text-center w-[80px]">Approved</TableHead>
                          <TableHead className="text-center w-[80px]">Issued</TableHead>
                          <TableHead className="text-center w-[80px]">Pending</TableHead>
                          <TableHead className="text-center w-[80px]">Stock</TableHead>
                          <TableHead className="w-[100px]">Issue Qty</TableHead>
                          <TableHead className="w-[180px]">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRequisition.items.map(item => {
                          const availableStock = getAvailableStock(item.productId);
                          const maxIssue = getMaxIssueQuantity(item);
                          const currentIssue = issueItems.get(item.id);
                          const isLowStock = availableStock < item.pendingQuantity;
                          const cannotIssue = maxIssue === 0;

                          return (
                            <TableRow key={item.id} className={cannotIssue ? 'bg-muted/30' : ''}>
                              <TableCell className="font-mono text-xs font-semibold">
                                {item.productCode}
                              </TableCell>
                              <TableCell className="font-medium">{item.productName}</TableCell>
                              <TableCell className="text-center">
                                <div className="font-medium">{item.approvedQuantity}</div>
                                <div className="text-xs text-muted-foreground">{item.unit}</div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="font-medium text-blue-600">{item.issuedQuantity}</div>
                                <div className="text-xs text-muted-foreground">{item.unit}</div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="font-semibold text-orange-600">{item.pendingQuantity}</div>
                                <div className="text-xs text-muted-foreground">{item.unit}</div>
                              </TableCell>
                              <TableCell
                                className={`text-center ${
                                  isLowStock ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'
                                }`}
                              >
                                <div>{availableStock}</div>
                                <div className="text-xs">{item.unit}</div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max={maxIssue}
                                  value={currentIssue?.quantity || ''}
                                  onChange={(e) => {
                                    const qty = parseInt(e.target.value) || 0;
                                    if (qty <= maxIssue) {
                                      handleQuantityChange(
                                        item.id,
                                        qty,
                                        currentIssue?.remarks || ''
                                      );
                                    }
                                  }}
                                  placeholder="0"
                                  disabled={cannotIssue}
                                  className="w-20 text-center font-semibold"
                                />
                                {cannotIssue && (
                                  <p className="text-xs text-red-600 mt-1">Fully issued</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Textarea
                                  placeholder="Optional remarks..."
                                  value={currentIssue?.remarks || ''}
                                  onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                                  className="min-h-[60px] text-xs"
                                  disabled={!currentIssue || currentIssue.quantity === 0}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      Items to issue: <span className="font-semibold text-foreground">{issueItems.size}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Total quantity: <span className="font-semibold text-foreground">{getTotalIssueQuantity()}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIssueItems(new Map());
                        setError('');
                      }}
                      disabled={issueItems.size === 0}
                    >
                      Clear All
                    </Button>
                    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          disabled={issueItems.size === 0 || loading}
                          className="gap-2"
                        >
                          <Package className="h-4 w-4" />
                          Issue Products
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm Product Issue</DialogTitle>
                          <DialogDescription>
                            You are about to issue <strong>{issueItems.size}</strong> product(s) with total quantity
                            of <strong>{getTotalIssueQuantity()}</strong> units. This action will update the inventory and cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                          <p className="text-sm font-semibold">Issue Summary:</p>
                          {Array.from(issueItems.values()).map(issue => {
                            const item = selectedRequisition.items.find(i => i.id === issue.itemId);
                            return (
                              <div key={issue.itemId} className="text-sm flex justify-between">
                                <span>{item?.productName}</span>
                                <span className="font-medium">{issue.quantity} {item?.unit}</span>
                              </div>
                            );
                          })}
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setShowConfirmDialog(false)}
                            disabled={loading}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleIssueProducts} disabled={loading}>
                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm Issue
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreRequisitionPage;
