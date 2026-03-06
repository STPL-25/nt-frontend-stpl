"use client"

import * as React from "react"
import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Send, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Eye,
  ArrowUpDown,
  Calendar,
  AlertCircle,
  CheckCheck,
  Clock
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Types
interface Supplier {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  rating: number
}

interface SupplierQuotation {
  id: string
  supplierId: string
  supplierName: string
  unitPrice: number
  totalPrice: number
  leadTime: string
  paymentTerms: string
  validityDate: string
  notes: string
  submittedAt: string
  status: "pending" | "submitted" | "selected" | "rejected"
}

interface RequisitionItem {
  id: string
  productCode: string
  productName: string
  description: string
  quantity: number
  unit: string
  estimatedPrice: number
  specifications: string
  selectedSupplierId: string | null
  quotations: SupplierQuotation[]
}

interface PurchaseRequisition {
  id: string
  requisitionNumber: string
  requestedBy: string
  department: string
  requestDate: string
  requiredDate: string
  status: "draft" | "rfq_sent" | "quotations_received" | "under_approval" | "approved" | "rejected"
  items: RequisitionItem[]
  selectedSuppliers: string[]
  rfqSentDate: string | null
  approvalStatus: {
    level: number
    approver: string
    status: "pending" | "approved" | "rejected"
    comments: string
    date: string | null
  }[]
}

// Mock Data
const mockSuppliers: Supplier[] = [
  { id: "SUP001", name: "ABC Suppliers Ltd", contactPerson: "John Doe", email: "john@abc.com", phone: "+91-9876543210", rating: 4.5 },
  { id: "SUP002", name: "XYZ Trading Co", contactPerson: "Jane Smith", email: "jane@xyz.com", phone: "+91-9876543211", rating: 4.2 },
  { id: "SUP003", name: "Global Parts Inc", contactPerson: "Mike Wilson", email: "mike@global.com", phone: "+91-9876543212", rating: 4.8 },
  { id: "SUP004", name: "Prime Materials", contactPerson: "Sarah Johnson", email: "sarah@prime.com", phone: "+91-9876543213", rating: 4.0 },
  { id: "SUP005", name: "Quality Suppliers", contactPerson: "Raj Kumar", email: "raj@quality.com", phone: "+91-9876543214", rating: 4.6 },
]

const mockRequisitionData: PurchaseRequisition = {
  id: "PR001",
  requisitionNumber: "PR-2026-001",
  requestedBy: "Ramesh Kumar",
  department: "Production",
  requestDate: "2026-01-10",
  requiredDate: "2026-01-25",
  status: "draft",
  selectedSuppliers: [],
  rfqSentDate: null,
  items: [
    {
      id: "PRI001",
      productCode: "RAW-001",
      productName: "Cotton Fabric - White",
      description: "100% pure cotton fabric for textile manufacturing",
      quantity: 500,
      unit: "meters",
      estimatedPrice: 150,
      specifications: "Width: 60 inches, GSM: 120, Color: Pure White",
      selectedSupplierId: null,
      quotations: []
    },
    {
      id: "PRI002",
      productCode: "RAW-002",
      productName: "Polyester Thread",
      description: "High-strength polyester sewing thread",
      quantity: 100,
      unit: "spools",
      estimatedPrice: 50,
      specifications: "Tex: 40, Color: Assorted, Cone: 5000m",
      selectedSupplierId: null,
      quotations: []
    },
  ],
  approvalStatus: [
    { level: 1, approver: "Purchase Manager", status: "pending", comments: "", date: null },
    { level: 2, approver: "Finance Head", status: "pending", comments: "", date: null },
    { level: 3, approver: "General Manager", status: "pending", comments: "", date: null },
  ]
}

