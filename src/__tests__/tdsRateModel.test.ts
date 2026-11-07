import { describe, it, expect } from 'vitest';
import { cleanRateInput, enteredLine, rateProblem } from '@/Application/Payment/tdsRateModel';

// Payment page TDS rate box: the digits must survive typing (the box once stripped every digit), validation, "entered by" text.

describe('cleanRateInput', () => {
  it('keeps digits - the rate box used to strip every one of them', () => {
    expect(cleanRateInput('3')).toBe('3');
    expect(cleanRateInput('10')).toBe('10');
    expect(cleanRateInput('2.5')).toBe('2.5');
  });
  it('drops letters and signs, keeps one decimal point and three decimals', () => {
    expect(cleanRateInput('2%')).toBe('2');
    expect(cleanRateInput('-3')).toBe('3');
    expect(cleanRateInput('1.2.3')).toBe('1.23');
    expect(cleanRateInput('2.12345')).toBe('2.123');
    expect(cleanRateInput('2.')).toBe('2.');
    expect(cleanRateInput('')).toBe('');
  });
});

describe('rateProblem', () => {
  it('accepts blank (the section\'s own rate) and rates from 0 to 100', () => {
    expect(rateProblem('')).toBe('');
    expect(rateProblem(undefined)).toBe('');
    expect(rateProblem('0')).toBe('');
    expect(rateProblem('2.5')).toBe('');
    expect(rateProblem('100')).toBe('');
  });
  it('refuses a rate above 100 or one that is not a number', () => {
    expect(rateProblem('100.5')).toMatch(/between 0 and 100/);
    expect(rateProblem('250')).toMatch(/between 0 and 100/);
    expect(rateProblem('.')).toMatch(/number/);
  });
});

describe('enteredLine', () => {
  it('names the login and the time', () => {
    expect(enteredLine('KTM1148', '2026-11-04 17:54:00')).toBe('KTM1148 · 04 Nov 2026 17:54');
  });
  it('says so when the rate has no recorded enterer, and shows the login alone without a time', () => {
    expect(enteredLine(null, null)).toBe('not recorded');
    expect(enteredLine('KTM1148', null)).toBe('KTM1148');
  });
});
