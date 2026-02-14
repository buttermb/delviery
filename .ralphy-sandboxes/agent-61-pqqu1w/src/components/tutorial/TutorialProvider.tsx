import { createContext, useContext, ReactNode } from 'react';
import { useTutorial, TutorialState } from './useTutorial';

interface TutorialContextType {
  state: TutorialState;
  isTutorialCompleted: (tutorialId: string) => boolean;
  startTutorial: (tutorialId: string, force?: boolean) => boolean;
  nextStep: () => void;
  previousStep: () => void;
  skip: () => void;
  complete: () => void;
  resetTutorial: (tutorialId: string) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const tutorial = useTutorial();

  return (
    <TutorialContext.Provider value={tutorial}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorialContext() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorialContext must be used within TutorialProvider');
  }
  return context;
}

