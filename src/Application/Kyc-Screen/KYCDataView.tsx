import { useState, useMemo } from "react";
import {
  ChevronDown, ChevronRight, Mail, Phone, Building2, MapPin, CreditCard,
  FileText, User, Hash, X, Download, ExternalLink, ShieldCheck,
  Landmark, BadgeCheck, Calendar, Eye,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import useFetch from "@/hooks/useFetchHook";
import { apiGetAllKycDatas } from "@/Services/Api";
import { KYCData, APIResponse } from "./types/KYCDataViewType";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "@/CustomComponent/PageComponents";
import { getAuthFileUrl } from "@/Services/authUrl";

type DocPreview = { url: string; name: string; docType?: string };

const parseJSON = (raw: string) => {
  try { return JSON.parse(raw); } catch { return []; }
};

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("");

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isPdfUrl   = (url: string) => /\.pdf(\?.*)?$/i.test(url);

const KYCDataView = () => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm]     = useState("");
  const [docPreview, setDocPreview]     = useState<DocPreview | null>(null);

  const apiData = useFetch<APIResponse>(apiGetAllKycDatas);

  // All hooks must be declared before any conditional return
  const suppliers: KYCData[] = useMemo(() => apiData?.data?.data ?? [], [apiData]);

  const stats = useMemo(() => [
    { label: "Total",          value: suppliers.length,                                         icon: Building2,  colorClass: "" },
    { label: "Active",         value: suppliers.filter((s) => s.status === "Y").length,         icon: BadgeCheck, colorClass: "bg-emerald-500/20" },
    { label: "GST Registered", value: suppliers.filter((s) => s.is_gst_avail === "Y").length,  icon: ShieldCheck,colorClass: "bg-blue-500/20" },
    { label: "MSME",           value: suppliers.filter((s) => s.is_msme_avail === "Y").length, icon: Landmark,   colorClass: "bg-purple-500/20" },
  ], [suppliers]);

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          s.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.supp_code && s.supp_code.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [suppliers, searchTerm]
  );

  if (!apiData?.data) {
    return <LoadingState message="Loading KYC records..." fullPage />;
  }

  if (!apiData.data.success || !apiData.data.data) {
    return <ErrorState message="No KYC data available" fullPage />;
  }

  const toggleRow = (index: number) => {
    const next = new Set(expandedRows);
    next.has(index) ? next.delete(index) : next.add(index);
    setExpandedRows(next);
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      <PageHeader
        icon={Building2}
        title="KYC Management"
        description="Supplier verification & onboarding"
        stats={stats}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by company, contact, email, code..."
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Supplier list */}
        <div
          className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-3 transition-all duration-300 ${
            docPreview ? "hidden lg:block lg:max-w-[60%]" : "w-full"
          }`}
        >
          {filteredSuppliers.length === 0 ? (
            <EmptyState
              icon={Building2}
              message="No suppliers found"
              description={searchTerm ? "Try adjusting your search" : "No KYC records yet"}
              action={
                searchTerm ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            filteredSuppliers.map((supplier, index) => {
              const isExpanded = expandedRows.has(index);
              const addresses  = parseJSON(supplier.kyc_address);
              const bankInfo   = parseJSON(supplier.kyc_bank_info);
              const contacts   = parseJSON(supplier.kyc_contact_details);
              const documents  = parseJSON(supplier.kyc_uploaded_doc);
              const isActive   = supplier.status === "Y";

              return (
                <Card
                  key={supplier.kyc_basic_info_sno}
                  className={`overflow-hidden transition-all duration-200 border ${
                    isExpanded
                      ? "border-primary/40 shadow-md shadow-primary/10"
                      : "border-border hover:border-primary/20 hover:shadow-sm"
                  } bg-card`}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleRow(index)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-4 p-4 cursor-pointer select-none group">
                        {/* Avatar */}
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {getInitials(supplier.company_name) || "?"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground capitalize leading-tight">
                              {supplier.company_name}
                            </h3>
                            {supplier.supp_code && (
                              <Badge variant="outline" className="text-xs">
                                <Hash className="h-3 w-3 mr-0.5" />
                                {supplier.supp_code}
                              </Badge>
                            )}
                            <Badge
                              className={`text-xs border ${
                                isActive
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {isActive ? "Active" : "Pending"}
                            </Badge>
                            {supplier.is_gst_avail === "Y" && (
                              <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200">GST</Badge>
                            )}
                            {supplier.is_msme_avail === "Y" && (
                              <Badge className="text-xs bg-purple-50 text-purple-700 border border-purple-200">MSME</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{supplier.contact_person}</span>
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</span>
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.mobile_number}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(supplier.created_date)}</span>
                          </div>
                        </div>

                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                            isExpanded
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-border bg-muted/30">
                        <Tabs defaultValue="basic" className="p-4">
                          <TabsList className="flex flex-wrap h-auto gap-1.5 bg-background border border-border p-1 rounded-lg mb-4">
                            {[
                              { value: "basic",     label: "Basic Info" },
                              { value: "address",   label: `Address (${addresses.length})` },
                              { value: "bank",      label: `Bank (${bankInfo.length})` },
                              { value: "contacts",  label: `Contacts (${contacts.length})` },
                              { value: "documents", label: `Docs (${documents.length})` },
                            ].map((tab) => (
                              <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                              >
                                {tab.label}
                              </TabsTrigger>
                            ))}
                          </TabsList>

                          {/* Basic Info */}
                          <TabsContent value="basic">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {[
                                { label: "Company Name",   value: supplier.company_name,            icon: Building2  },
                                { label: "Business Type",  value: supplier.business_type,           icon: FileText   },
                                { label: "Contact Person", value: supplier.contact_person,          icon: User       },
                                { label: "Email",          value: supplier.email,                   icon: Mail       },
                                { label: "Mobile",         value: supplier.mobile_number,           icon: Phone      },
                                { label: "PAN Number",     value: supplier.pan_no,                  icon: Hash       },
                                { label: "GST Number",     value: supplier.gst_no || "—",           icon: ShieldCheck },
                                { label: "MSME Number",    value: supplier.msme_no || "—",          icon: Landmark   },
                                { label: "Registered On",  value: formatDate(supplier.created_date), icon: Calendar  },
                              ].map(({ label, value, icon: Icon }) => (
                                <div key={label} className="bg-card rounded-xl border border-border p-3 flex items-start gap-3">
                                  <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
                                    <Icon className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                    <p className="text-sm font-medium text-foreground truncate capitalize">{value || "—"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TabsContent>

                          {/* Address */}
                          <TabsContent value="address">
                            {addresses.length === 0 ? (
                              <EmptyState icon={MapPin} message="No addresses found" />
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50">
                                      {["Type","Door No","Street","Area","City","State","Pincode","Map"].map((h) => (
                                        <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                                      ))}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {addresses.map((addr: any, idx: number) => (
                                      <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                                        <TableCell>
                                          <Badge className={`text-xs border ${addr.isPrimary ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground border-border"}`}>
                                            {addr.isPrimary ? "Primary" : "Secondary"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{addr.door_no || "—"}</TableCell>
                                        <TableCell className="text-sm">{addr.street || "—"}</TableCell>
                                        <TableCell className="text-sm">{addr.area || "—"}</TableCell>
                                        <TableCell className="text-sm">{addr.city || "—"}</TableCell>
                                        <TableCell className="text-sm">{addr.state || "—"}</TableCell>
                                        <TableCell className="text-sm">{addr.pincode || "—"}</TableCell>
                                        <TableCell>
                                          {addr.location_link && (
                                            <a href={addr.location_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                              <MapPin className="h-3 w-3" /> View
                                            </a>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </TabsContent>

                          {/* Bank */}
                          <TabsContent value="bank">
                            {bankInfo.length === 0 ? (
                              <EmptyState icon={CreditCard} message="No bank accounts found" />
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50">
                                      {["Bank","Branch","Account Holder","Account No.","Type","IFSC","Primary"].map((h) => (
                                        <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                                      ))}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {bankInfo.map((bank: any, idx: number) => (
                                      <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium text-sm">{bank.bank_name || "—"}</TableCell>
                                        <TableCell className="text-sm">{bank.bank_branch_name || "—"}</TableCell>
                                        <TableCell className="text-sm">{bank.ac_holder_name || "—"}</TableCell>
                                        <TableCell className="text-sm font-mono">{bank.ac_number || "—"}</TableCell>
                                        <TableCell className="text-sm">{bank.ac_type || "—"}</TableCell>
                                        <TableCell className="text-sm font-mono">{bank.ifsc || "—"}</TableCell>
                                        <TableCell>
                                          {bank.isPrimary && (
                                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">Primary</Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </TabsContent>

                          {/* Contacts */}
                          <TabsContent value="contacts">
                            {contacts.length === 0 ? (
                              <EmptyState icon={User} message="No contacts found" />
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {contacts.map((contact: any, idx: number) => (
                                  <div key={idx} className="bg-card rounded-xl border border-border p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                                          {(contact.contact_name || contact.ownername || "?")[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm text-foreground capitalize">
                                            {contact.contact_name || contact.ownername || "—"}
                                          </p>
                                          <p className="text-xs text-muted-foreground capitalize">
                                            {contact.contact_position || contact.ownerposition || "—"}
                                          </p>
                                        </div>
                                      </div>
                                      {contact.isPrimary && (
                                        <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-200">Primary</Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1 pt-1 border-t border-border">
                                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Phone className="h-3 w-3" />{contact.contact_mobile || contact.ownermobile || "—"}
                                      </span>
                                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Mail className="h-3 w-3" />{contact.contact_email || contact.owneremail || "—"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TabsContent>

                          {/* Documents */}
                          <TabsContent value="documents">
                            {documents.length === 0 ? (
                              <EmptyState icon={FileText} message="No documents uploaded" />
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {documents.map((doc: any, idx: number) => {
                                  const docUrl  = doc.document_path || doc.url || "";
                                  const docName = doc.document_name || doc.filename || `Document ${idx + 1}`;
                                  const docType = doc.document_type || doc.documentType || "File";
                                  const authUrl = getAuthFileUrl(docUrl);
                                  return (
                                    <div key={idx} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                                        <FileText className="h-5 w-5 text-primary" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-foreground truncate">{docName}</p>
                                        <Badge className="text-xs mt-1 bg-muted text-muted-foreground border-border border">{docType}</Badge>
                                      </div>
                                      {docUrl && (
                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs gap-1.5"
                                            onClick={() => setDocPreview({ url: authUrl, name: docName, docType })}
                                          >
                                            <Eye className="h-3 w-3" /> View
                                          </Button>
                                          <a
                                            href={authUrl}
                                            download={docName}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center gap-1.5 h-7 px-2 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
                                          >
                                            <Download className="h-3 w-3" /> Save
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })
          )}
        </div>

        {/* Document preview panel */}
        {docPreview && (
          <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col bg-card border-l border-border shadow-2xl fixed inset-y-0 right-0 z-50 lg:relative lg:shadow-none lg:inset-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{docPreview.name}</p>
                  <p className="text-xs text-muted-foreground">{docPreview.docType}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={docPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
                <a
                  href={docPreview.url}
                  download={docPreview.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-3 w-3" /> Save
                </a>
                <button
                  onClick={() => setDocPreview(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-muted/30">
              {isImageUrl(docPreview.url) ? (
                <div className="h-full flex items-center justify-center p-4">
                  <img src={docPreview.url} alt={docPreview.name} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                </div>
              ) : isPdfUrl(docPreview.url) ? (
                <iframe src={docPreview.url} title={docPreview.name} className="w-full h-full border-0" allow="fullscreen" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground/30" />
                  <div>
                    <p className="font-medium text-foreground">Preview not available</p>
                    <p className="text-sm text-muted-foreground mt-1">Use the Open or Save button above</p>
                  </div>
                  <a
                    href={docPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" /> Open in new tab
                  </a>

                </div>
              )}
            </div>
          </div>
        )}

        {docPreview && (
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setDocPreview(null)} />
        )}
      </div>
    </div>
  );
};

export default KYCDataView;
