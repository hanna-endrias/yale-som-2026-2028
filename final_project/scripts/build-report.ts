// npm run report:build — wraps report/report.src.html in a print-friendly page styled from
// config/brand.ts (light theme) and inlines every image, so report.html opens by double-click.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { brand } from '../config/brand';
import { generateCssVars } from '../config/generateCssVars';

const ROOT = resolve(__dirname, '..');
const REPORT_DIR = join(ROOT, 'report');
const SRC = join(REPORT_DIR, 'report.src.html');
const OUT = join(ROOT, 'report.html');

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

// Relative paths resolve against report/; remote and data: URIs are left alone.
function toDataUri(path: string): string {
  if (/^(data:|https?:|#)/.test(path)) return path;
  const file = join(REPORT_DIR, path);
  const mime = MIME[extname(file).toLowerCase()];
  if (!existsSync(file)) throw new Error(`Missing image: report/${path}`);
  if (!mime) throw new Error(`Unsupported image type: report/${path}`);
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

const inlineImages = (html: string) =>
  html.replace(/(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi, (_, pre, q, src) => `${pre}${q}${toDataUri(src)}${q}`);

const paletteVars = Object.entries(brand.palette)
  .map(([key, value]) => `--brand-palette-${key}: ${value};`)
  .join(' ');

const fontsHref =
  'https://fonts.googleapis.com/css2?' +
  [brand.fonts.heading, brand.fonts.body]
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;600;700;800`)
    .join('&') +
  '&display=swap';

const css = `
:root { ${generateCssVars('light')} ${paletteVars}
  --font-heading: '${brand.fonts.heading}', ui-sans-serif, system-ui, sans-serif;
  --font-body: '${brand.fonts.body}', ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
html { background: var(--brand-color-panel); }
body { font-family: var(--font-body); font-size: 15.5px; line-height: 1.55; color: var(--brand-color-text);
  max-width: 820px; margin: ${brand.spacing.xl} auto; padding: 56px 64px; background: var(--brand-color-background);
  border: 1px solid var(--brand-color-border); border-radius: ${brand.radius.lg}; }
h1, h2, h3 { font-family: var(--font-heading); font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; }
h1 { font-size: 2.6em; margin: 0 0 ${brand.spacing.sm}; }
h2 { font-size: 1.6em; margin: 2.2em 0 0.5em; padding-top: ${brand.spacing.md}; border-top: 3px solid var(--brand-color-button); }
h3 { font-size: 1.12em; margin: 1.6em 0 0.4em; }
p, li { margin: 0 0 0.75em; }
ul, ol { padding-left: 1.3em; }
li::marker { color: var(--brand-color-accent-text); }
a { color: var(--brand-color-accent-text); }
strong { font-weight: 700; }
code { font-size: 0.88em; background: var(--brand-color-panel); border: 1px solid var(--brand-color-border);
  border-radius: ${brand.radius.sm}; padding: 0 4px; }
.eyebrow { font-family: var(--font-heading); font-weight: 700; font-size: 0.8em; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--brand-color-accent-text); }
.lead { font-size: 1.2em; color: var(--brand-color-muted); }
.muted { color: var(--brand-color-muted); }
.small { font-size: 0.86em; }
.meta { display: grid; grid-template-columns: max-content 1fr; gap: 2px ${brand.spacing.md}; margin: ${brand.spacing.lg} 0; }
.meta dt { font-weight: 700; } .meta dd { margin: 0; }
table { width: 100%; border-collapse: collapse; margin: ${brand.spacing.md} 0 ${brand.spacing.lg}; font-size: 0.88em; }
th, td { text-align: left; vertical-align: top; padding: 7px 9px; border-bottom: 1px solid var(--brand-color-border); }
th { background: var(--brand-color-panel); font-weight: 700; }
td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr.us td { background: color-mix(in srgb, var(--brand-color-button) 18%, transparent); }
figure { margin: ${brand.spacing.lg} 0; break-inside: avoid; }
figure img { display: block; width: 100%; height: auto; border: 1px solid var(--brand-color-border); border-radius: ${brand.radius.md}; }
figure.half { width: 70%; margin-left: auto; margin-right: auto; }
figcaption { font-size: 0.84em; color: var(--brand-color-muted); margin-top: ${brand.spacing.sm}; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: ${brand.spacing.md}; margin: ${brand.spacing.lg} 0; }
.stat { background: var(--brand-color-panel); border: 1px solid var(--brand-color-border); border-radius: ${brand.radius.lg}; padding: ${brand.spacing.md}; }
.stat b { display: block; font-family: var(--font-heading); font-size: 1.8em; line-height: 1.1; color: var(--brand-color-accent-text); }
.stat span { font-size: 0.85em; color: var(--brand-color-muted); }
.callout { background: var(--brand-color-panel); border-left: 4px solid var(--brand-color-button);
  border-radius: ${brand.radius.md}; padding: ${brand.spacing.md} ${brand.spacing.lg}; margin: ${brand.spacing.lg} 0; }
.callout p:last-child { margin-bottom: 0; }
pre { background: var(--brand-color-panel); border: 1px solid var(--brand-color-border); border-radius: ${brand.radius.md};
  padding: ${brand.spacing.md}; font-size: 0.8em; white-space: pre-wrap; break-inside: avoid; }
svg.diagram { display: block; width: 100%; height: auto; margin: ${brand.spacing.lg} 0; font-family: var(--font-body); break-inside: avoid; }
.todo { background: var(--brand-color-destructive); color: #fff; font-weight: 700; padding: 1px 8px; border-radius: ${brand.radius.sm}; }
.toc { columns: 2; font-size: 0.95em; } .toc li { margin: 0; }
@page { size: letter; margin: 0.7in 0.75in; }
@media print {
  html { background: none; }
  body { max-width: none; margin: 0; padding: 0; border: 0; font-size: 10pt; }
  table { font-size: 0.8em; } th, td { padding: 4px 6px; }
  h2 { margin-top: 1.4em; }
  figure img { width: 66%; margin: 0 auto; }
  figure.half { width: 52%; }
  figure.half img { width: 100%; }
  figcaption { text-align: center; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25in; align-items: start; }
  .pair figure { margin: 0.1in 0; }
  .pair figure img { width: 100%; }
  h2, h3 { break-after: avoid; }
  table, .stats, .callout { break-inside: avoid; }
  a { text-decoration: none; }
}
`;

const body = inlineImages(readFileSync(SRC, 'utf8'));
const title = body.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1].replace(/<[^>]+>/g, '').trim() ?? 'Report';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref}">
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;

writeFileSync(OUT, html);
const todos = (body.match(/class="todo"/g) ?? []).length;
const images = (body.match(/<img\b/g) ?? []).length;
console.log(`✓ report.html (${images} images, ${(html.length / 1024).toFixed(0)} KB)`);
if (todos) console.warn(`⚠ ${todos} TODO placeholder(s) left`);
