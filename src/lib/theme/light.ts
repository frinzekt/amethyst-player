import type { ThemeColors } from './dark';

export const lightTheme: ThemeColors = {
  // Light backgrounds (white to light gray)
  bg1: '#ffffff',    // Lightest
  bg2: '#f8f9fa',    // Light
  bg3: '#e9ecef',    // Medium
  bg4: '#dee2e6',    // Darker
  bg5: '#ced4da',    // Darkest gray

  // Text colors (dark to medium gray)
  text1: '#212529',  // Darkest text
  text2: '#6c757d',  // Medium text

  // Special colors
  selected: '#b0b5bd', // Darker shade of gray
  enabled: '#4caf50',        // Darker green for active states
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.3)',
  
  // Device colors
  deviceBody: '#141414',
  deviceBorder: '#282828',
  deviceButton: '#808080',
  deviceButtonOverlay: '#141414',
} as const;