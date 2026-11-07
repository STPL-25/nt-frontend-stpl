import { describe, it, expect } from 'vitest';
import {
  AGREEMENT_TYPE_LABEL, diffTerms, emptyStatutoryDue, isStatutoryAgreement, statutoryDueFromRow, statutoryDuePayload,
  statutoryDueProblem, statutoryDueSummary, termsFromRow,
} from '@/CustomComponent/ServiceComponents/serviceUtils';

describe('Statutory agreement helpers (backend sql/157)', () => {
  it('knows the Statutory type and labels it', () => {
    expect(isStatutoryAgreement('STATUTORY')).toBe(true);
    expect(isStatutoryAgreement('FIXED_RECURRING')).toBe(false);
    expect(isStatutoryAgreement(undefined)).toBe(false);
    expect(AGREEMENT_TYPE_LABEL.STATUTORY).toBe('Statutory');
  });

  it('a new form starts on Others / Unfixed with the default payee', () => {
    expect(emptyStatutoryDue()).toEqual({ kind: 'OTHER', amount_type: 'UNFIXED', payee_sno: '', reference_no: '' });
  });

  it('turns the form into the body the SP expects: numbers for the payee, null for blanks, trimmed reference', () => {
    expect(statutoryDuePayload({ kind: 'GST', amount_type: 'FIXED', payee_sno: '12', reference_no: '  33ABCDE1234F1Z5 ' }))
      .toEqual({ kind: 'GST', amount_type: 'FIXED', payee_sno: 12, reference_no: '33ABCDE1234F1Z5' });
    expect(statutoryDuePayload(emptyStatutoryDue())).toEqual({ kind: 'OTHER', amount_type: 'UNFIXED', payee_sno: null, reference_no: null });
  });

  it('reads a list row back into the form, defaulting an unknown value to Others / Unfixed', () => {
    expect(statutoryDueFromRow({ kind: 'GST', amount_type: 'FIXED', payee_sno: 7, reference_no: 'R1' }))
      .toEqual({ kind: 'GST', amount_type: 'FIXED', payee_sno: '7', reference_no: 'R1' });
    expect(statutoryDueFromRow(undefined)).toEqual(emptyStatutoryDue());
    expect(statutoryDueFromRow({ payee_sno: null })).toEqual(emptyStatutoryDue());
  });

  it('statutoryDueProblem asks for a valid tab, Fixed / Unfixed and a reference within 40 characters', () => {
    expect(statutoryDueProblem({ kind: 'OTHER', amount_type: 'FIXED' })).toBe('');
    expect(statutoryDueProblem({ kind: 'GST', amount_type: 'UNFIXED', reference_no: 'x'.repeat(40) })).toBe('');
    expect(statutoryDueProblem(undefined)).toMatch(/Others or GST/);
    expect(statutoryDueProblem({ kind: 'TDS', amount_type: 'FIXED' })).toMatch(/Others or GST/);
    expect(statutoryDueProblem({ kind: 'OTHER', amount_type: 'SOMETIMES' })).toMatch(/Fixed or Unfixed/);
    expect(statutoryDueProblem({ kind: 'OTHER', amount_type: 'FIXED', reference_no: 'x'.repeat(41) })).toMatch(/40 characters/);
  });

  it('summarises where the dues are paid in one line', () => {
    expect(statutoryDueSummary({ kind: 'OTHER', amount_type: 'UNFIXED', payee_name: 'EPFO' })).toBe('Others tab · Unfixed amount · pay to EPFO');
    expect(statutoryDueSummary({ kind: 'GST', amount_type: 'FIXED' })).toBe('GST tab · Fixed amount · pay to the default GST payee');
    expect(statutoryDueSummary(null)).toBe('');
  });

  it('shows a change of tab, amount type or payee in the approval change summary', () => {
    const prev = termsFromRow({ statutory_due: { kind: 'OTHER', amount_type: 'UNFIXED', payee_sno: 4, payee_name: 'EPFO', reference_no: 'A' } });
    const same = termsFromRow({ statutory_due: { kind: 'OTHER', amount_type: 'UNFIXED', payee_sno: 4, payee_name: 'EPFO', reference_no: 'A' } });
    expect(diffTerms(prev, same)).toEqual([]);
    const cur = termsFromRow({ statutory_due: { kind: 'GST', amount_type: 'FIXED', payee_sno: null, payee_name: null, reference_no: 'B' } });
    const labels = diffTerms(prev, cur).map((c) => c.label);
    expect(labels).toEqual(['Paid on Statutory Payments', 'Amount', 'Pay to', 'Reference no.']);
    expect(diffTerms(prev, cur).find((c) => c.label === 'Pay to')).toMatchObject({ from: 'EPFO', to: 'Default payee' });
  });

  it('a Fixed / Unfixed agreement has no statutory part to compare', () => {
    const a = termsFromRow({ service_name: 'Rent' });
    expect(diffTerms(a, termsFromRow({ service_name: 'Rent' }))).toEqual([]);
  });
});
