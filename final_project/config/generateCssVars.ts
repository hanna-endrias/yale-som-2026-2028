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
  for (const [key, value] of Object.entries(brand.type)) vars[`--brand-text-${key}`] = value;
  for (const [key, value] of Object.entries(brand.spacing)) vars[`--brand-space-${key}`] = value;
  for (const [key, value] of Object.entries(brand.radius)) vars[`--brand-radius-${key}`] = value;
  return Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
}

export function brandStyleSheet(): string {
  return `:root { ${generateCssVars('light')} }
@media (prefers-color-scheme: dark) { :root { ${generateCssVars('dark')} } }`;
}
