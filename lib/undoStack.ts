// A simple, generic undo history: an ordered list of past states, most
// recent last. No redo — popping is a one-way operation, matching what
// "Undo" means for the line-break editor this was built for.

export function pushUndoState<T>(history: T[], previous: T): T[] {
  return [...history, previous];
}

// Returns the most recently pushed state and the history with it removed,
// or null if there's nothing to undo.
export function popUndoState<T>(history: T[]): { value: T; history: T[] } | null {
  if (history.length === 0) return null;
  return { value: history[history.length - 1], history: history.slice(0, -1) };
}
