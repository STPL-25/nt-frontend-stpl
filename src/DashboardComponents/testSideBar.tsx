// import React, { useState, useEffect } from "react";
// import {
//   Home,
//   X,
//   LogOut,
//   BarChart3,
//   Users,
//   ShoppingCart,
//   Calendar,
//   Settings,
//   ChevronDown,
//   ChevronRight,
//   Menu,
//   Building2,
//   GitBranch,
//   Network,
//   FileText,
//   ShieldCheck,
//   Package,
//   Globe,
//   Search,
//   Bell,
//   User,
//   DollarSign,
// } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "@/components/ui/collapsible";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { useAppState } from "@/globalState/hooks/useAppState";
// type IconComponent = React.ComponentType<{ className?: string }>;

// interface ChildItem {
//   id: string;
//   label: string;
//   icon: IconComponent;
//   badge?: string | number;
// }

// interface MenuItem {
//   id: string;
//   label: string;
//   icon: IconComponent;
//   badge?: string | number;
//   children?: ChildItem[];
// }

// const Sidebar: React.FC = () => {
//   const [isResizing, setIsResizing] = useState<boolean>(false);

//   // Cast to any until you provide a typed return for useAppState
//   const {
//     sidebarOpen,
//     setSidebarOpen,
//     expandedItems,
//     setExpandedItems,
//     activeItem,
//     setActiveItem,
//     activeComponent,
//     setActiveComponent,
//     sidebarWidth,
//     setSidebarWidth,
//     isCollapsed,
//     setIsCollapsed,
//     toggleCollapse,
//     setHeaderComponentRender,
//   } = useAppState() as any;

//   const menuItems: MenuItem[] = [
//     { icon: Home, label: "Masters", id: "masters" },
//     { icon: ShieldCheck, label: "KYC Entry", id: "KYCEntry" },
//     { icon: Users, label: "Role Approval", id: "RoleApproval" },
//     { icon: DollarSign, label: "Budget Request", id: "BudgetRequest" },
//     { icon: BarChart3, label: "Purchase Requisition", id: "PurRequisitionForm" },
//     { icon: Globe, label: "Hod Approval", id: "HodApproval" },
//     { icon: Users, label: "Requisition Approval", id: "PurchaseApproval" },
//     { icon: ShieldCheck, label: "Requisition Authorization", id: "PurReqAuthorization" },

//   ];
//   const toggleExpanded = (itemId: string) => {
//     if (typeof setExpandedItems === "function") {
//       setExpandedItems((prev: Record<string, boolean>) => ({
//         ...prev,
//         [itemId]: !prev[itemId],
//       }));
//     }
//   };

//   const handleItemClick = (item: MenuItem, childItem?: ChildItem | null) => {
//     if (childItem) {
//       setActiveItem?.(childItem.id);
//       setActiveComponent?.(childItem.id);
//       setHeaderComponentRender?.(childItem.label);
//     } else if (item.children && item.children.length > 0) {
//       toggleExpanded(item.id);
//     } else {
//       setActiveItem?.(item.id);
//       setActiveComponent?.(item.id);
//       setHeaderComponentRender?.(item.label);

//       // Close sidebar on mobile after selection
//       if (typeof window !== "undefined" && window.innerWidth < 1024) {
//         setSidebarOpen?.(false);
//       }
//     }
//   };

//   const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
//     setIsResizing(true);
//     e.preventDefault();
//   };

//   useEffect(() => {
//     const handleMouseMove = (e: MouseEvent) => {
//       if (!isResizing) return;

//       const newWidth = e.clientX;
//       if (typeof setSidebarWidth === "function" && newWidth >= 280 && newWidth <= 450) {
//         setSidebarWidth(newWidth);
//       }
//     };

//     const handleMouseUp = () => {
//       setIsResizing(false);
//     };

//     if (isResizing) {
//       document.addEventListener("mousemove", handleMouseMove);
//       document.addEventListener("mouseup", handleMouseUp);
//     }

//     return () => {
//       document.removeEventListener("mousemove", handleMouseMove);
//       document.removeEventListener("mouseup", handleMouseUp);
//     };
//   }, [isResizing, setSidebarWidth]);

