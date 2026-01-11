import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { applyTheme } from '$lib/theme/utils';
import type { ThemeName } from '$lib/theme';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

// Theme preference store
export const themeMode = writable<ThemeMode>('auto');

// Resolved theme based on preference and system setting
export const theme = derived<typeof themeMode, ResolvedTheme>(
    themeMode,
    ($themeMode, set) => {
        if (!browser) {
            set('dark');
            return;
        }

        if ($themeMode === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
                const resolvedTheme = e.matches ? 'light' : 'dark';
                set(resolvedTheme);
                applyTheme(resolvedTheme);
                document.body.setAttribute('data-theme', resolvedTheme);
            };
            
            updateTheme(mediaQuery);
            mediaQuery.addEventListener('change', updateTheme);
            
            return () => {
                mediaQuery.removeEventListener('change', updateTheme);
            };
        } else {
            const resolvedTheme = $themeMode as ThemeName;
            set(resolvedTheme);
            applyTheme(resolvedTheme);
            document.body.setAttribute('data-theme', resolvedTheme);
        }
    },
    'dark' // Default value
);

// Load theme from localStorage on init
if (browser) {
    const savedTheme = localStorage.getItem('theme') as ThemeMode;
    if (savedTheme && ['auto', 'light', 'dark'].includes(savedTheme)) {
        themeMode.set(savedTheme);
    }
}

// Save theme to localStorage when it changes
themeMode.subscribe(($themeMode) => {
    if (browser) {
        localStorage.setItem('theme', $themeMode);
    }
});