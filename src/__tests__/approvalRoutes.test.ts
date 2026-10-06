import { describe, it, expect } from 'vitest';
import { approvalRoutes } from '@/CustomComponent/ServiceComponents/serviceUtils';

const stage = (ecno: string, over: Record<string, string> = {}) => ({
  approver_ecno: ecno, stage: `Stage ${ecno}`, can_forward: 'Y', can_backward: 'Y', ...over,
});

describe('approvalRoutes', () => {
  const three = [stage('A'), stage('B'), stage('C')];

  it('lets a middle approver forward to the next stage and send back to earlier ones', () => {
    const r = approvalRoutes(three, 'B');
    expect(r.canForward).toBe(true);
    expect(r.forwardTo).toEqual({ ecno: 'C', stage: 'Stage C' });
    expect(r.canSendBack).toBe(true);
    expect(r.sendBackOptions).toEqual([{ ecno: 'A', stage: 'Stage A' }]);
  });

  it('first stage cannot send back, last stage cannot forward', () => {
    expect(approvalRoutes(three, 'A').canSendBack).toBe(false);
    expect(approvalRoutes(three, 'C').canForward).toBe(false);
    expect(approvalRoutes(three, 'C').sendBackOptions.map((o) => o.ecno)).toEqual(['A', 'B']);
  });

  it('honours the stage flags', () => {
    const flagged = [stage('A'), stage('B', { can_forward: 'N', can_backward: 'N' }), stage('C')];
    const r = approvalRoutes(flagged, 'B');
    expect(r.canForward).toBe(false);
    expect(r.canSendBack).toBe(false);
  });

  it('a single-stage workflow offers neither', () => {
    const r = approvalRoutes([stage('A')], 'A');
    expect(r.canForward).toBe(false);
    expect(r.canSendBack).toBe(false);
  });

  it('offers nothing to someone who is not in the workflow', () => {
    expect(approvalRoutes(three, 'Z')).toMatchObject({ canForward: false, canSendBack: false, forwardTo: null });
    expect(approvalRoutes(three, undefined).canForward).toBe(false);
    expect(approvalRoutes([], 'A').canForward).toBe(false);
  });
});
