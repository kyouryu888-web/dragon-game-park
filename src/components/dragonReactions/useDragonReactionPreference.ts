import { useCallback, useEffect, useState } from 'react';
import type { DragonPresentationPreference } from './types';

const STORAGE_KEY = 'dragon-reaction-presentation';
const CHANGE_EVENT = 'dragon-reaction-presentation-change';

function isPreference(value: string | null): value is DragonPresentationPreference {
  return value === 'lively' || value === 'subtle' || value === 'off';
}

function storedPreference(): DragonPresentationPreference {
  if (typeof window === 'undefined') return 'lively';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : 'lively';
  } catch {
    return 'lively';
  }
}

export function useDragonReactionPreference() {
  const [preference, setCurrentPreference] = useState<DragonPresentationPreference>(storedPreference);

  useEffect(() => {
    const onChange = () => setCurrentPreference(storedPreference());
    window.addEventListener('storage', onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const setPreference = useCallback((next: DragonPresentationPreference) => {
    setCurrentPreference(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Private-mode storage restrictions must not affect the game.
    }
  }, []);

  return { preference, setPreference } as const;
}
