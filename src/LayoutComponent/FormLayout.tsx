import React from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeaderConfig = {
  icon?: React.ComponentType<any>;
  title?: string;
  description?: string;
};

export type BudgetConfig = {
  icon?: React.ComponentType<any>;
  label?: string;
  value?: string | number;
};

export type FieldDef = {
  field: string;
  label?: string;
  type?: string;
  placeholder?: string;
  options?: any[];
  require?: boolean;
};

export type FormSection = {
  title?: string;
  description?: string;
  type?: string;
  values?: any;
  fields?: FieldDef[];
  renderField?: (
    field: FieldDef,
    values: any,
    onChange: (field: string, value: any) => void
  ) => React.ReactNode;
  addButtonText?: string;
  cols?: 1 | 2 | 3 | 4;
};

export type ItemsConfig = {
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  quantityField?: string;
  totalLabel?: string;
  columns?: Array<{
    header?: string;
    field?: string;
    className?: string;
    cellClassName?: string;
    render?: (item: any, index?: number) => React.ReactNode;
  }>;
};

export interface FormLayoutProps {
  headerConfig?: HeaderConfig;
  budgetConfig?: BudgetConfig;
  formSections?: FormSection[];
  itemsConfig?: ItemsConfig;
  currentItem?: any;
  items?: any[];
  onBasicInfoChange?: (field: string, value: any) => void;
  onCurrentItemChange?: (field: string, value: any) => void;
  onAddItem?: () => void;
  onEditItem?: (item: any) => void;
  onDeleteItem?: (id: any) => void;
  onSaveDraft?: () => void;
  onSubmit?: (isDraft?: boolean) => void;
  errors?: any;
  loading?: boolean;
  canAddItem?: boolean;
}

const colsClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export default function FormLayout({
  headerConfig,
  budgetConfig,
  formSections = [],
  itemsConfig,
  currentItem = {},
  items = [],
  onBasicInfoChange,
  onCurrentItemChange,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onSaveDraft,
  onSubmit,
  errors = {},
  loading = false,
  canAddItem = false,
}: FormLayoutProps) {
  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {headerConfig?.icon && (
            <div className="rounded-lg bg-primary/10 p-2.5 ring-1 ring-primary/20">
              <headerConfig.icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              {headerConfig?.title}
            </h2>
            {headerConfig?.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {headerConfig.description}
              </p>
            )}
          </div>
        </div>

        {budgetConfig && (
          <Card className="sm:w-52 shrink-0 border-primary/20 bg-primary/5">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {budgetConfig.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-primary">{budgetConfig.value}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Form ── */}
      <form className="space-y-4">
        {formSections.map((section, sidx) => (
          <Card key={sidx} className="shadow-sm border">
            <CardHeader className="pb-3 border-b bg-muted/20 rounded-t-xl">
              {section.title && (
                <CardTitle className="text-sm font-semibold text-foreground">
                  {section.title}
                </CardTitle>
              )}
              {section.description && (
                <CardDescription className="text-xs mt-0.5">
                  {section.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              <div className={cn("grid gap-4", colsClass[section.cols ?? 3])}>
                {Array.isArray(section.fields) &&
                  section.fields.map((field) => (
                    <div key={field.field}>
                      {section.renderField
                        ? section.renderField(
                            field,
                            section.values || {},
                            section.type === "basic"
                              ? onBasicInfoChange || (() => {})
                              : onCurrentItemChange || (() => {})
                          )
                        : null}
                    </div>
                  ))}

                {section.type === "item" && (
                  <div className="col-span-full pt-1">
                    <div className="flex justify-end">
                      <Button type="button" size="sm" onClick={onAddItem} disabled={!canAddItem}>
                        {section.addButtonText || "Add Item"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* ── Items Table ── */}
        {itemsConfig && (
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b bg-muted/20 rounded-t-xl">
              <CardTitle className="text-sm font-semibold text-foreground">
                {itemsConfig.title || "Items"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!Array.isArray(items) || items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <PackageOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {itemsConfig.emptyTitle || "No items yet"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {itemsConfig.emptyDescription || "Add items using the form above."}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        {itemsConfig.columns?.map((col, idx) => (
                          <TableHead
                            key={idx}
                            className={cn(
                              "text-xs font-semibold text-muted-foreground",
                              col.className
                            )}
                          >
                            {col.header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow
                          key={item.id || idx}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          {itemsConfig.columns?.map((col, cidx) => (
                            <TableCell
                              key={cidx}
                              className={cn("py-2.5 text-sm", col.cellClassName)}
                            >
                              {col.render ? col.render(item, idx) : (item[col.field || ""] ?? "—")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {/* Total row */}
                      <TableRow className="bg-muted/20 font-medium">
                        <TableCell
                          colSpan={Math.max(0, (itemsConfig.columns?.length || 1) - 2)}
                        />
                        <TableCell className="text-right text-sm font-semibold">
                          {itemsConfig.totalLabel || "Total"}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Footer Actions ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm">
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSaveDraft?.()}
              disabled={loading}
            >
              Save as Draft
            </Button>
            <Button type="button" onClick={() => onSubmit?.(false)} disabled={loading}>
              {loading ? "Submitting…" : "Submit"}
            </Button>
          </div>

          {errors?.items && (
            <p className="text-xs text-destructive">{errors.items}</p>
          )}
        </div>
      </form>
    </div>
  );
}
