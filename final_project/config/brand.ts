// Single source of truth for colors, fonts, and sizing (docs/ARCHITECTURE.md §1).
// Palette: "Graphite and lime". Lime button with near-black text in both
// themes; light-mode links use dark olive. Contrast checked: text on background/panel and onButton on button >= 4.5:1,
// accentText >= 4.5:1 on background and panel, in both themes.
export const brand = {
  palette: {
    primary: '#B6E03A',
    secondary: '#4E6B0C',
    neutral: '#9A9D98',
    white: '#FFFFFF',
  },
  themes: {
    light: {
      background: '#FFFFFF', text: '#121410', panel: '#F1F3EC', muted: '#62665E',
      border: '#DFE3D6', accentText: '#4E6B0C', accentHover: '#3A5108',
      button: '#B6E03A', buttonHover: '#A2CB28', onButton: '#141A05', focus: '#4E6B0C', destructive: '#C62828',
    },
    dark: {
      background: '#0D0E0F', text: '#F1F2F0', panel: '#18191B', muted: '#9A9D98',
      border: '#2A2C2E', accentText: '#CFF07A', accentHover: '#E2F8A8',
      button: '#B6E03A', buttonHover: '#C8EA62', onButton: '#141A05', focus: '#CFF07A', destructive: '#F87171',
    },
  },
  // Sentiment fills for charts (VisualizationFrame's --positive / --neutral; --negative is destructive).
  // Positive is a teal-green so it stays distinct from the lime accent; both are >= 3:1 on either background.
  chart: { positive: '#1F9D74', neutral: '#8A8D87' },
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
