import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type WorkoutPhase = 'idle' | 'active' | 'summary';

type WorkoutPhaseContextType = {
  phase: WorkoutPhase;
  setPhase: (p: WorkoutPhase) => void;
};

const WorkoutPhaseContext = createContext<WorkoutPhaseContextType>({
  phase: 'idle',
  setPhase: () => {},
});

export function WorkoutPhaseProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<WorkoutPhase>('idle');

  const setPhase = useCallback((p: WorkoutPhase) => setPhaseState(p), []);

  return (
    <WorkoutPhaseContext.Provider value={{ phase, setPhase }}>
      {children}
    </WorkoutPhaseContext.Provider>
  );
}

export function useWorkoutPhase() {
  return useContext(WorkoutPhaseContext);
}
