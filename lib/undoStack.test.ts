import { pushUndoState, popUndoState } from './undoStack';

describe('pushUndoState', () => {
  it('appends to an empty history', () => {
    expect(pushUndoState([], 'a')).toEqual(['a']);
  });

  it('appends after existing entries, preserving order', () => {
    expect(pushUndoState(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original array', () => {
    const history = ['a'];
    pushUndoState(history, 'b');
    expect(history).toEqual(['a']);
  });
});

describe('popUndoState', () => {
  it('returns null for an empty history', () => {
    expect(popUndoState([])).toBeNull();
  });

  it('returns the most recently pushed value', () => {
    const result = popUndoState(['a', 'b', 'c']);
    expect(result).not.toBeNull();
    expect(result!.value).toBe('c');
  });

  it('returns the history with that value removed', () => {
    const result = popUndoState(['a', 'b', 'c']);
    expect(result!.history).toEqual(['a', 'b']);
  });

  it('does not mutate the original array', () => {
    const history = ['a', 'b'];
    popUndoState(history);
    expect(history).toEqual(['a', 'b']);
  });

  it('works generically with non-primitive values like Sets', () => {
    const setA = new Set([1, 2]);
    const setB = new Set([3]);
    const result = popUndoState([setA, setB]);
    expect(result!.value).toBe(setB);
    expect(result!.history).toEqual([setA]);
  });
});
