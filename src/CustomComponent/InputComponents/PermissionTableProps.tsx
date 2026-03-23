import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface PermissionDetail {
  permission_id: number;
  permission_name: string;
}

interface PermissionTableProps {
  groups: Record<string, string[]>;
  permissions: Record<string, Record<number, boolean>>;
  permChecked: (screen: string, permissionId: number) => boolean;
  togglePerm: (screen: string, permissionId: number) => void;
  handleSave: () => void;
  permissionMap: Record<number, string>;       // id → description (tooltip)
  permissionDetails: PermissionDetail[];        // ordered list from API
}

export default function PermissionTable({
  groups,
  permChecked,
  togglePerm,
  permissionMap,
  permissionDetails,
}: PermissionTableProps) {

  // id → display name (column header)
  const idToName = React.useMemo<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    permissionDetails.forEach(({ permission_id, permission_name }) => {
      m[permission_id] = permission_name;
    });
    return m;
  }, [permissionDetails]);

  if (Object.keys(groups).length === 0) return null;

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([group, screens]) => (
        <div key={group} className="space-y-3">
          {/* Group heading */}
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {group}
          </h3>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-52">
                    Screen
                  </th>
                  {permissionDetails.map(({ permission_id }) => (
                    <th
                      key={permission_id}
                      className="group/th relative px-4 py-3 text-center font-medium text-muted-foreground"
                    >
                      {idToName[permission_id] ?? permission_id}
                      {/* Tooltip */}
                      {permissionMap[permission_id] && (
                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity group-hover/th:opacity-100 border border-border">
                          {permissionMap[permission_id]}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {screens.map((screen) => (
                  <tr
                    key={screen}
                    className="transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {screen}
                    </td>
                    {permissionDetails.map(({ permission_id }) => (
                      <td key={permission_id} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permChecked(screen, permission_id)}
                            onCheckedChange={() => togglePerm(screen, permission_id)}
                            className={cn(
                              "data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            )}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
