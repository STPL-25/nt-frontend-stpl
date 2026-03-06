
import React, { useState } from 'react';
import { Search, Filter, Download, Plus, Eye, Edit, Trash2, MoreVertical } from 'lucide-react';

// Types
interface POItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  totalPrice: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  orderDate: string;
  deliveryDate: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Sent' | 'Received' | 'Cancelled';
  items: POItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentTerms: string;
  shippingAddress: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
}

// Mock Data
const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-001',
    poNumber: 'PO-2026-001',
    vendor: {
      id: 'v-001',
      name: 'ABC Suppliers Pvt Ltd',
      email: 'contact@abcsuppliers.com',
      phone: '+91-9876543210',
      address: '123, Industrial Area, Mumbai, Maharashtra 400001'
    },
    orderDate: '2026-01-05',
    deliveryDate: '2026-01-20',
    status: 'Approved',
    items: [
      {
        id: 'item-001',
        itemName: 'Gold Bar 24K',
        description: '999.9 Pure Gold Bar - 100g',
        quantity: 50,
        unit: 'pcs',
        unitPrice: 650000,
        taxRate: 3,
        totalPrice: 33475000
      },
      {
        id: 'item-002',
        itemName: 'Silver Bar 999',
        description: 'Pure Silver Bar - 1kg',
        quantity: 100,
        unit: 'pcs',
        unitPrice: 75000,
        taxRate: 3,
        totalPrice: 7725000
      }
    ],
    subtotal: 40000000,
    taxAmount: 1200000,
    totalAmount: 41200000,
    paymentTerms: 'Net 30',
    shippingAddress: 'Warehouse A, Space Textiles, Chennai, Tamil Nadu 600001',
    notes: 'Urgent delivery required for Q1 inventory',
    createdBy: 'Rajesh Kumar',
    approvedBy: 'Priya Sharma'
  },
  {
    id: 'po-002',
    poNumber: 'PO-2026-002',
    vendor: {
      id: 'v-002',
      name: 'Diamond Merchants International',
      email: 'sales@diamondmerchants.com',
      phone: '+91-9876543211',
      address: '456, Gem Plaza, Surat, Gujarat 395003'
    },
    orderDate: '2026-01-08',
    deliveryDate: '2026-01-25',
    status: 'Pending Approval',
    items: [
      {
        id: 'item-003',
        itemName: 'Diamond 1 Carat VVS1',
        description: 'Round Brilliant Cut, D Color',
        quantity: 25,
        unit: 'pcs',
        unitPrice: 550000,
        taxRate: 0.25,
        totalPrice: 13753437.5
      }
    ],
    subtotal: 13750000,
    taxAmount: 3437.5,
    totalAmount: 13753437.5,
    paymentTerms: 'Advance 50%, Balance on Delivery',
    shippingAddress: 'Warehouse B, Space Textiles, Chennai, Tamil Nadu 600001',
    notes: 'Certification required for all diamonds',
    createdBy: 'Anita Desai'
  },
  {
    id: 'po-003',
    poNumber: 'PO-2026-003',
    vendor: {
      id: 'v-003',
      name: 'Platinum Solutions Ltd',
      email: 'orders@platinumsolutions.com',
      phone: '+91-9876543212',
      address: '789, Metal Complex, Bangalore, Karnataka 560001'
    },
    orderDate: '2026-01-09',
    deliveryDate: '2026-02-05',
    status: 'Draft',
    items: [
      {
        id: 'item-004',
        itemName: 'Platinum Ingot 950',
        description: '950 Platinum Ingot - 500g',
        quantity: 30,
        unit: 'pcs',
        unitPrice: 1250000,
        taxRate: 3,
        totalAmount: 38625000
      }
    ],
    subtotal: 37500000,
    taxAmount: 1125000,
    totalAmount: 38625000,
    paymentTerms: 'Net 45',
    shippingAddress: 'Central Warehouse, Space Textiles, Chennai, Tamil Nadu 600001',
    createdBy: 'Vikram Singh'
  }
];

// Status color mapping
const statusColors: Record<PurchaseOrder['status'], string> = {
  'Draft': 'bg-gray-100 text-gray-700',
  'Pending Approval': 'bg-yellow-100 text-yellow-700',
  'Approved': 'bg-green-100 text-green-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Sent': 'bg-blue-100 text-blue-700',
  'Received': 'bg-purple-100 text-purple-700',
  'Cancelled': 'bg-gray-100 text-gray-500'
};

const POPage: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(mockPurchaseOrders);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);

  // Filter logic
  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = 
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.vendor.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'All' || po.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // View PO details
  const handleViewPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
              <p className="text-gray-500 mt-1">Manage and track all purchase orders</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Plus size={20} />
              Create PO
            </button>
          </div>

          {/* Filters and Search */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by PO number or vendor name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Sent">Sent</option>
              <option value="Received">Received</option>
            </select>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Download size={20} />
              Export
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium">Total POs</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{purchaseOrders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium">Pending Approval</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">
              {purchaseOrders.filter(po => po.status === 'Pending Approval').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium">Approved</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {purchaseOrders.filter(po => po.status === 'Approved').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium">Total Value</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {formatCurrency(purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0))}
            </p>
          </div>
        </div>

        {/* PO Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PO Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-blue-600">{po.poNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{po.vendor.name}</p>
                        <p className="text-sm text-gray-500">{po.vendor.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(po.orderDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(po.deliveryDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[po.status]}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewPO(po)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                        <button className="text-green-600 hover:text-green-800 p-1" title="Edit">
                          <Edit size={18} />
                        </button>
                        <button className="text-red-600 hover:text-red-800 p-1" title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for PO Details */}
        {showModal && selectedPO && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedPO.poNumber}</h2>
                    <span className={`mt-2 px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[selectedPO.status]}`}>
                      {selectedPO.status}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Vendor Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Vendor Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm"><span className="font-medium">Name:</span> {selectedPO.vendor.name}</p>
                    <p className="text-sm mt-1"><span className="font-medium">Email:</span> {selectedPO.vendor.email}</p>
                    <p className="text-sm mt-1"><span className="font-medium">Phone:</span> {selectedPO.vendor.phone}</p>
                    <p className="text-sm mt-1"><span className="font-medium">Address:</span> {selectedPO.vendor.address}</p>
                  </div>
                </div>

                {/* Order Details */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-500">Order Date</p>
                    <p className="text-sm font-medium">{formatDate(selectedPO.orderDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Delivery Date</p>
                    <p className="text-sm font-medium">{formatDate(selectedPO.deliveryDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Terms</p>
                    <p className="text-sm font-medium">{selectedPO.paymentTerms}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created By</p>
                    <p className="text-sm font-medium">{selectedPO.createdBy}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-center">Qty</th>
                        <th className="px-4 py-2 text-right">Unit Price</th>
                        <th className="px-4 py-2 text-right">Tax</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedPO.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.itemName}</p>
                            <p className="text-gray-500 text-xs">{item.description}</p>
                          </td>
                          <td className="px-4 py-3 text-center">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-right">{item.taxRate}%</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="flex justify-end">
                    <div className="w-64">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Subtotal:</span>
                        <span className="text-sm font-medium">{formatCurrency(selectedPO.subtotal)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Tax:</span>
                        <span className="text-sm font-medium">{formatCurrency(selectedPO.taxAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-base font-semibold">Total:</span>
                        <span className="text-base font-bold text-blue-600">
                          {formatCurrency(selectedPO.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedPO.notes && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedPO.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Print
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POPage;