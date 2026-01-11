import { darkTheme } from './dark';
import { lightTheme } from './light';
import type { ThemeColors } from './dark';

export { darkTheme, lightTheme };
export type { ThemeColors };

export const themes = {
  dark: darkTheme,
  light: lightTheme
} as const;

export type ThemeName = keyof typeof themes;