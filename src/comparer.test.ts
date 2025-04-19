import { describe, it, expect } from 'vitest';
import { compareJson } from './comparer.js'; // Use .js extension for ESM imports

describe('compareJson', () => {
  it('should return null when objects are identical', () => {
    const oldState = { a: 1, b: 'hello' };
    const newState = { a: 1, b: 'hello' };
    expect(compareJson(oldState, newState)).toBeNull();
  });

  it('should return null when objects have same keys/values but different order', () => {
    const oldState = { a: 1, b: 'hello' };
    const newState = { b: 'hello', a: 1 };
    // fast-json-stable-stringify handles key order normalization
    expect(compareJson(oldState, newState)).toBeNull();
  });

  it('should detect added properties', () => {
    const oldState = { a: 1 };
    const newState = { a: 1, b: 'new' };
    const changes = compareJson(oldState, newState);
    expect(changes).toHaveLength(1);
    expect(changes?.[0]).toMatchObject({ value: '  "b": "new"\n', added: true });
  });

  it('should detect removed properties', () => {
    const oldState = { a: 1, b: 'remove' };
    const newState = { a: 1 };
    const changes = compareJson(oldState, newState);
    expect(changes).toHaveLength(1);
    expect(changes?.[0]).toMatchObject({ value: '  "b": "remove"\n', removed: true });
  });

  it('should detect modified properties', () => {
    const oldState = { a: 1, b: 'old' };
    const newState = { a: 1, b: 'new' };
    const changes = compareJson(oldState, newState);
    expect(changes?.length).toBeGreaterThanOrEqual(2);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '  "b": "old"\n', removed: true }),
        expect.objectContaining({ value: '  "b": "new"\n', added: true }),
      ])
    );
  });

  it('should detect changes in nested objects', () => {
    const oldState = { data: { value: 10 } };
    const newState = { data: { value: 20 } };
    const changes = compareJson(oldState, newState);
    expect(changes?.length).toBeGreaterThanOrEqual(2);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '    "value": 10\n', removed: true }),
        expect.objectContaining({ value: '    "value": 20\n', added: true }),
      ])
    );
  });

  it('should detect changes in arrays', () => {
    const oldState = { items: [1, 2, 3] };
    const newState = { items: [1, 2, 4] };
    const changes = compareJson(oldState, newState);
    expect(changes?.length).toBeGreaterThanOrEqual(2);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '    3\n', removed: true }),
        expect.objectContaining({ value: '    4\n', added: true }),
      ])
    );
  });
}); 