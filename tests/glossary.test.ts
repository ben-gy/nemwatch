import { describe, it, expect } from 'vitest';
import { lookupTerm, getAllTerms } from '../src/glossary.js';

describe('lookupTerm', () => {
  it('returns entry for known term', () => {
    const entry = lookupTerm('spot-price');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('Spot Price');
    expect(entry!.definition.length).toBeGreaterThan(10);
  });

  it('returns null for unknown term', () => {
    expect(lookupTerm('nonexistent')).toBeNull();
  });

  it('returns entry with abbreviation for APC', () => {
    const entry = lookupTerm('apc');
    expect(entry).not.toBeNull();
    expect(entry!.abbr).toBe('APC');
    expect(entry!.term).toBe('Administered Price Cap');
  });

  it('returns entry without abbreviation for demand', () => {
    const entry = lookupTerm('demand');
    expect(entry).not.toBeNull();
    expect(entry!.abbr).toBeNull();
  });

  it('returns entry for all expected keys', () => {
    const expectedKeys = [
      'spot-price', 'mwh', 'nem', 'nem-region', 'semi-scheduled',
      'demand', 'generation', 'interconnector', 'net-interchange',
      'apc', 'market-suspended', 'settlement-date', 'dispatch-interval',
      'price-bands',
    ];
    for (const key of expectedKeys) {
      expect(lookupTerm(key), `Missing glossary entry: ${key}`).not.toBeNull();
    }
  });
});

describe('getAllTerms', () => {
  it('returns all terms as an array', () => {
    const terms = getAllTerms();
    expect(Array.isArray(terms)).toBe(true);
    expect(terms.length).toBeGreaterThanOrEqual(14);
  });

  it('each term has key, term, definition', () => {
    for (const entry of getAllTerms()) {
      expect(entry.key).toBeTruthy();
      expect(entry.term).toBeTruthy();
      expect(entry.definition).toBeTruthy();
      expect(entry.definition.length).toBeGreaterThan(10);
    }
  });
});
