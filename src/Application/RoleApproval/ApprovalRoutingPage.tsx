import { GitBranch } from "lucide-react";
import { PageHeader } from "@/CustomComponent/PageComponents";
import { ApprovalRoutingPanel } from "./ApprovalRoutingPanel";

/** Which approval type each kind of request (PR, PO, GRN, KYC, Service ...) takes its workflow from. */
export default function ApprovalRoutingPage() {
  return (
    <div className="flex flex-col min-h-full bg-muted/30">
      <PageHeader
        icon={GitBranch}
        title="Approval Routing"
        description="Choose the approval type for each kind of request, split variants, and add new request types"
      />
      <ApprovalRoutingPanel />
    </div>
  );
}