//   return (
//     <>
//       <TooltipProvider>
//         <div
//           className={`${
//             sidebarOpen ? "translate-x-0" : "-translate-x-full"
//           } fixed lg:translate-x-0 lg:inset-0 z-50 bg-background/95 backdrop-blur-md border-r border-border/50 transform transition-all 
//            duration-300 ease-in-out h-screen flex flex-col shadow-xl lg:shadow-sm`}
//           style={{ width: isCollapsed ? "80px" : `${sidebarWidth}px` }}
//         >
//           {/* Header */}
//           <div className="p-4 border-b border-border/50 bg-background/50 backdrop-blur-sm">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center space-x-3">
//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={toggleCollapse}
//                       className="hidden lg:flex h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
//                     >
//                       <Menu className="h-4 w-4" />
//                     </Button>
//                   </TooltipTrigger>
//                   <TooltipContent side="right">
//                     {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
//                   </TooltipContent>
//                 </Tooltip>

//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={() => setSidebarOpen?.(false)}
//                   className="lg:hidden h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
//                 >
//                   <X className="h-4 w-4" />
//                 </Button>
//               </div>
//             </div>
//           </div>

//           {/* Navigation */}
//           <ScrollArea className="flex-1 p-4">
//             <nav className="space-y-2">
//               {menuItems.map((item) => (
//                 <div key={item.id}>
//                   {item.children && item.children.length > 0 ? (
//                     <Collapsible
//                       open={!!expandedItems?.[item.id]}
//                       onOpenChange={() => toggleExpanded(item.id)}
//                     >
//                       <CollapsibleTrigger asChild>
//                         <Button
//                           variant={activeItem === item.id ? "secondary" : "ghost"}
//                           className={`w-full justify-between h-12 transition-all duration-200 hover:bg-muted/50 ${
//                             isCollapsed ? "px-0 justify-center" : "px-3"
//                           } ${activeItem === item.id ? "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50" : ""}`}
//                         >
//                           <div className="flex items-center space-x-3">
//                             <div
//                               className={`p-2 rounded-lg transition-all duration-200 ${
//                                 activeItem === item.id
//                                   ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md"
//                                   : "bg-muted/70 hover:bg-muted"
//                               }`}
//                             >
//                               <item.icon className="h-4 w-4" />
//                             </div>
//                             {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
//                           </div>

//                           {!isCollapsed && (
//                             <ChevronRight
//                               className={`h-4 w-4 transition-transform duration-200 ${expandedItems?.[item.id] ? "rotate-90" : ""}`}
//                             />
//                           )}
//                         </Button>
//                       </CollapsibleTrigger>

//                       {!isCollapsed && (
//                         <CollapsibleContent className="space-y-1 ml-4 mt-2">
//                           {item.children!.map((childItem) => (
//                             <Button
//                               key={childItem.id}
//                               variant={activeItem === childItem.id ? "secondary" : "ghost"}
//                               className={`w-full justify-start h-10 transition-all duration-200 hover:bg-muted/50 ${
//                                 activeItem === childItem.id ? "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50" : ""
//                               }`}
//                               onClick={() => handleItemClick(item, childItem)}
//                             >
//                               <div className="flex items-center space-x-3">
//                                 <div
//                                   className={`p-1.5 rounded-md transition-all duration-200 ${
//                                     activeItem === childItem.id
//                                       ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-sm"
//                                       : "bg-muted/50"
//                                   }`}
//                                 >
//                                   <childItem.icon className="h-3 w-3" />
//                                 </div>
//                                 <span className="text-sm">{childItem.label}</span>
//                               </div>
//                             </Button>
//                           ))}
//                         </CollapsibleContent>
//                       )}
//                     </Collapsible>
//                   ) : (
//                     <Tooltip>
//                       <TooltipTrigger asChild>
//                         <Button
//                           variant={activeItem === item.id ? "secondary" : "ghost"}
//                           className={`w-full h-12 transition-all duration-200 hover:bg-muted/50 ${
//                             isCollapsed ? "px-0 justify-center" : "justify-start px-3"
//                           } ${activeItem === item.id ? "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50" : ""}`}
//                           onClick={() => handleItemClick(item)}
//                         >
//                           <div className="flex items-center space-x-3">
//                             <div
//                               className={`p-2 rounded-lg transition-all duration-200 ${
//                                 activeItem === item.id
//                                   ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md"
//                                   : "bg-muted/70 hover:bg-muted"
//                               }`}
//                             >
//                               <item.icon className="h-4 w-4" />
//                             </div>
//                             {!isCollapsed && (
//                               <div className="flex items-center space-x-2">
//                                 <span className="font-medium text-sm">{item.label}</span>
//                                 {item.badge && (
//                                   <Badge variant="destructive" className="text-xs h-5">
//                                     {item.badge}
//                                   </Badge>
//                                 )}
//                               </div>
//                             )}
//                           </div>
//                         </Button>
//                       </TooltipTrigger>

