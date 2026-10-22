import Storage from 'expo-sqlite/kv-store';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ImageSourcePropType, Platform, useColorScheme } from 'react-native';

export const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

/** Shown on the memory card when no photo was added. */
export const DEFAULT_MEMORY_IMAGE = require('@/assets/default-memory.png');

const BACKGROUNDS = {
  light: require('@/assets/background.png'),
  dark: require('@/assets/background-dark.png'),
};

const LIGHT = {
  brand: '#6B3215',
  onBrand: '#FFFDFA',
  accent: '#C37439',
  ink: '#211A17',
  inkSoft: '#6F625B',
  muted: '#7A6D66',
  surface: '#FFFDFA',
  surfaceTint: '#F6E7DB',
  border: '#F1E5DC',
  background: '#FCF6F0',
  danger: '#B5482E',
  dangerBg: '#FBE9E6',
  hint: '#A39A94',
  photoFg: '#4B3FA8',
  photoBg: '#EEEBFA',
  cardBg: 'rgba(255, 253, 250, 0.96)',
  chip: '#F6F1EC',
  placeholder: '#E7DED6',
  faint: '#C9BCB3',
  body: '#4D433D',
  onTint: '#5C463A',
  micOuter: '#FDF1E7',
  micInner: '#F9E1CF',
  waveActive: '#E3A67B',
  waveIdle: '#F6D9C6',
  record: '#B5482E',
  success: '#3F8F6B',
  recordedBg: '#FBE6D6',
  tagBg: '#EEE5F5',
  tagText: '#6E438A',
  ratingBg: '#FFF0D7',
  ratingText: '#9A6B20',
  star: '#D99A32',
};

export type Palette = Record<keyof typeof LIGHT, string>;

const DARK: Palette = {
  brand: '#E3AC7C',
  onBrand: '#1E1511',
  accent: '#D98B4A',
  ink: '#F6E9DD',
  inkSoft: '#C9B8AB',
  muted: '#A39489',
  surface: '#221A1D',
  surfaceTint: '#32262A',
  border: '#33282B',
  background: '#161013',
  danger: '#E0705A',
  dangerBg: '#40251F',
  hint: '#7C6F68',
  photoFg: '#B9B0F0',
  photoBg: '#2D2A45',
  cardBg: 'rgba(34, 26, 29, 0.96)',
  chip: '#2E2428',
  placeholder: '#3A2F2F',
  faint: '#5E524D',
  body: '#D9CBC0',
  onTint: '#E8D3C2',
  micOuter: '#2B2024',
  micInner: '#3A2A2B',
  waveActive: '#D98B4A',
  waveIdle: '#4A3636',
  record: '#D2573A',
  success: '#5DB08B',
  recordedBg: '#4A3022',
  tagBg: '#3A2C47',
  tagText: '#CDAEE6',
  ratingBg: '#46361E',
  ratingText: '#E9BE78',
  star: '#E5A93F',
};

/** @deprecated Light palette kept so old imports still compile. Use useTheme().colors. */
export const COLORS: Palette = LIGHT;

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeValue = {
  colors: Palette;
  scheme: 'light' | 'dark';
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  backgroundImage: ImageSourcePropType;
};

const KEY = 'theme-preference';
const Ctx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Synchronous read → no flash of the wrong theme on launch.
  const [preference, setPref] = useState<ThemePreference>(() => {
    const v = Storage.getItemSync(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  });
  const system = useColorScheme();

useEffect(() => {
  Appearance.setColorScheme(
    preference === 'system' ? 'unspecified' : preference
  );
}, [preference]);

const scheme: 'light' | 'dark' =
  preference === 'system'
    ? system === 'dark'
      ? 'dark'
      : 'light'
    : preference;
  const value = useMemo<ThemeValue>(
    () => ({
      colors: scheme === 'dark' ? DARK : LIGHT,
      scheme,
      isDark: scheme === 'dark',
      preference,
      setPreference: (p) => {
        setPref(p);
        Storage.setItemSync(KEY, p);
      },
      backgroundImage: BACKGROUNDS[scheme],
    }),
    [scheme, preference],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}