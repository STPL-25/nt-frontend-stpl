import * as React from "react"

import { cn } from "@/lib/utils"

// On phones (see index.css) each body row becomes a card and every cell shows
// its column heading beside the value. The heading comes from the <th> in the
// same column, copied onto the cells as data-label whenever the rows change.
// Pass stack={false} to keep a wide, scrollable grid on small screens.
function labelCells(table: HTMLTableElement) {
  const headRows = table.tHead?.rows
  const headRow = headRows && headRows.length === 1 ? headRows[0] : null
  const stackable =
    !!headRow && Array.from(headRow.cells).every((c) => c.colSpan <= 1)
  if (!stackable) {
    table.removeAttribute("data-stackable")
    return
  }
  const labels = Array.from(headRow.cells).map((c) => (c.textContent ?? "").trim())
  table.setAttribute("data-stackable", "")
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      Array.from(row.cells).forEach((cell, i) => {
        const label = cell.colSpan > 1 ? "" : labels[i] ?? ""
        if (cell.getAttribute("data-label") !== label) {
          cell.setAttribute("data-label", label)
        }
      })
    }
  }
}

function Table({
  className,
  stack = true,
  ...props
}: React.ComponentProps<"table"> & { stack?: boolean }) {
  const ref = React.useRef<HTMLTableElement>(null)

  React.useEffect(() => {
    const table = ref.current
    if (!table || !stack) return
    labelCells(table)
    const observer = new MutationObserver(() => labelCells(table))
    observer.observe(table, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [stack])

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={ref}
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
