export const darkTheme = {
  // Dark backgrounds (darkest to lighter)
  bg1: '#141414',    // Darkest background
  bg2: '#1d1d1d',    // Dark
  bg3: '#282828',    // Medium
  bg4: '#323232',    // Lighter
  

  // Text colors (light to medium)
  text1: '#cbcbcb',  // Light text
  text2: '#808080',  // Medium text

  // Special colors
  selected: '#141414',
  enabled: '#67e953',        // Green for active states
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.48)',
  
  // Device colors
  deviceBody: '#141414',
  deviceBorder: '#202020',
  deviceButton: '#808080',
  deviceButtonOverlay: '#141414',
} as const;

export type ThemeColors = typeof darkTheme;