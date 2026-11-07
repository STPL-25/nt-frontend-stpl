import { Building2, Layers, MapPin, Network, type LucideIcon } from "lucide-react";
import type { NodeLevel } from "./orgDashboardModel";

/** One icon per organisation level - always shown next to the level's name, so level is never told by colour alone. */
export const LEVEL_ICON: Record<NodeLevel, LucideIcon> = { company: Building2, division: Network, branch: MapPin, department: Layers };
