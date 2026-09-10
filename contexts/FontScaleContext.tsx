import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_FONT_SCALE } from '@/lib/fontScale';

const STORAGE_KEY = 'reading_font_scale';

interface FontScaleContextValue {
  fontScale: number;
  setFontScale: (scale: number) => void;
}

export const FontScaleContext = createContext<FontScaleContextValue>({
  fontScale: DEFAULT_FONT_SCALE,
  setFontScale: () => {},
});

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState(DEFAULT_FONT_SCALE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        const parsed = parseFloat(stored);
        if (!Number.isNaN(parsed)) setFontScaleState(parsed);
      }
    });
  }, []);

  const setFontScale = (scale: number) => {
    setFontScaleState(scale);
    AsyncStorage.setItem(STORAGE_KEY, String(scale));
  };

  return (
    <FontScaleContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useFontScale() {
  return useContext(FontScaleContext);
}
