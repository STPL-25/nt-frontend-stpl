import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import clsx from "clsx";

interface PermissionTableProps {
  groups: Record<string, string[]>;
  permissions: Record<string, Record<string, boolean | string[]>>;
  permChecked: (screen?: string, key?: string) => boolean;
  togglePerm: (screen: string, key: string) => void;
//   setMorePermModal: (modal: { open: boolean; screen?: string }) => void;
  handleSave: () => void;
  permissionMap: Record<number, string>; // id to description
  permissionDetails: { permission_id: number; permission_name: string }[]; // id and name from API
}

export default function PermissionTable({
  groups,
  permissions,
        permChecked,
  togglePerm,
//   setMorePermModal,
  handleSave,
  permissionMap,
  permissionDetails,
}: PermissionTableProps) {

  // Create a map of permission_id to permission_name for header display
  const permissionIdNameMap: Record<number, string> = React.useMemo(() => {
    const map: Record<number, string> = {};
    permissionDetails.forEach(({ permission_id, permission_name }) => {
      map[permission_id] = permission_name;
    });
    return map;
  }, [permissionDetails]);

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([group, screens]) => (
        <div key={group} className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
            {group}
          </h3>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-medium text-slate-600 w-52">Screen</th>
                  {permissionDetails.map(({ permission_id }) => (
                    <th
                      key={permission_id}
                      className="px-4 py-3 text-center font-medium text-slate-600 relative"
                      // Tooltip on hover showing description
                      onMouseEnter={(e) => {
                        const tooltip = document.createElement("div");
                        tooltip.className = "absolute z-20 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg top-full left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap";
                        tooltip.textContent = permissionMap[permission_id] || "";
                        (e.currentTarget as HTMLElement).appendChild(tooltip);
                      }}
                      onMouseLeave={(e) => {
                        const toRemove = Array.from(e.currentTarget.children).find((child) =>
                          child.className.includes("absolute"));
                        if (toRemove) e.currentTarget.removeChild(toRemove);
                      }}
                    >
                      {permissionIdNameMap[permission_id] || permission_id}
                    </th>
                  ))}
                  {/* <th className="px-4 py-3 text-center font-medium text-slate-600">Actions</th> */}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {screens.map((screen) => (
                  <tr key={screen} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 font-medium">{screen}</td>
                    {permissionDetails.map(({ permission_id  }) => (
                      <td key={permission_id} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permChecked(screen, String(permission_id))}
                            onCheckedChange={() => togglePerm(screen, String(permission_id))}
                            className={clsx("data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600")}
                          />
                        </div>
                      </td>
                    ))}
                    {/* <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => setMorePermModal({ open: true, screen })}
                      >
                        More
                      </Button>
                    </td> */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* <div className="flex justify-end pt-4 border-t border-slate-200">
        <Button className="bg-blue-600 hover:bg-blue-700 px-8" onClick={handleSave}>
          Save Changes
        </Button>
      </div> */}
    </div>
  );
}