//                       {isCollapsed && (
//                         <TooltipContent side="right" className="font-medium">
//                           {item.label}
//                         </TooltipContent>
//                       )}
//                     </Tooltip>
//                   )}
//                 </div>
//               ))}
//             </nav>
//           </ScrollArea>

//           {/* Resize Handle */}
//           {!isCollapsed && (
//             <div
//               className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors duration-200 group"
//               onMouseDown={handleMouseDown}
//             >
//               <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm" />
//             </div>
//           )}
//         </div>
//       </TooltipProvider>

//       {/* Mobile Overlay */}
//       {sidebarOpen && (
//         <div
//           className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
//           onClick={() => setSidebarOpen?.(false)}
//         />
//       )}
//     </>
//   );
// };

// export default Sidebar;
import React, { useState, useEffect } from "react";
import { Home, X, LogOut, BarChart3, Users,ShoppingCart,Calendar, Settings,
         ChevronDown, ChevronRight,Menu,Building2,GitBranch, Network,FileText, ShieldCheck,
        Package,Globe, Search, Bell, User, DollarSign, Eye, Plus, Edit, Trash,} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppState } from "@/globalState/hooks/useAppState";
import useFetch from "@/hooks/useFetchHook";
type IconComponent = React.ComponentType<{ className?: string }>;

interface ChildItem {
  id: string;
  label: string;
  icon: IconComponent;
  badge?: string | number;
}

interface MenuItem {
  id: string;
  label: string;
  icon: IconComponent;
  badge?: string | number;
  children?: ChildItem[];
}

// Define types for API response
interface Screen {
  screen_name: string;
  screen_id: number;
  permissions: { permission_id: number; permission_name: string }[];
}

interface PermissionData {
  companies: { com_name: string; com_sno: number }[];
  divisions: { div_name: string; com_sno: number }[];
  branches: { brn_name: string; brn_sno: number }[];
  screens: Screen[];
}




