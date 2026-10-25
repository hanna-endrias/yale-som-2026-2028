// Single source of truth for colors, fonts, and sizing (docs/ARCHITECTURE.md §1).
// Palette values are placeholders until the real brand colors are picked.
export const brand = {
  palette: {
    primary: '#6D5BD0',
    secondary: '#2BB3A3',
    neutral: '#6B7280',
    white: '#FFFFFF',
  },
  themes: {
    light: {
      background: '#FFFFFF', text: '#111318', panel: '#F4F5F7', muted: '#6B7280',
      border: '#E2E4E9', accentText: '#5A48C2', accentHover: '#4A39A8',
      button: '#6D5BD0', buttonHover: '#5A48C2', onButton: '#FFFFFF', focus: '#2BB3A3', destructive: '#C62828',
    },
    dark: {
      background: '#0F1115', text: '#F2F3F5', panel: '#1A1D24', muted: '#9AA0AB',
      border: '#2A2E37', accentText: '#A99CF0', accentHover: '#C3B9F5',
      button: '#6D5BD0', buttonHover: '#8172DB', onButton: '#FFFFFF', focus: '#2BB3A3', destructive: '#F87171',
    },
  },
  fonts: {
    heading: 'Nunito',
    body: 'Instrument Sans',
  },
  type: {
    xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.5rem', '2xl': '2rem',
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  radius: { sm: '4px', md: '8px', lg: '16px' },
} as const;

export type ThemeName = keyof typeof brand.themes;

// The user's theme choice, stored in the `theme` cookie and set as <html data-theme>.
export const themeChoices = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof themeChoices)[number];
