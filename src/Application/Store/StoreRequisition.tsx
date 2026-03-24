import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  Trash2,
  Send,
  Package,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Eye,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
interface StockItem {
  id: number;
  itemCode: string;
  itemName: string;
  category: string;
  availableQuantity: number;
  unit: string;
  location: string;
  reorderLevel: number;
}

interface RequisitionItem {
  id: number;
  stockItem: StockItem;
  requestedQuantity: number;
}

interface Requisition {
  id: number;
  requisitionNo: string;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Partially Approved';
  items: number;
  remarks?: string;
}

interface DashboardStats {
  totalRequisitions: number;
  pendingRequisitions: number;
  approvedRequisitions: number;
  rejectedRequisitions: number;
}

const StoreRequisitionDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('new-requisition');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [requisitionItems, setRequisitionItems] = useState<RequisitionItem[]>([]);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [myRequisitions, setMyRequisitions] = useState<Requisition[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRequisitions: 0,
    pendingRequisitions: 0,
    approvedRequisitions: 0,
    rejectedRequisitions: 0,
  });
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    // Sample stock data
    const sampleStockData: StockItem[] = [
      {
        id: 1,
        itemCode: 'ITM001',
        itemName: 'Office Paper A4',
        category: 'Stationery',
        availableQuantity: 500,
        unit: 'Reams',
        location: 'Store-A',
        reorderLevel: 100,
      },
      {
        id: 2,
        itemCode: 'ITM002',
        itemName: 'Laptop Dell Latitude',
        category: 'Electronics',
        availableQuantity: 15,
        unit: 'Units',
        location: 'Store-B',
        reorderLevel: 5,
      },
      {
        id: 3,
        itemCode: 'ITM003',
        itemName: 'Office Chair',
        category: 'Furniture',
        availableQuantity: 25,
        unit: 'Units',
        location: 'Store-C',
        reorderLevel: 10,
      },
      {
        id: 4,
        itemCode: 'ITM004',
        itemName: 'Printer Ink Cartridge',
        category: 'Stationery',
        availableQuantity: 100,
        unit: 'Pieces',
        location: 'Store-A',
        reorderLevel: 20,
      },
      {
        id: 5,
        itemCode: 'ITM005',
        itemName: 'Whiteboard Marker',
        category: 'Stationery',
        availableQuantity: 200,
        unit: 'Pieces',
        location: 'Store-A',
        reorderLevel: 50,
      },
      {
        id: 6,
        itemCode: 'ITM006',
        itemName: 'USB Flash Drive 32GB',
        category: 'Electronics',
        availableQuantity: 45,
        unit: 'Pieces',
        location: 'Store-B',
        reorderLevel: 15,
      },
    ];

    // Sample requisition history
    const sampleRequisitions: Requisition[] = [
      {
        id: 1,
        requisitionNo: 'REQ-2026-001',
        requestDate: '2026-01-08',
        status: 'Pending',
        items: 3,
        remarks: 'Urgent requirement for Q1 2026',
      },
      {
        id: 2,
        requisitionNo: 'REQ-2026-002',
        requestDate: '2026-01-07',
        status: 'Approved',
        items: 5,
      },
      {
        id: 3,
        requisitionNo: 'REQ-2026-003',
        requestDate: '2026-01-05',
        status: 'Rejected',
        items: 2,
        remarks: 'Budget constraints',
      },
      {
        id: 4,
        requisitionNo: 'REQ-2025-125',
        requestDate: '2025-12-28',
        status: 'Approved',
        items: 4,
      },
      {
        id: 5,
        requisitionNo: 'REQ-2025-120',
        requestDate: '2025-12-20',
        status: 'Partially Approved',
        items: 6,
      },
    ];

    setStockItems(sampleStockData);
    setFilteredStocks(sampleStockData);
    setMyRequisitions(sampleRequisitions);

    // Calculate stats
    setStats({
      totalRequisitions: sampleRequisitions.length,
      pendingRequisitions: sampleRequisitions.filter((r) => r.status === 'Pending').length,
      approvedRequisitions: sampleRequisitions.filter((r) => r.status === 'Approved').length,
      rejectedRequisitions: sampleRequisitions.filter((r) => r.status === 'Rejected').length,
    });

    setLoading(false);
  };

  useEffect(() => {
    let filtered = stockItems;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredStocks(filtered);
  }, [searchTerm, selectedCategory, stockItems]);

  const categories = Array.from(new Set(stockItems.map((item) => item.category)));

  const addToRequisition = (stock: StockItem) => {
    const exists = requisitionItems.find((item) => item.stockItem.id === stock.id);

    if (exists) {
    
      return;
    }

    const newItem: RequisitionItem = {
      id: Date.now(),
      stockItem: stock,
      requestedQuantity: 1,
    };

    setRequisitionItems([...requisitionItems, newItem]);
  };

  const updateQuantity = (id: number, quantity: number) => {
    setRequisitionItems(
      requisitionItems.map((item) =>
        item.id === id ? { ...item, requestedQuantity: quantity } : item
      )
    );
  };

  const removeFromRequisition = (id: number) => {
    setRequisitionItems(requisitionItems.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    if (requisitionItems.length === 0) {
     
      return;
    }

    const invalidItems = requisitionItems.filter(
      (item) =>
        item.requestedQuantity <= 0 ||
        item.requestedQuantity > item.stockItem.availableQuantity
    );

    if (invalidItems.length > 0) {
      toast.error('Invalid Quantities', { description: 'Please check requested quantities.' });
      return;
    }

    setLoading(true);

    const requisitionData = {
      items: requisitionItems.map((item) => ({
        itemId: item.stockItem.id,
        itemCode: item.stockItem.itemCode,
        itemName: item.stockItem.itemName,
        requestedQuantity: item.requestedQuantity,
        unit: item.stockItem.unit,
      })),
      remarks,
      requestDate: new Date().toISOString(),
    };

    try {
      // Replace with actual API call
      console.log('Requisition submitted:', requisitionData);

    

      setRequisitionItems([]);
      setRemarks('');
      setActiveTab('my-requisitions');
      fetchDashboardData();
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'Approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'Rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'Partially Approved':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const viewRequisitionDetails = (requisition: Requisition) => {
    setSelectedRequisition(requisition);
    setShowDetailsDialog(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className=" mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
       
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              User ID: EMP001
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Requisitions</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalRequisitions}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pendingRequisitions}</p>
                </div>
                <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.approvedRequisitions}</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{stats.rejectedRequisitions}</p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-[600px]">
            <TabsTrigger value="new-requisition">
              <Plus className="h-4 w-4 mr-2" />
              New Requisition
            </TabsTrigger>
            <TabsTrigger value="my-requisitions">
              <FileText className="h-4 w-4 mr-2" />
              My Requisitions
            </TabsTrigger>
            {/* <TabsTrigger value="stock-overview">
              <Package className="h-4 w-4 mr-2" />
              Stock Overview
            </TabsTrigger> */}
          </TabsList>

          {/* New Requisition Tab */}
          <TabsContent value="new-requisition" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Available Stock Section */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Available Stock Items</CardTitle>
                  <CardDescription>Browse and add items to your requisition</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Search and Filter */}
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search by item name or code..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Stock Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Available</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStocks.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                No stock items found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredStocks.map((stock) => (
                              <TableRow key={stock.id}>
                                <TableCell className="font-medium">{stock.itemCode}</TableCell>
                                <TableCell>{stock.itemName}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{stock.category}</Badge>
                                </TableCell>
                                <TableCell>
                                  <span className={stock.availableQuantity <= stock.reorderLevel ? 'text-red-600 font-semibold' : ''}>
                                    {stock.availableQuantity} {stock.unit}
                                  </span>
                                </TableCell>
                                <TableCell>{stock.location}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    onClick={() => addToRequisition(stock)}
                                    disabled={requisitionItems.some(
                                      (item) => item.stockItem.id === stock.id
                                    )}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Requisition Cart */}
              <Card className="h-fit sticky top-6">
                <CardHeader>
                  <CardTitle>Requisition Cart</CardTitle>
                  <CardDescription>
                    {requisitionItems.length} item(s) selected
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {requisitionItems.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No items added yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {requisitionItems.map((item) => (
                          <div
                            key={item.id}
                            className="border rounded-lg p-3 space-y-2 bg-white"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.stockItem.itemName}</p>
                                <p className="text-xs text-gray-500">{item.stockItem.itemCode}</p>
                                <p className="text-xs text-gray-500">
                                  Available: {item.stockItem.availableQuantity} {item.stockItem.unit}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromRequisition(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                            <div>
                              <Label className="text-xs">Requested Quantity</Label>
                              <Input
                                type="number"
                                min="1"
                                max={item.stockItem.availableQuantity}
                                value={item.requestedQuantity}
                                onChange={(e) =>
                                  updateQuantity(item.id, parseInt(e.target.value) || 0)
                                }
                                className="mt-1"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {requisitionItems.length > 0 && (
                      <>
                        <div>
                          <Label>Remarks (Optional)</Label>
                          <Textarea
                            placeholder="Add any remarks or special instructions..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="mt-1"
                            rows={3}
                          />
                        </div>

                        <Button
                          className="w-full"
                          onClick={handleSubmit}
                          disabled={loading}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {loading ? 'Submitting...' : 'Submit Requisition'}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* My Requisitions Tab */}
          <TabsContent value="my-requisitions">
            <Card>
              <CardHeader>
                <CardTitle>My Requisition History</CardTitle>
                <CardDescription>Track all your submitted requisitions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Requisition No.</TableHead>
                        <TableHead>Request Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myRequisitions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No requisitions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        myRequisitions.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium">{req.requisitionNo}</TableCell>
                            <TableCell>{new Date(req.requestDate).toLocaleDateString()}</TableCell>
                            <TableCell>{req.items} items</TableCell>
                            <TableCell>{getStatusBadge(req.status)}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {req.remarks || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewRequisitionDetails(req)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Overview Tab */}
          <TabsContent value="stock-overview">
            <Card>
              <CardHeader>
                <CardTitle>Stock Overview</CardTitle>
                <CardDescription>Complete inventory status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        Low Stock: {stockItems.filter(s => s.availableQuantity <= s.reorderLevel).length}
                      </Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        In Stock: {stockItems.filter(s => s.availableQuantity > s.reorderLevel).length}
                      </Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Available Qty</TableHead>
                          <TableHead>Reorder Level</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockItems.map((stock) => (
                          <TableRow key={stock.id}>
                            <TableCell className="font-medium">{stock.itemCode}</TableCell>
                            <TableCell>{stock.itemName}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{stock.category}</Badge>
                            </TableCell>
                            <TableCell>
                              {stock.availableQuantity} {stock.unit}
                            </TableCell>
                            <TableCell>
                              {stock.reorderLevel} {stock.unit}
                            </TableCell>
                            <TableCell>{stock.location}</TableCell>
                            <TableCell>
                              {stock.availableQuantity <= stock.reorderLevel ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Low Stock
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  In Stock
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Requisition Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Requisition Details</DialogTitle>
            <DialogDescription>
              View complete details of your requisition
            </DialogDescription>
          </DialogHeader>
          {selectedRequisition && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Requisition No.</Label>
                  <p className="font-medium">{selectedRequisition.requisitionNo}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Request Date</Label>
                  <p className="font-medium">
                    {new Date(selectedRequisition.requestDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequisition.status)}</div>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Total Items</Label>
                  <p className="font-medium">{selectedRequisition.items}</p>
                </div>
              </div>
              {selectedRequisition.remarks && (
                <div>
                  <Label className="text-sm text-gray-500">Remarks</Label>
                  <p className="mt-1 text-sm">{selectedRequisition.remarks}</p>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Items Requested</p>
                <div className="text-sm text-gray-600">
                  Item details will be loaded from API...
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreRequisitionDashboard;