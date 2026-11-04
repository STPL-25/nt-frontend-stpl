import { describe, it, expect, vi } from "vitest";

// The real module opens a Socket.IO connection at import time.
vi.mock("@/Services/Socket", () => ({ socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } } }));

import { MASTER_SCREEN_PREFIX, masterScreenComp, isMasterAccessComp } from "@/globalState/hooks/usePermissions";
import { masterItems } from "@/FieldDatas/Data";

describe("per-master access rows", () => {
  it("builds the screen comp the backend seeds (sql/151)", () => {
    expect(MASTER_SCREEN_PREFIX).toBe("masters.");
    expect(masterScreenComp("CompanyMaster")).toBe("masters.CompanyMaster");
  });

  it("recognises per-master rows but not the Masters page itself", () => {
    expect(isMasterAccessComp("masters.CompanyMaster")).toBe(true);
    expect(isMasterAccessComp("Masters.CompanyMaster")).toBe(true);
    expect(isMasterAccessComp("masters")).toBe(false);
    expect(isMasterAccessComp("RoleApproval")).toBe(false);
    expect(isMasterAccessComp(null)).toBe(false);
    expect(isMasterAccessComp(undefined)).toBe(false);
  });

  it("every Masters-grid tile maps to a distinct access comp", () => {
    const comps = masterItems.map((m) => masterScreenComp(m.id));
    expect(new Set(comps).size).toBe(masterItems.length);
    expect(comps.every(isMasterAccessComp)).toBe(true);
  });
});
