import { useState, useMemo } from "react";
import {
  ChevronRight, Mail, Phone, Building2, MapPin, CreditCard,
  FileText, User, Hash, X, Download, ExternalLink, ShieldCheck,
  Landmark, BadgeCheck, Calendar, Eye, Edit2, Trash2, Menu,
  Users,
} from "lucide-react";
import { usePermissions } from "@/globalState/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import useFetch from "@/hooks/useFetchHook";
import { apiGetAllKycDatas } from "@/Services/Api";
import { KYCData, APIResponse } from "./types/KYCDataViewType";
import { LoadingState, ErrorState, EmptyState } from "@/CustomComponent/PageComponents";
import { getAuthFileUrl } from "@/Services/authUrl";

type DocPreview = { url: string; name: string; docType?: string };

const parseJSON = (raw: string | undefined) => {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
};

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("");

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
const isPdfUrl   = (url: string) => /\.pdf(\?.*)?$/i.test(url);

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  Y: { label: "Active",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" },
  N: { label: "Inactive", cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700" },
  P: { label: "Pending",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800" },
  A: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" },
  R: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800" },
};

function getStatus(s: string | undefined) {
  const key = String(s ?? "P").toUpperCase();
  return STATUS_MAP[key] ?? { label: key, cls: "" };
}

// ─── List card (left sidebar) ────────────────────────────────────────────────

function KYCListCard({
  supplier, isSelected, onClick,
}: {
  supplier: KYCData; isSelected: boolean; onClick: () => void;
}) {
  const { label, cls } = getStatus(supplier.status);
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border ${
        isSelected
          ? "ring-2 ring-primary bg-primary/5 dark:bg-primary/10 border-primary/30"
          : "border-border hover:border-primary/20 hover:shadow-sm"
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
              isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            }`}>
              {getInitials(supplier.company_name) || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate capitalize">{supplier.company_name}</p>
              {supplier.supp_code && (
                <p className="text-xs text-muted-foreground truncate">#{supplier.supp_code}</p>
              )}
            </div>
          </div>
          <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-1 ${isSelected ? "text-primary" : "text-muted-foreground/40"}`} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={`text-xs border ${cls}`}>{label}</Badge>
          {supplier.is_gst_avail === "Y" && (
            <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400">GST</Badge>
          )}
          {supplier.is_msme_avail === "Y" && (
            <Badge className="text-xs bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/20 dark:text-purple-400">MSME</Badge>
          )}
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Contact</span>
            <span className="font-medium truncate text-right capitalize">{supplier.contact_person}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Added</span>
            <span className="font-medium">{formatDate(supplier.created_date)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── List panel content ───────────────────────────────────────────────────────

function KYCListContent({
  suppliers, selected, searchTerm, onSearchChange, onSelect, onClose,
}: {
  suppliers: KYCData[];
  selected: KYCData | null;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  onSelect: (s: KYCData) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold">KYC Records</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}</p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden ml-2">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search company, contact, email…"
          className="w-full h-8 rounded-lg border border-border bg-muted/40 px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Stats row */}
      <div className="flex-shrink-0 grid grid-cols-4 divide-x divide-border border-b border-border bg-muted/20">
        {[
          { label: "Total",  value: suppliers.length },
          { label: "Active", value: suppliers.filter(s => s.status === "Y").length },
          { label: "GST",    value: suppliers.filter(s => s.is_gst_avail === "Y").length },
          { label: "MSME",   value: suppliers.filter(s => s.is_msme_avail === "Y").length },
        ].map(stat => (
          <div key={stat.label} className="flex flex-col items-center py-2">
            <span className="text-sm font-bold text-foreground">{stat.value}</span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {suppliers.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No records found</p>
          ) : (
            <div className="p-2 sm:p-3 space-y-2">
              {suppliers.map(s => (
                <KYCListCard
                  key={s.kyc_basic_info_sno}
                  supplier={s}
                  isSelected={selected?.kyc_basic_info_sno === s.kyc_basic_info_sno}
                  onClick={() => { onSelect(s); onClose?.(); }}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function KYCDetailPanel({ supplier }: { supplier: KYCData }) {
  const { canEdit, canDelete } = usePermissions();
  const [docPreview, setDocPreview] = useState<DocPreview | null>(null);

  const addresses = useMemo(() => parseJSON(supplier.kyc_address), [supplier]);
  const bankInfo  = useMemo(() => parseJSON(supplier.kyc_bank_info), [supplier]);
  const contacts  = useMemo(() => parseJSON(supplier.kyc_contact_details), [supplier]);
  const documents = useMemo(() => parseJSON(supplier.kyc_uploaded_doc), [supplier]);
  const { label: statusLabel, cls: statusCls } = getStatus(supplier.status);

  const basicFields = [
    { label: "Company Name",   value: supplier.company_name,   icon: Building2   },
    { label: "Business Type",  value: supplier.business_type,  icon: FileText    },
    { label: "Contact Person", value: supplier.contact_person, icon: User        },
    { label: "Email",          value: supplier.email,          icon: Mail        },
    { label: "Mobile",         value: supplier.mobile_number,  icon: Phone       },
    { label: "PAN Number",     value: supplier.pan_no,         icon: Hash        },
    { label: "GST Number",     value: supplier.gst_no || "—",  icon: ShieldCheck },
    { label: "MSME Number",    value: supplier.msme_no || "—", icon: Landmark    },
    { label: "Registered On",  value: formatDate(supplier.created_date), icon: Calendar },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">KYC Details</h1>
        <div className="flex items-center gap-2">
          {canEdit("KYCDataView") && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {canDelete("KYCDataView") && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* ── Left: tabs ── */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                  {getInitials(supplier.company_name) || "?"}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg sm:text-xl capitalize">{supplier.company_name}</CardTitle>
                  {supplier.supp_code && (
                    <p className="text-xs text-muted-foreground mt-0.5">Code: {supplier.supp_code}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className={`text-xs border ${statusCls}`}>{statusLabel}</Badge>
                    {supplier.is_gst_avail === "Y" && (
                      <Badge className="text-xs bg-blue-50 text-blue-700 border border-blue-200">GST</Badge>
                    )}
                    {supplier.is_msme_avail === "Y" && (
                      <Badge className="text-xs bg-purple-50 text-purple-700 border border-purple-200">MSME</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="basic">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 border border-border p-1 rounded-xl mb-5">
                  <TabsTrigger value="basic" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <User className="h-3.5 w-3.5" /> Basic Info
                  </TabsTrigger>
                  <TabsTrigger value="address" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <MapPin className="h-3.5 w-3.5" /> Address
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted data-[state=active]:bg-primary-foreground/20">{addresses.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <CreditCard className="h-3.5 w-3.5" /> Bank
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted data-[state=active]:bg-primary-foreground/20">{bankInfo.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <Users className="h-3.5 w-3.5" /> Contacts
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted data-[state=active]:bg-primary-foreground/20">{contacts.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                    <FileText className="h-3.5 w-3.5" /> Docs
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted data-[state=active]:bg-primary-foreground/20">{documents.length}</span>
                  </TabsTrigger>
                </TabsList>

                {/* Basic Info */}
                <TabsContent value="basic">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {basicFields.map(({ label, value, icon: Icon }) => (
                      <div key={label} className="relative bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/70 rounded-l-xl" />
                        <div className="pl-4 pr-3 py-3 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5 capitalize">{value || "—"}</p>
                          </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {addresses.map((addr: any, idx: number) => (
                        <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm ${addr.isPrimary ? "border-amber-200 dark:border-amber-800" : "border-border"}`}>
                          <div className={`px-4 py-2.5 flex items-center justify-between ${addr.isPrimary ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/40"}`}>
                            <div className="flex items-center gap-2">
                              <MapPin className={`h-3.5 w-3.5 ${addr.isPrimary ? "text-amber-600" : "text-muted-foreground"}`} />
                              <span className="text-xs font-semibold">{addr.isPrimary ? "Primary Address" : `Address ${idx + 1}`}</span>
                            </div>
                            {addr.isPrimary && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300">Primary</Badge>
                            )}
                          </div>
                          <div className="p-4 space-y-2 bg-card">
                            <div className="space-y-1">
                              {(addr.door_no || addr.street) && (
                                <p className="text-sm font-medium text-foreground">
                                  {[addr.door_no, addr.street].filter(Boolean).join(", ")}
                                </p>
                              )}
                              {addr.area && <p className="text-sm text-muted-foreground">{addr.area}</p>}
                              <p className="text-sm text-muted-foreground">
                                {[addr.city, addr.state].filter(Boolean).join(", ")}
                                {addr.pincode && ` – ${addr.pincode}`}
                              </p>
                            </div>
                            {addr.location_link && (
                              <a href={addr.location_link} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium text-primary hover:underline">
                                <MapPin className="h-3 w-3" /> View on Map
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Bank */}
                <TabsContent value="bank">
                  {bankInfo.length === 0 ? (
                    <EmptyState icon={CreditCard} message="No bank accounts found" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {bankInfo.map((bank: any, idx: number) => (
                        <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm ${bank.isPrimary ? "border-emerald-200 dark:border-emerald-800" : "border-border"}`}>
                          <div className={`px-4 py-3 flex items-center justify-between ${bank.isPrimary ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-muted/40"}`}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
                                {(bank.bank_name || "B")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold leading-tight">{bank.bank_name || "—"}</p>
                                <p className="text-xs text-muted-foreground">{bank.bank_branch_name || "—"}</p>
                              </div>
                            </div>
                            {bank.isPrimary && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300">Primary</Badge>
                            )}
                          </div>
                          <div className="p-4 space-y-3 bg-card">
                            <div className="bg-muted/50 rounded-lg px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Account Number</p>
                              <p className="font-mono text-base font-bold tracking-widest mt-0.5">{bank.ac_number || "—"}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Holder</p>
                                <p className="font-medium capitalize mt-0.5">{bank.ac_holder_name || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Account Type</p>
                                <p className="font-medium capitalize mt-0.5">{bank.ac_type || "—"}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">IFSC Code</p>
                                <p className="font-mono font-semibold mt-0.5">{bank.ifsc || "—"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Contacts */}
                <TabsContent value="contacts">
                  {contacts.length === 0 ? (
                    <EmptyState icon={Users} message="No contacts found" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {contacts.map((contact: any, idx: number) => (
                        <div key={idx} className={`rounded-xl border overflow-hidden shadow-sm ${contact.isPrimary ? "border-blue-200 dark:border-blue-800" : "border-border"}`}>
                          <div className={`px-4 py-3 flex items-center justify-between ${contact.isPrimary ? "bg-blue-50 dark:bg-blue-950/20" : "bg-muted/40"}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
                                {(contact.contact_name || contact.ownername || "?")[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold capitalize leading-tight">{contact.contact_name || contact.ownername || "—"}</p>
                                <p className="text-xs text-muted-foreground capitalize">{contact.contact_position || contact.ownerposition || "—"}</p>
                              </div>
                            </div>
                            {contact.isPrimary && (
                              <Badge className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300">Primary</Badge>
                            )}
                          </div>
                          <div className="px-4 py-3 space-y-2 bg-card">
                            <a href={`tel:${contact.contact_mobile || contact.ownermobile}`} className="flex items-center gap-2.5 text-sm group">
                              <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                                <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              </div>
                              <span className="text-foreground group-hover:text-primary transition-colors">{contact.contact_mobile || contact.ownermobile || "—"}</span>
                            </a>
                            <a href={`mailto:${contact.contact_email || contact.owneremail}`} className="flex items-center gap-2.5 text-sm group">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                                <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-foreground group-hover:text-primary transition-colors truncate">{contact.contact_email || contact.owneremail || "—"}</span>
                            </a>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {documents.map((doc: any, idx: number) => {
                        const docUrl  = doc.document_path || doc.url || "";
                        const docName = doc.document_name || doc.filename || `Document ${idx + 1}`;
                        const docType = doc.document_type || doc.documentType || "File";
                        const authUrl = getAuthFileUrl(docUrl);
                        const isImg   = isImageUrl(authUrl);
                        const isPdf   = isPdfUrl(authUrl);
                        return (
                          <div key={idx} className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
                            <div className={`px-4 py-3 flex items-center gap-3 border-b ${isImg ? "bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900" : isPdf ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900" : "bg-muted/40 border-border"}`}>
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isImg ? "bg-violet-100 dark:bg-violet-900/40" : isPdf ? "bg-red-100 dark:bg-red-900/40" : "bg-muted"}`}>
                                <FileText className={`h-5 w-5 ${isImg ? "text-violet-600" : isPdf ? "text-red-600" : "text-muted-foreground"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{docName}</p>
                                <Badge className={`text-[10px] mt-0.5 border ${isImg ? "bg-violet-100 text-violet-700 border-violet-200" : isPdf ? "bg-red-100 text-red-700 border-red-200" : "bg-muted text-muted-foreground border-border"}`}>{docType}</Badge>
                              </div>
                            </div>
                            {docUrl && (
                              <div className="px-4 py-3 flex items-center gap-2">
                                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5"
                                  onClick={() => setDocPreview({ url: authUrl, name: docName, docType })}>
                                  <Eye className="h-3 w-3" /> Preview
                                </Button>
                                <a href={authUrl} download={docName} target="_blank" rel="noopener noreferrer"
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">
                                  <Download className="h-3 w-3" /> Download
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
            </CardContent>
          </Card>
        </div>

        {/* ── Right: summary card ── */}
        {/* <div className="xl:col-span-1">
          <Card className="shadow-sm xl:sticky xl:top-6">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-base sm:text-lg">Supplier Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={`text-xs border ${statusCls}`}>{statusLabel}</Badge>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Business Type</span>
                  <span className="font-semibold truncate text-right capitalize">{supplier.business_type || "—"}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">GST</span>
                  <span className="font-semibold">{supplier.is_gst_avail === "Y" ? supplier.gst_no || "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">MSME</span>
                  <span className="font-semibold">{supplier.is_msme_avail === "Y" ? supplier.msme_no || "Yes" : "No"}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Addresses</span>
                  <span className="font-semibold">{addresses.length}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Bank Accounts</span>
                  <span className="font-semibold">{bankInfo.length}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Contacts</span>
                  <span className="font-semibold">{contacts.length}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Documents</span>
                  <span className="font-semibold">{documents.length}</span>
                </div>
                {supplier.supp_code && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground shrink-0">Supplier Code</span>
                      <span className="font-semibold font-mono">{supplier.supp_code}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div> */}
      </div>

      {/* Document preview panel */}
      {docPreview && (
        <div className="fixed inset-y-0 right-0 z-50 w-full lg:w-[45%] xl:w-[40%] flex flex-col bg-card border-l border-border shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{docPreview.name}</p>
                <p className="text-xs text-muted-foreground">{docPreview.docType}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              <a href={docPreview.url} download={docPreview.name} target="_blank" rel="noopener noreferrer"
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
                <a href={docPreview.url} target="_blank" rel="noopener noreferrer"
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
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

const KYCDataView = () => {
  const [selected, setSelected]               = useState<KYCData | null>(null);
  const [searchTerm, setSearchTerm]           = useState("");
  const [isMobileSidebarOpen, setMobileSidebar] = useState(false);

  const apiData = useFetch<APIResponse>(apiGetAllKycDatas);
  const allSuppliers: KYCData[] = useMemo(() => apiData?.data?.data ?? [], [apiData]);

  const filteredSuppliers = useMemo(
    () => allSuppliers.filter(s =>
      s.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.supp_code && s.supp_code.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [allSuppliers, searchTerm]
  );

  if (!apiData?.data) return <LoadingState message="Loading KYC records..." fullPage />;
  if (!apiData.data.success) return <ErrorState message="Failed to load KYC data" fullPage />;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-80 xl:w-96 flex-shrink-0 border-r border-border bg-card flex-col h-full">
        <KYCListContent
          suppliers={filteredSuppliers}
          selected={selected}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSelect={setSelected}
        />
      </div>

      {/* Mobile sidebar sheet */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setMobileSidebar}>
        <SheetContent side="left" className="w-[85vw] sm:w-96 p-0 flex flex-col">
          <KYCListContent
            suppliers={filteredSuppliers}
            selected={selected}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSelect={setSelected}
            onClose={() => setMobileSidebar(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex-shrink-0 px-3 py-2 border-b border-border bg-card flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setMobileSidebar(true)} className="flex items-center gap-1.5">
            <Menu className="h-4 w-4" /> KYC List
          </Button>
          {selected && (
            <p className="font-semibold text-sm truncate flex-1 capitalize">{selected.company_name}</p>
          )}
          <Badge variant="outline" className="text-xs shrink-0">{allSuppliers.length} records</Badge>
        </div>

        <div className="flex-1 overflow-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center space-y-3">
                <BadgeCheck className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/20 mx-auto" />
                <h3 className="text-lg sm:text-xl font-semibold text-muted-foreground">No Supplier Selected</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
                  Select a supplier from the list to view their KYC details
                </p>
                <Button variant="outline" className="lg:hidden mt-2" onClick={() => setMobileSidebar(true)}>
                  <Menu className="h-4 w-4 mr-2" /> View KYC List
                </Button>
              </div>
            </div>
          ) : (
            <KYCDetailPanel supplier={selected} />
          )}
        </div>
      </div>
    </div>
  );
};

export default KYCDataView;
