import { useState } from 'react';
import { ChevronDown, ChevronRight, Mail, Phone, Building2, MapPin, CreditCard, FileText, Search, Download, Eye, Calendar, User, Building, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import useFetch from '@/hooks/useFetchHook';
import { apiGetAllKycDatas } from '@/Services/Api';
import {KYCData, APIResponse} from './types/KYCDataViewType';

const KYCDataView = () => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const apiData = useFetch<APIResponse>(apiGetAllKycDatas);

  const parseJSONField = (jsonString: string) => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return [];
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!apiData?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-slate-600 font-medium">Loading KYC data...</p>
        </div>
      </div>
    );
  }

  if (!apiData.data.success || !apiData.data.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">No KYC data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredSuppliers = apiData.data.data.filter(supplier =>
    supplier.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.supp_code && supplier.supp_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Section */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
           
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by company, contact, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              {/* <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Download className="h-4 w-4" />
                Export
              </Button> */}
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {filteredSuppliers.map((supplier, index) => {
            const isExpanded = expandedRows.has(index);
            const addresses = parseJSONField(supplier.kyc_address);
            const bankInfo = parseJSONField(supplier.kyc_bank_info);
            const contacts = parseJSONField(supplier.kyc_contact_details);
            const documents = parseJSONField(supplier.kyc_uploaded_doc);

            return (
              <Card key={supplier.kyc_basic_info_sno} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-slate-200 bg-white/80 backdrop-blur-sm">
                <Collapsible open={isExpanded} onOpenChange={() => toggleRow(index)}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-6 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 cursor-pointer transition-all duration-200">
                      <div className="flex items-start gap-4 flex-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-full hover:bg-blue-100 mt-1 flex-shrink-0"
                        >
                          {isExpanded ? 
                            <ChevronDown className="h-4 w-4 text-blue-600" /> : 
                            <ChevronRight className="h-4 w-4 text-slate-600" />
                          }
                        </Button>
                        
                        <div className="flex-1 space-y-3 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-lg lg:text-xl text-slate-900 capitalize">
                              {supplier.company_name}
                            </h3>
                            {supplier.supp_code && (
                              <Badge variant="outline" className="border-slate-300 text-slate-700">
                                {supplier.supp_code}
                              </Badge>
                            )}
                            <Badge 
                              variant={supplier.status === 'Y' ? 'default' : 'secondary'}
                              className={supplier.status === 'Y' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : ''}
                            >
                              {supplier.status === 'Y' ? 'Active' : 'Inactive'}
                            </Badge>
                            {supplier.is_gst_avail === 'Y' && (
                              <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                                GST
                              </Badge>
                            )}
                            {supplier.is_msme_avail === 'Y' && (
                              <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                                MSME
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-600">
                              <div className="p-1.5 rounded-md bg-slate-100">
                                <User className="h-3.5 w-3.5 text-slate-600" />
                              </div>
                              <span className="truncate capitalize">{supplier.contact_person}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <div className="p-1.5 rounded-md bg-blue-100">
                                <Mail className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <span className="truncate">{supplier.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <div className="p-1.5 rounded-md bg-green-100">
                                <Phone className="h-3.5 w-3.5 text-green-600" />
                              </div>
                              <span>{supplier.mobile_number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <div className="p-1.5 rounded-md bg-orange-100">
                                <Calendar className="h-3.5 w-3.5 text-orange-600" />
                              </div>
                              <span>{formatDate(supplier.created_date).split(',')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-slate-100 bg-gradient-to-br from-slate-50/50 to-blue-50/30">
                      <Tabs defaultValue="basic" className="p-6">
                        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto gap-2 bg-white/80 p-1">
                          <TabsTrigger value="basic" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                            Basic Info
                          </TabsTrigger>
                          <TabsTrigger value="address" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                            Address ({addresses.length})
                          </TabsTrigger>
                          <TabsTrigger value="bank" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                            Bank ({bankInfo.length})
                          </TabsTrigger>
                          <TabsTrigger value="contacts" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                            Contacts ({contacts.length})
                          </TabsTrigger>
                          <TabsTrigger value="documents" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white col-span-2 lg:col-span-1">
                            Documents ({documents.length})
                          </TabsTrigger>
                        </TabsList>

                        {/* Basic Info Tab */}
                          <TabsContent value="basic" className="mt-6">
                          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50">
                                  <TableHead className="font-semibold">Company Name</TableHead>
                                  <TableHead className="font-semibold">Business Type</TableHead>
                                  <TableHead className="font-semibold">Contact Person</TableHead>
                                  <TableHead className="font-semibold">Area</TableHead>
                                  <TableHead className="font-semibold">City</TableHead>
                                  <TableHead className="font-semibold">Taluk</TableHead>
                                  <TableHead className="font-semibold">State</TableHead>
                                  <TableHead className="font-semibold">Pincode</TableHead>
                                  <TableHead className="font-semibold">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                
                                  <TableRow  className="hover:bg-blue-50/50">
                                  
                                    <TableCell>{supplier.company_name}</TableCell>
                                    <TableCell>{supplier.business_type}</TableCell>
                                    <TableCell>{supplier.contact_person}</TableCell>
                                    <TableCell>{supplier.email}</TableCell>
                                    <TableCell>{supplier.mobile_number}</TableCell>
                                    <TableCell>{supplier.pan_no}</TableCell>
                                    <TableCell>{supplier.gst_no}</TableCell>
                                    <TableCell>{supplier.msme_no}</TableCell>
                                    
                                  </TableRow>
                               
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>

                     

                        {/* Address Tab */}
                        <TabsContent value="address" className="mt-6">
                          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50">
                                  <TableHead className="font-semibold">Type</TableHead>
                                  <TableHead className="font-semibold">Door No</TableHead>
                                  <TableHead className="font-semibold">Street</TableHead>
                                  <TableHead className="font-semibold">Area</TableHead>
                                  <TableHead className="font-semibold">City</TableHead>
                                  <TableHead className="font-semibold">Taluk</TableHead>
                                  <TableHead className="font-semibold">State</TableHead>
                                  <TableHead className="font-semibold">Pincode</TableHead>
                                  <TableHead className="font-semibold">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {addresses.map((addr: any, idx: number) => (
                                  <TableRow key={idx} className="hover:bg-blue-50/50">
                                    <TableCell>
                                      <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                                        {addr.address_type === 'PR' ? 'Primary' : addr.address_type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{addr.door_no}</TableCell>
                                    <TableCell>{addr.street}</TableCell>
                                    <TableCell>{addr.area}</TableCell>
                                    <TableCell>{addr.city}</TableCell>
                                    <TableCell>{addr.taluk}</TableCell>
                                    <TableCell>{addr.state}</TableCell>
                                    <TableCell>{addr.pincode}</TableCell>
                                    <TableCell>
                                      {addr.location_link && (
                                        <Button variant="outline" size="sm" asChild>
                                          <a href={addr.location_link} target="_blank" rel="noopener noreferrer">
                                            <MapPin className="h-3.5 w-3.5" />
                                          </a>
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>

                        {/* Bank Details Tab */}
                        <TabsContent value="bank" className="mt-6">
                          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50">
                                  <TableHead className="font-semibold">Bank Name</TableHead>
                                  <TableHead className="font-semibold">Branch</TableHead>
                                  <TableHead className="font-semibold">Account Holder</TableHead>
                                  <TableHead className="font-semibold">Account Number</TableHead>
                                  <TableHead className="font-semibold">Account Type</TableHead>
                                  <TableHead className="font-semibold">IFSC Code</TableHead>
                                  <TableHead className="font-semibold">Bank Address</TableHead>
                                  <TableHead className="font-semibold">Primary</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {bankInfo.map((bank: any, idx: number) => (
                                  <TableRow key={idx} className="hover:bg-blue-50/50">
                                    <TableCell className="font-medium">{bank.bank_name}</TableCell>
                                    <TableCell>{bank.bank_branch_name}</TableCell>
                                    <TableCell>{bank.ac_holder_name}</TableCell>
                                    <TableCell>{bank.ac_number}</TableCell>
                                    <TableCell>{bank.ac_type}</TableCell>
                                    <TableCell>{bank.ifsc}</TableCell>
                                    <TableCell>{bank.bank_address}</TableCell>
                                    <TableCell>
                                      {bank.is_primary === 'Y' && (
                                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500">Primary</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>

                        {/* Contacts Tab */}
                        <TabsContent value="contacts" className="mt-6">
                          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50">
                                  <TableHead className="font-semibold">Type</TableHead>
                                  <TableHead className="font-semibold">Name</TableHead>
                                  <TableHead className="font-semibold">Position</TableHead>
                                  <TableHead className="font-semibold">Mobile</TableHead>
                                  <TableHead className="font-semibold">Email</TableHead>
                                  <TableHead className="font-semibold">Status</TableHead>
                                  <TableHead className="font-semibold">Created Date</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {contacts.map((contact: any, idx: number) => (
                                  <TableRow key={idx} className="hover:bg-blue-50/50">
                                    <TableCell>
                                      <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                                        {contact.contact_type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium capitalize">{contact.contact_name}</TableCell>
                                    <TableCell className="capitalize">{contact.contact_position}</TableCell>
                                    <TableCell>{contact.contact_mobile}</TableCell>
                                    <TableCell>{contact.contact_email}</TableCell>
                                    <TableCell>
                                      <Badge variant={contact.is_active === '1' ? 'default' : 'secondary'}>
                                        {contact.is_active === '1' ? 'Active' : 'Inactive'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(contact.created_date)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>

                        {/* Documents Tab */}
                        <TabsContent value="documents" className="mt-6">
                          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50">
                                  <TableHead className="font-semibold">Document Type</TableHead>
                                  <TableHead className="font-semibold">Document Name</TableHead>
                                  <TableHead className="font-semibold">Status</TableHead>
                                  <TableHead className="font-semibold">Uploaded Date</TableHead>
                                  <TableHead className="font-semibold">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {documents.map((doc: any, idx: number) => (
                                  <TableRow key={idx} className="hover:bg-blue-50/50">
                                    <TableCell>
                                      <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
                                        {doc.document_type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{doc.document_name}</TableCell>
                                    <TableCell>
                                      <Badge variant={doc.is_active === '1' ? 'default' : 'secondary'}>
                                        {doc.is_active === '1' ? 'Active' : 'Inactive'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(doc.uploaded_date)}</TableCell>
                                    <TableCell>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300" 
                                        asChild
                                      >
                                        <a href={doc.document_path} target="_blank" rel="noopener noreferrer">
                                          <Eye className="h-3.5 w-3.5" />
                                          View
                                        </a>
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {documents.length === 0 && (
                            <div className="text-center py-12">
                              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                              <p className="text-slate-500">No documents uploaded</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>

        {filteredSuppliers.length === 0 && (
          <Card className="p-12 text-center">
            <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No suppliers found matching your search</p>
            <p className="text-slate-500 text-sm mt-2">Try adjusting your search criteria</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default KYCDataView;
