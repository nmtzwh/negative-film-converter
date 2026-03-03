import { useState, useCallback, useRef } from 'react';

export interface AppState {
  exposure: number;
  baseColor: number[] | null;
  baseColorSamples: number[][];
  crop: number[] | null;
}

export function useHistory(initialState: AppState) {
  const [history, setHistory] = useState<AppState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Track if we are currently undoing/redoing so we don't push that as a new state
  const isTimeTraveling = useRef(false);

  const pushState = useCallback((newState: AppState) => {
    if (isTimeTraveling.current) {
      isTimeTraveling.current = false;
      return;
    }

    setHistory(prev => {
      // If we are not at the end of history, slice it to the current index
      const historyUpToCurrent = prev.slice(0, currentIndex + 1);
      
      // Don't push if the state is identical to the current one
      const currentState = historyUpToCurrent[historyUpToCurrent.length - 1];
      if (JSON.stringify(currentState) === JSON.stringify(newState)) {
        return prev;
      }
      
      // Keep a max of 50 history states to avoid memory bloat
      const newHistory = [...historyUpToCurrent, newState];
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    
    setCurrentIndex(prev => Math.min(prev + 1, 50));
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      isTimeTraveling.current = true;
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      isTimeTraveling.current = true;
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);

  const resetHistory = useCallback((newState: AppState) => {
    setHistory([newState]);
    setCurrentIndex(0);
    isTimeTraveling.current = false;
  }, []);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { pushState, undo, redo, resetHistory, canUndo, canRedo };
}