export default function MultiSupplierRFQSystem() {
  const [requisition, setRequisition] = useState<PurchaseRequisition>(mockRequisitionData)
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false)
  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false)
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<RequisitionItem | null>(null)
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])

  // Quotation Form State
  const [quotationForms, setQuotationForms] = useState<Record<string, {
    unitPrice: string
    leadTime: string
    paymentTerms: string
    validityDate: string
    notes: string
  }>>({})

  // Handle Supplier Selection
  const handleSupplierToggle = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    )
  }

  // Open Supplier Selection Dialog
  const openSupplierDialog = () => {
    setSelectedSuppliers(requisition.selectedSuppliers)
    setIsSupplierDialogOpen(true)
  }

  // Send RFQ to Selected Suppliers
  const handleSendRFQ = () => {
    if (selectedSuppliers.length === 0) {
    
      toast.success("RFQ sending cancelled due to no suppliers selected.")
      return
    }

    setRequisition(prev => ({
      ...prev,
      selectedSuppliers,
      status: "rfq_sent",
      rfqSentDate: new Date().toISOString()
    }))

    setIsSupplierDialogOpen(false)
    

   toast.success(`RFQ sent to ${selectedSuppliers.length} suppliers.`)
    // In production, call API to send emails to suppliers
    console.log("Sending RFQ to suppliers:", selectedSuppliers)
  }

  // Open Quotation Entry Dialog for Item
  const openQuotationDialog = (item: RequisitionItem) => {
    setSelectedItem(item)
    
    // Initialize forms for each selected supplier
    const forms: Record<string, any> = {}
    requisition.selectedSuppliers.forEach(supplierId => {
      const existingQuote = item.quotations.find(q => q.supplierId === supplierId)
      forms[supplierId] = existingQuote ? {
        unitPrice: existingQuote.unitPrice.toString(),
        leadTime: existingQuote.leadTime,
        paymentTerms: existingQuote.paymentTerms,
        validityDate: existingQuote.validityDate,
        notes: existingQuote.notes
      } : {
        unitPrice: "",
        leadTime: "",
        paymentTerms: "",
        validityDate: "",
        notes: ""
      }
    })
    
    setQuotationForms(forms)
    setIsQuotationDialogOpen(true)
  }

  // Update Quotation Form
  const updateQuotationForm = (supplierId: string, field: string, value: string) => {
    setQuotationForms(prev => ({
      ...prev,
      [supplierId]: {
        ...prev[supplierId],
        [field]: value
      }
    }))
  }

  // Save Quotations
  const handleSaveQuotations = () => {
    if (!selectedItem) return

    const newQuotations: SupplierQuotation[] = []

    Object.entries(quotationForms).forEach(([supplierId, form]) => {
      if (form.unitPrice) {
        const supplier = mockSuppliers.find(s => s.id === supplierId)
        const unitPrice = parseFloat(form.unitPrice)
        const totalPrice = unitPrice * selectedItem.quantity

        newQuotations.push({
          id: `Q${Date.now()}-${supplierId}`,
          supplierId,
          supplierName: supplier?.name || "",
          unitPrice,
          totalPrice,
          leadTime: form.leadTime,
          paymentTerms: form.paymentTerms,
          validityDate: form.validityDate,
          notes: form.notes,
          submittedAt: new Date().toISOString(),
          status: "submitted"
        })
      }
    })

    setRequisition(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === selectedItem.id
          ? { ...item, quotations: newQuotations }
          : item
      ),
      status: "quotations_received"
    }))

    setIsQuotationDialogOpen(false)
    
    toast.success("Quotations saved successfully.")
  }

  // Open Comparison Dialog
  const openComparisonDialog = (item: RequisitionItem) => {
    setSelectedItem(item)
    setIsComparisonDialogOpen(true)
  }

  // Select Best Supplier
  const handleSelectSupplier = (itemId: string, supplierId: string) => {
    setRequisition(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? {
              ...item,
              selectedSupplierId: supplierId,
              quotations: item.quotations.map(q => ({
                ...q,
                status: q.supplierId === supplierId ? "selected" : "rejected"
              }))
            }
          : item
      )
    }))

    toast.success("Supplier selected for the item.")
  }

  // Submit for Approval
  const handleSubmitForApproval = () => {
    const allItemsHaveSelectedSupplier = requisition.items.every(
      item => item.selectedSupplierId !== null
    )

    if (!allItemsHaveSelectedSupplier) {
    toast.error("Cannot submit for approval. Please select suppliers for all items.")
      return
    }

    setRequisition(prev => ({
      ...prev,
      status: "under_approval"
    }))
    toast.success("Requisition submitted for approval.")

    // In production, trigger approval workflow API
    console.log("Submitting for approval:", requisition)
  }

  // Approval Action (for higher authority)
  const handleApproval = (level: number, approved: boolean, comments: string) => {
    setRequisition(prev => ({
      ...prev,
      approvalStatus: prev.approvalStatus.map(approval =>
        approval.level === level
          ? {
              ...approval,
              status: approved ? "approved" : "rejected",
              comments,
              date: new Date().toISOString()
            }
          : approval
      ),
      status: !approved ? "rejected" : 
              level === prev.approvalStatus.length ? "approved" : 
              "under_approval"
    }))

    toast({
      title: approved ? "Approved" : "Rejected",
      description: `Approval ${approved ? "granted" : "rejected"} at level ${level}`,
      variant: approved ? "default" : "destructive"
    })
  }

  // Calculate lowest quote
  const getLowestQuote = (quotations: SupplierQuotation[]) => {
    if (quotations.length === 0) return null
    return quotations.reduce((min, quote) => 
      quote.totalPrice < min.totalPrice ? quote : min
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Purchase Requisition - RFQ Management</CardTitle>
              <CardDescription className="mt-2">
                Requisition Number: <span className="font-semibold">{requisition.requisitionNumber}</span>
              </CardDescription>
            </div>
            <Badge 
              variant={
                requisition.status === "approved" ? "default" :
                requisition.status === "rejected" ? "destructive" :
                "secondary"
              }
              className="text-sm"
            >
              {requisition.status.toUpperCase().replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Requested By</p>
              <p className="font-medium">{requisition.requestedBy}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{requisition.department}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Request Date</p>
              <p className="font-medium">{new Date(requisition.requestDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Required By</p>
              <p className="font-medium">{new Date(requisition.requiredDate).toLocaleDateString()}</p>
            </div>
          </div>

          {requisition.selectedSuppliers.length > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Selected Suppliers for RFQ:</p>
              <div className="flex flex-wrap gap-2">
                {requisition.selectedSuppliers.map(supplierId => {
                  const supplier = mockSuppliers.find(s => s.id === supplierId)
                  return (
                    <Badge key={supplierId} variant="outline">
                      {supplier?.name}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button 
            onClick={openSupplierDialog}
            disabled={requisition.status !== "draft" && requisition.status !== "rfq_sent"}
          >
            <Send className="h-4 w-4 mr-2" />
            {requisition.status === "draft" ? "Select Suppliers & Send RFQ" : "Update Suppliers"}
          </Button>
        </CardFooter>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Requisition Items</CardTitle>
          <CardDescription>
            {requisition.status === "draft" && "Select suppliers and send RFQ to get quotations"}
            {requisition.status === "rfq_sent" && "Waiting for supplier quotations - Enter quotations as they arrive"}
            {requisition.status === "quotations_received" && "Compare quotations and select best supplier"}
            {requisition.status === "under_approval" && "Quotations submitted for management approval"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Code</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Est. Price</TableHead>
                <TableHead className="text-center">Quotations</TableHead>
                <TableHead>Selected Supplier</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisition.items.map((item) => {
                const lowestQuote = getLowestQuote(item.quotations)
                const selectedQuote = item.quotations.find(q => q.supplierId === item.selectedSupplierId)
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productCode}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">₹{item.estimatedPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.quotations.length === 0 ? "outline" : "secondary"}>
                        {item.quotations.length} / {requisition.selectedSuppliers.length}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {selectedQuote ? (
                        <div>
                          <p className="font-medium text-sm">{selectedQuote.supplierName}</p>
                          <p className="text-xs text-green-600 font-semibold">
                            ₹{selectedQuote.totalPrice.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not selected</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {requisition.status !== "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openQuotationDialog(item)}
                            disabled={requisition.status === "approved" || requisition.status === "rejected"}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Enter Quotes
                          </Button>
                        )}
                        
                        {item.quotations.length > 0 && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openComparisonDialog(item)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Compare
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {requisition.items.filter(i => i.selectedSupplierId).length} / {requisition.items.length} items have selected suppliers
          </div>
          <Button 
            onClick={handleSubmitForApproval}
            disabled={
              requisition.status === "draft" || 
              requisition.status === "under_approval" ||
              requisition.status === "approved" ||
              requisition.items.some(i => !i.selectedSupplierId)
            }
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Submit for Approval
          </Button>
        </CardFooter>
      </Card>

      {/* Approval Status Card */}
      {requisition.status === "under_approval" || requisition.status === "approved" || requisition.status === "rejected" ? (
        <Card>
          <CardHeader>
            <CardTitle>Approval Workflow</CardTitle>
            <CardDescription>Multi-level approval status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requisition.approvalStatus.map((approval) => (
                <ApprovalLevelCard
                  key={approval.level}
                  approval={approval}
                  onApprove={(comments) => handleApproval(approval.level, true, comments)}
                  onReject={(comments) => handleApproval(approval.level, false, comments)}
                  canApprove={
                    requisition.status === "under_approval" &&
                    approval.status === "pending" &&
                    (approval.level === 1 || requisition.approvalStatus[approval.level - 2]?.status === "approved")
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Supplier Selection Dialog */}
      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Suppliers for RFQ</DialogTitle>
            <DialogDescription>
              Choose multiple suppliers to request quotations. Selected suppliers will receive RFQ via email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {mockSuppliers.map((supplier) => (
              <Card 
                key={supplier.id} 
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedSuppliers.includes(supplier.id) && "border-primary bg-primary/5"
                )}
                onClick={() => handleSupplierToggle(supplier.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedSuppliers.includes(supplier.id)}
                      onCheckedChange={() => handleSupplierToggle(supplier.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <p className="font-semibold">{supplier.name}</p>
                        <p className="text-sm text-muted-foreground">ID: {supplier.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contact Person</p>
                        <p className="text-sm font-medium">{supplier.contactPerson}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{supplier.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Rating</p>
                        <p className="text-sm font-medium">⭐ {supplier.rating}/5.0</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <div className="flex w-full justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedSuppliers.length} supplier(s) selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsSupplierDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendRFQ}>
                  <Send className="h-4 w-4 mr-2" />
                  Send RFQ to Selected Suppliers
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quotation Entry Dialog */}
      <Dialog open={isQuotationDialogOpen} onOpenChange={setIsQuotationDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enter Supplier Quotations</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  {selectedItem.productName} ({selectedItem.productCode}) - Quantity: {selectedItem.quantity} {selectedItem.unit}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {requisition.selectedSuppliers.map((supplierId) => {
              const supplier = mockSuppliers.find(s => s.id === supplierId)
              const form = quotationForms[supplierId] || {}
              const totalPrice = form.unitPrice ? parseFloat(form.unitPrice) * (selectedItem?.quantity || 0) : 0

              return (
                <Card key={supplierId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{supplier?.name}</CardTitle>
                    <CardDescription>{supplier?.email} • {supplier?.phone}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`unitPrice-${supplierId}`}>Unit Price (₹) *</Label>
                        <Input
                          id={`unitPrice-${supplierId}`}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.unitPrice || ""}
                          onChange={(e) => updateQuotationForm(supplierId, "unitPrice", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`leadTime-${supplierId}`}>Lead Time</Label>
                        <Input
                          id={`leadTime-${supplierId}`}
                          placeholder="e.g., 7-10 days"
                          value={form.leadTime || ""}
                          onChange={(e) => updateQuotationForm(supplierId, "leadTime", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`paymentTerms-${supplierId}`}>Payment Terms</Label>
                        <Input
                          id={`paymentTerms-${supplierId}`}
                          placeholder="e.g., Net 30 days"
                          value={form.paymentTerms || ""}
                          onChange={(e) => updateQuotationForm(supplierId, "paymentTerms", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`validityDate-${supplierId}`}>Validity Date</Label>
                        <Input
                          id={`validityDate-${supplierId}`}
                          type="date"
                          value={form.validityDate || ""}
                          onChange={(e) => updateQuotationForm(supplierId, "validityDate", e.target.value)}
                        />
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label htmlFor={`notes-${supplierId}`}>Notes</Label>
                        <Textarea
                          id={`notes-${supplierId}`}
                          placeholder="Additional notes or conditions"
                          value={form.notes || ""}
                          onChange={(e) => updateQuotationForm(supplierId, "notes", e.target.value)}
                          rows={2}
                        />
                      </div>

                      {form.unitPrice && (
                        <div className="col-span-2 p-4 bg-primary/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Price</p>
                          <p className="text-2xl font-bold">₹{totalPrice.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuotationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuotations}>
              Save All Quotations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quotation Comparison Dialog */}
      <Dialog open={isComparisonDialogOpen} onOpenChange={setIsComparisonDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Supplier Quotations</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  {selectedItem.productName} ({selectedItem.productCode}) - Quantity: {selectedItem.quantity} {selectedItem.unit}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && selectedItem.quotations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedItem.quotations
                    .sort((a, b) => a.totalPrice - b.totalPrice)
                    .map((quote, index) => {
                      const isLowest = index === 0
                      const isSelected = quote.supplierId === selectedItem.selectedSupplierId

                      return (
                        <TableRow 
                          key={quote.id}
                          className={cn(
                            isSelected && "bg-green-50 border-green-200",
                            isLowest && !isSelected && "bg-blue-50"
                          )}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{quote.supplierName}</p>
                              {isLowest && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  Lowest Price
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{quote.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-lg">
                            ₹{quote.totalPrice.toFixed(2)}
                          </TableCell>
                          <TableCell>{quote.leadTime || "N/A"}</TableCell>
                          <TableCell>{quote.paymentTerms || "N/A"}</TableCell>
                          <TableCell>
                            {quote.validityDate ? new Date(quote.validityDate).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                isSelected ? "default" :
                                quote.status === "rejected" ? "destructive" :
                                "outline"
                              }
                            >
                              {isSelected ? "Selected" : quote.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant={isSelected ? "outline" : "default"}
                              onClick={() => handleSelectSupplier(selectedItem.id, quote.supplierId)}
                              disabled={
                                isSelected || 
                                requisition.status === "under_approval" ||
                                requisition.status === "approved"
                              }
                            >
                              {isSelected ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Selected
                                </>
                              ) : (
                                "Select"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>

              {/* Quotation Notes */}
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold text-sm">Quotation Notes</h4>
                {selectedItem.quotations.map((quote) => (
                  quote.notes && (
                    <Card key={quote.id}>
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium">{quote.supplierName}</p>
                        <p className="text-sm text-muted-foreground mt-1">{quote.notes}</p>
                      </CardContent>
                    </Card>
                  )
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p>No quotations available for comparison</p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsComparisonDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Approval Level Card Component
interface ApprovalLevelCardProps {
  approval: {
    level: number
    approver: string
    status: "pending" | "approved" | "rejected"
    comments: string
    date: string | null
  }
  onApprove: (comments: string) => void
  onReject: (comments: string) => void
  canApprove: boolean
}

function ApprovalLevelCard({ approval, onApprove, onReject, canApprove }: ApprovalLevelCardProps) {
  const [comments, setComments] = useState(approval.comments)
  const [showActions, setShowActions] = useState(false)

  return (
    <Card className={cn(
      approval.status === "approved" && "border-green-500 bg-green-50",
      approval.status === "rejected" && "border-red-500 bg-red-50"
    )}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {approval.status === "pending" && <Clock className="h-5 w-5 text-orange-500" />}
              {approval.status === "approved" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {approval.status === "rejected" && <XCircle className="h-5 w-5 text-red-600" />}
              
              <div>
                <p className="font-semibold">Level {approval.level} - {approval.approver}</p>
                {approval.date && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(approval.date).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {approval.comments && (
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm"><span className="font-medium">Comments:</span> {approval.comments}</p>
              </div>
            )}

            {canApprove && !showActions && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setShowActions(true)}
              >
                Take Action
              </Button>
            )}

            {canApprove && showActions && (
              <div className="mt-4 space-y-3">
                <Textarea
                  placeholder="Enter approval comments (optional)"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      onApprove(comments)
                      setShowActions(false)
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      onReject(comments)
                      setShowActions(false)
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowActions(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Badge
            variant={
              approval.status === "approved" ? "default" :
              approval.status === "rejected" ? "destructive" :
              "secondary"
            }
          >
            {approval.status.toUpperCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