const Sidebar: React.FC = () => {
  const [isResizing, setIsResizing] = useState<boolean>(false);
   const {
    sidebarOpen,
    setSidebarOpen,
    expandedItems,
    setExpandedItems,
    activeItem,
    setActiveItem,
    activeComponent,
    setActiveComponent,
    sidebarWidth,
    setSidebarWidth,
    isCollapsed,
    userData,
    setIsCollapsed,
    toggleCollapse,
    setHeaderComponentRender,
  } = useAppState() as any;
  const ecno = userData?.[0]?.ecno ?? '';
  // Only fetch when we have a valid ecno; passing null skips the fetch entirely
  const { data, loading, error } = useFetch<PermissionData>(
    ecno
      ? `${import.meta.env.VITE_API_URL}/api/user_approval/get_user_screens_and_permisssions/${ecno}`
      : null
  );

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
console.log(menuItems)
  useEffect(() => {
    if (data && data.screens) {
      const mappedItems = data.screens.map((screen: Screen) => ({
        id: screen.screen_name.toLowerCase().replace(/\s+/g, ""),
        label: screen.screen_name,
        icon: getIconForScreen(screen.screen_name),
        badge: screen.permissions.length,
        children: screen.permissions.map((perm: { permission_id: number; permission_name: string }) => ({
          id: `${screen.screen_name.toLowerCase().replace(/\s+/g, "")}_${perm.permission_name.toLowerCase()}`,
          label: perm.permission_name,
          icon: getIconForPermission(perm.permission_name),
        })),
      }));
      setMenuItems(mappedItems);
    } else {
      // Clear stale menus when there's no data (e.g. after logout)
      setMenuItems([]);
    }
  }, [data]);

  // Icon mapping functions
  const getIconForScreen = (name: string): IconComponent => {
    switch (name) {
      case "Budget Request":
        return DollarSign;
      case "HOD Approval":
        return Users;
      case "Purchase Requisition":
        return ShoppingCart;
      default:
        return FileText;
    }
  };

  const getIconForPermission = (name: string): IconComponent => {
    switch (name) {
      case "View":
        return Eye;
      case "Create":
        return Plus;
      case "Edit":
        return Edit;
      case "Delete":
        return Trash;
      default:
        return FileText;
    }
  };

  // Cast to any until you provide a typed return for useAppState
 

  const toggleExpanded = (itemId: string) => {
    if (typeof setExpandedItems === "function") {
      setExpandedItems((prev: Record<string, boolean>) => ({
        ...prev,
        [itemId]: !prev[itemId],
      }));
    }
  };

  const handleItemClick = (item: MenuItem, childItem?: ChildItem | null) => {
    console.log("Clicked item:", item, childItem);
    if (childItem) {
      setActiveItem?.(childItem.id);
      setActiveComponent?.(childItem.id);
      setHeaderComponentRender?.(childItem.label);
    } else if (item.children && item.children.length > 0) {
      toggleExpanded(item.id);
    } else {
      setActiveItem?.(item.id);
      setActiveComponent?.(item.id);
      setHeaderComponentRender?.(item.label);

      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarOpen?.(false);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (typeof setSidebarWidth === "function" && newWidth >= 280 && newWidth <= 450) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <TooltipProvider>
        <div
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed lg:translate-x-0 lg:inset-0 z-50 bg-background/95 backdrop-blur-md border-r border-border/50 transform transition-all 
             duration-300 ease-in-out h-screen flex flex-col shadow-xl lg:shadow-sm`}
          style={{ width: isCollapsed ? "80px" : `${sidebarWidth}px` }}
        >
          <div className="p-4 border-b border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleCollapse}
                      className="hidden lg:flex h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  </TooltipContent>
                </Tooltip>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen?.(false)}
                  className="lg:hidden h-8 w-8 p-0 hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <div key={item.id}>
                  {item.children && item.children.length > 0 ? (
                    <Collapsible
                      open={!!expandedItems?.[item.id]}
                      onOpenChange={() => toggleExpanded(item.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant={activeItem === item.id ? "secondary" : "ghost"}
                          className={`w-full justify-between h-12 transition-all duration-200 hover:bg-muted/50 ${
                            isCollapsed ? "px-0 justify-center" : "px-3"
                          } ${activeItem === item.id ? "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50" : ""}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`p-2 rounded-lg transition-all duration-200 ${
                                activeItem === item.id
                                  ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md"
                                  : "bg-muted/70 hover:bg-muted"
                              }`}
                            >
                              <item.icon className="h-4 w-4" />
                            </div>
                            {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                          </div>
                          {!isCollapsed && (
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 ${expandedItems?.[item.id] ? "rotate-90" : ""}`}
                            />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      {/* {!isCollapsed && (
                        <CollapsibleContent className="space-y-1 ml-4 mt-2">
                          {item.children.map((childItem) => (
                            <Button
                              key={childItem.id}
                              variant={activeItem === childItem.id ? "secondary" : "ghost"}
                              className={`w-full justify-start h-10 transition-all duration-200 hover:bg-muted/50 ${
                                activeItem === childItem.id ? "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50" : ""
                              }`}
                              onClick={() => handleItemClick(item, childItem)}
                            >
                              <div className="flex items-center space-x-3">
                                <div
                                  className={`p-1.5 rounded-md transition-all duration-200 ${
                                    activeItem === childItem.id
                                      ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-sm"
                                      : "bg-muted/50"
                                  }`}
                                >
                                  <childItem.icon className="h-3 w-3" />
                                </div>
                                <span className="text-sm">{childItem.label}</span>
                              </div>
                            </Button>
                          ))}
                        </CollapsibleContent>
                      )} */}
                    </Collapsible>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={activeItem === item.id ? "secondary" : "ghost"}
                          className={`w-full h-12 transition-all duration-200 hover:bg-muted/50 ${
                            isCollapsed ? "px-0 justify-center" : "justify-start px-3"
                          } ${activeItem === item.id ? "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50" : ""}`}
                          onClick={() => handleItemClick(item)}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`p-2 rounded-lg transition-all duration-200 ${
                                activeItem === item.id
                                  ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md"
                                  : "bg-muted/70 hover:bg-muted"
                              }`}
                            >
                              <item.icon className="h-4 w-4" />
                            </div>
                            {!isCollapsed && (
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">{item.label}</span>
                                {item.badge && (
                                  <Badge variant="destructive" className="text-xs h-5">
                                    {item.badge}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </Button>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right" className="font-medium">
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}
                </div>
              ))}
            </nav>
          </ScrollArea>

          {!isCollapsed && (
            <div
              className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors duration-200 group"
              onMouseDown={handleMouseDown}
            >
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm" />
            </div>
          )}
        </div>
      </TooltipProvider>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen?.(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
