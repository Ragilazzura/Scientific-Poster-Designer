
import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export const useHistory = <T>(initialState: T) => {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    setHistory((curr) => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((curr) => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // "Set": Updates current state AND pushes the *previous* state to history.
  // Use this for discrete actions like buttons (Add Section, Theme Change).
  const set = useCallback((newPresent: T) => {
    setHistory((curr) => {
      if (curr.present === newPresent) return curr;
      return {
        past: [...curr.past, curr.present],
        present: newPresent,
        future: [],
      };
    });
  }, []);

  // "Update": Updates current state WITHOUT pushing to history.
  // Use this for continuous actions like typing (onChange).
  const update = useCallback((newPresent: T) => {
    setHistory((curr) => ({
      ...curr,
      present: newPresent,
    }));
  }, []);

  // "Snapshot": Manually pushes the current state to history without changing it.
  // Use this onFocus of a text input so the state *before* typing is saved.
  const snapshot = useCallback(() => {
    setHistory((curr) => ({
      past: [...curr.past, curr.present],
      present: curr.present,
      future: [],
    }));
  }, []);

  const clear = useCallback((state: T) => {
      setHistory({
          past: [],
          present: state,
          future: []
      });
  }, []);

  return {
    state: history.present,
    set,
    update,
    snapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    clear
  };
};
