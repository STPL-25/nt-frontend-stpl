import { describe, expect, it } from 'vitest';
import { addDaysIso, amountInWords, formatRange, rateText } from '@/CustomComponent/LoanComponents/loanUtils';
import { ordinalDay, emptyStatutory, validateStatutory } from '@/CustomComponent/ServiceComponents/serviceUtils';

describe('amountInWords (Indian system)', () => {
  it('spells out lakhs, thousands and paise', () => {
    expect(amountInWords(114602.74)).toBe('Rupees One Lakh Fourteen Thousand Six Hundred Two and Paise Seventy Four Only');
  });
  it('handles crores and round amounts', () => {
    expect(amountInWords(12_500_000)).toBe('Rupees One Crore Twenty Five Lakh Only');
    expect(amountInWords(1000)).toBe('Rupees One Thousand Only');
  });
  it('is safe on zero / junk', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only');
    expect(amountInWords('abc')).toBe('Rupees Zero Only');
  });
});

describe('ordinalDay', () => {
  it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [7, '7th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [31, '31st']])(
    '%i -> %s', (n, s) => expect(ordinalDay(n)).toBe(s),
  );
  it('returns a dash for nothing', () => expect(ordinalDay(null)).toBe('—'));
});

describe('addDaysIso', () => {
  it('moves across month and year ends without timezone drift', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysIso('2026-03-07', -1)).toBe('2026-03-06');
    expect(addDaysIso('2025-12-31T00:00:00.000Z', 1)).toBe('2026-01-01');
  });
});

describe('rate / range text', () => {
  it('shows benchmark + spread for a floating slice', () => {
    expect(rateText({ rate_pct: 14, benchmark_rate_pct: 12, spread_pct: 2 }, 'Repo')).toBe('14% (Repo 12% + 2%)');
    expect(rateText({ rate_pct: 9.5 })).toBe('9.5%');
  });
  it('collapses a one-day range', () => {
    expect(formatRange('2026-03-01', '2026-03-01')).toBe(formatRange('2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'));
  });
});

describe('validateStatutory (loan details)', () => {
  const base = () => ({
    ...emptyStatutory(), facility_type: 'LOAN' as const, sanctioned_amount: '1000000', disbursed_amount: '1000000',
    disbursement_date: '2026-01-01', interest_payment_day: '7', interest_rate_pct: '9',
  });
  it('accepts a complete fixed-rate loan', () => {
    expect(validateStatutory(base(), { start: '2026-01-01', end: '2031-01-01' })).toEqual({});
  });
  it('requires the payment day, disbursement date and amount drawn', () => {
    const e = validateStatutory({ ...base(), interest_payment_day: '32', disbursement_date: '', disbursed_amount: '' });
    expect(e.stat_interest_payment_day).toBeTruthy();
    expect(e.stat_disbursement_date).toBeTruthy();
    expect(e.stat_disbursed_amount).toBeTruthy();
  });
  it('keeps the disbursement date inside the loan term', () => {
    expect(validateStatutory(base(), { start: '2026-06-01', end: '2031-01-01' }).stat_disbursement_date).toMatch(/before the loan term starts/);
    expect(validateStatutory(base(), { start: '2020-01-01', end: '2026-01-01' }).stat_disbursement_date).toMatch(/before the loan term ends/);
  });
  it('only a cash-credit limit may start undrawn; disbursed cannot exceed sanctioned', () => {
    expect(validateStatutory({ ...base(), disbursed_amount: '0' }).stat_disbursed_amount).toBeTruthy();
    expect(validateStatutory({ ...base(), facility_type: 'CASH_CREDIT', disbursed_amount: '0' }).stat_disbursed_amount).toBeUndefined();
    expect(validateStatutory({ ...base(), disbursed_amount: '2000000' }).stat_disbursed_amount).toBeTruthy();
  });
  it('needs benchmark and spread for a floating loan', () => {
    const e = validateStatutory({ ...base(), rate_type: 'FLOATING', interest_rate_pct: '' });
    expect(e.stat_benchmark_rate_pct).toBeTruthy();
    expect(e.stat_spread_pct).toBeTruthy();
  });
});
