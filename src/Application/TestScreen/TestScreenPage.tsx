import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Static, dashboard-style test screen. Numbers below are placeholders — wire to
// real endpoints once the screen's purpose is decided.
const STATS = [
  { label: "Open PRs", value: 24, hint: "+3 this week" },
  { label: "Pending Approvals", value: 11, hint: "5 need your action" },
  { label: "POs Issued", value: 58, hint: "this month" },
  { label: "Active Suppliers", value: 132, hint: "KYC approved" },
];

const RECENT = [
  { ref: "PR-2026-0412", item: "Printer toner", dept: "Admin", status: "Pending" },
  { ref: "PO-2026-0188", item: "Office chairs", dept: "HR", status: "Approved" },
  { ref: "PR-2026-0409", item: "Network switch", dept: "IT", status: "In Review" },
  { ref: "PO-2026-0185", item: "Housekeeping supplies", dept: "Facilities", status: "Approved" },
];

const TestScreenPage: React.FC = () => (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold">Test Screen</h1>
      <p className="text-sm text-muted-foreground">Dashboard-style overview (sample data).</p>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {STATS.map((s) => (
        <Card key={s.label} className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{s.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Reference</th>
              <th className="py-2 pr-4 font-medium">Item</th>
              <th className="py-2 pr-4 font-medium">Department</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {RECENT.map((r) => (
              <tr key={r.ref} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{r.ref}</td>
                <td className="py-2 pr-4">{r.item}</td>
                <td className="py-2 pr-4">{r.dept}</td>
                <td className="py-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  </div>
);

export default TestScreenPage;
