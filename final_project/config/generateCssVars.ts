import { brand, type ThemeName } from './brand';

// camelCase role name -> kebab-case CSS var suffix (accentText -> accent-text)
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// Emits brand tokens as --brand-* custom properties. app/globals.css maps Tailwind's
// theme (bg-background, text-xl, p-md, rounded-lg, ...) onto these vars.
export function generateCssVars(theme: ThemeName): string {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(brand.themes[theme])) {
    vars[`--brand-color-${kebab(key)}`] = value;
  }
  for (const [key, value] of Object.entries(brand.chart)) vars[`--brand-chart-${kebab(key)}`] = value;
  for (const [key, value] of Object.entries(brand.type)) vars[`--brand-text-${key}`] = value;
  for (const [key, value] of Object.entries(brand.spacing)) vars[`--brand-space-${key}`] = value;
  for (const [key, value] of Object.entries(brand.radius)) vars[`--brand-radius-${key}`] = value;
  return Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
}

// Light on :root, dark when <html data-theme="dark">, and dark under the OS setting for "system".
// color-scheme follows the theme so native controls (selects, scrollbars) match.
export function brandStyleSheet(): string {
  return `:root { color-scheme: light; ${generateCssVars('light')} }
[data-theme="dark"] { color-scheme: dark; ${generateCssVars('dark')} }
@media (prefers-color-scheme: dark) { [data-theme="system"] { color-scheme: dark; ${generateCssVars('dark')} } }`;
}
