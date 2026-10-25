// npm run slides:build [-- --theme dark] — wraps slides/deck.html in a reveal.js shell styled
// from config/brand.ts and inlines every image, so slides.html opens by double-click.
// Theme defaults to the `Theme:` line in slides/deck.plan.md, then light.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { brand, type ThemeName } from '../config/brand';
import { generateCssVars } from '../config/generateCssVars';

const ROOT = resolve(__dirname, '..');
const SLIDES_DIR = join(ROOT, 'slides');
const DECK = join(SLIDES_DIR, 'deck.html');
const PLAN = join(SLIDES_DIR, 'deck.plan.md');
const OUT = join(ROOT, 'slides.html');
const REVEAL = 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist';

const themeArg = process.argv.indexOf('--theme');
const planTheme = existsSync(PLAN) ? readFileSync(PLAN, 'utf8').match(/^Theme:\s*(\w+)\s*$/m)?.[1] : undefined;
const theme = (themeArg > -1 ? process.argv[themeArg + 1] : planTheme ?? 'light') as ThemeName;
if (!(theme in brand.themes)) throw new Error(`Unknown theme "${theme}" (use ${Object.keys(brand.themes).join(' | ')})`);

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

// Relative paths resolve against slides/; remote and data: URIs are left alone.
function toDataUri(path: string): string {
  if (/^(data:|https?:|#)/.test(path)) return path;
  const file = join(SLIDES_DIR, path);
  const mime = MIME[extname(file).toLowerCase()];
  if (!existsSync(file)) throw new Error(`Missing image: slides/${path}`);
  if (!mime) throw new Error(`Unsupported image type: slides/${path}`);
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

const inlineImages = (html: string) =>
  html
    .replace(/(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi, (_, pre, q, src) => `${pre}${q}${toDataUri(src)}${q}`)
    .replace(/url\((["']?)(.*?)\1\)/gi, (_, q, src) => `url(${q}${toDataUri(src)}${q})`);

const paletteVars = Object.entries(brand.palette)
  .map(([key, value]) => `--brand-palette-${key}: ${value};`)
  .join(' ');

const fontsHref =
  'https://fonts.googleapis.com/css2?' +
  [brand.fonts.heading, brand.fonts.body]
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;600;700;800`)
    .join('&') +
  '&display=swap';

// Deck styles: reveal mapped onto the same --brand-* vars the app uses. Utility classes are
// documented in .claude/skills/slide-dev/SKILL.md.
const css = `
:root { ${generateCssVars(theme)} ${paletteVars}
  --font-heading: '${brand.fonts.heading}', ui-sans-serif, system-ui, sans-serif;
  --font-body: '${brand.fonts.body}', ui-sans-serif, system-ui, sans-serif; }
html, body, .reveal-viewport { background: var(--brand-color-background); }
.reveal { font-family: var(--font-body); font-size: 34px; color: var(--brand-color-text); }
.reveal .slides { text-align: left; }
.reveal .slides section { height: 100%; box-sizing: border-box; padding: 24px 8px; }
.reveal h1, .reveal h2, .reveal h3 { font-family: var(--font-heading); font-weight: 800;
  color: var(--brand-color-text); line-height: 1.1; margin: 0 0 ${brand.spacing.lg}; letter-spacing: -0.01em; }
.reveal h1 { font-size: 2.6em; } .reveal h2 { font-size: 1.6em; } .reveal h3 { font-size: 1.05em; }
.reveal p, .reveal li { line-height: 1.35; }
.reveal ul { margin: 0 0 0 1em; } .reveal li { margin-bottom: ${brand.spacing.sm}; }
.reveal li::marker { color: var(--brand-palette-secondary); }
.reveal strong, .reveal .accent { color: var(--brand-color-accent-text); }
.reveal a { color: var(--brand-color-accent-text); }
.reveal .muted { color: var(--brand-color-muted); }
.reveal .small { font-size: 0.7em; }
.reveal .eyebrow { font-family: var(--font-heading); font-weight: 700; font-size: 0.55em; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--brand-palette-secondary); margin-bottom: ${brand.spacing.sm}; }
.reveal .lead { font-size: 1.15em; color: var(--brand-color-muted); max-width: 26em; }
.reveal .title-slide { height: 100%; display: flex; flex-direction: column; justify-content: center; }
.reveal .title-slide::before { content: ''; display: block; width: 120px; height: 10px; margin-bottom: ${brand.spacing.xl};
  border-radius: ${brand.radius.lg}; background: linear-gradient(90deg, var(--brand-palette-primary), var(--brand-palette-secondary)); }
.reveal .cols { display: grid; grid-template-columns: 1fr 1fr; gap: ${brand.spacing.xl}; align-items: center; }
.reveal .cols.wide-right { grid-template-columns: 2fr 3fr; }
.reveal .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); grid-auto-flow: column; gap: ${brand.spacing.lg}; }
.reveal .card { background: var(--brand-color-panel); border: 1px solid var(--brand-color-border);
  border-radius: ${brand.radius.lg}; padding: ${brand.spacing.lg}; font-size: 0.9em; }
.reveal .card h3 { margin-bottom: ${brand.spacing.sm}; color: var(--brand-color-accent-text); }
.reveal .stat { font-family: var(--font-heading); font-weight: 800; font-size: 2.2em; line-height: 1; white-space: nowrap;
  color: var(--brand-color-accent-text); }
.reveal .stat-label { font-size: 0.65em; color: var(--brand-color-muted); margin-top: ${brand.spacing.xs}; }
.reveal .shot { display: block; max-width: 100%; max-height: 520px; margin: 0 auto; border-radius: ${brand.radius.md};
  border: 1px solid var(--brand-color-border); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12); }
.reveal .shots { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: ${brand.spacing.lg}; }
.reveal .shots .shot { max-height: 440px; }
.reveal .caption { font-size: 0.5em; color: var(--brand-color-muted); text-align: center; margin-top: ${brand.spacing.sm}; }
.reveal .todo { display: inline-block; background: var(--brand-color-destructive); color: var(--brand-color-on-button);
  font-size: 0.55em; font-weight: 700; padding: 2px 10px; border-radius: ${brand.radius.sm}; }
.reveal svg.diagram { display: block; width: 100%; height: auto; max-height: 540px; font-family: var(--font-body); }
.reveal .progress { color: var(--brand-palette-primary); }
.reveal .controls { color: var(--brand-color-accent-text); }
.reveal .slide-number { background: transparent; color: var(--brand-color-muted); font-family: var(--font-body); }
`;

const deck = inlineImages(readFileSync(DECK, 'utf8'));
const title = deck.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1].replace(/<[^>]+>/g, '').trim() ?? 'Slides';

const html = `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref}">
<link rel="stylesheet" href="${REVEAL}/reveal.css" crossorigin="anonymous">
<style>${css}</style>
</head>
<body>
<div class="reveal"><div class="slides">
${deck}
</div></div>
<script src="${REVEAL}/reveal.js" crossorigin="anonymous"></script>
<script>
// Hash URLs (#/3) need history.replaceState, which sandboxed previews (about:srcdoc) block.
Reveal.initialize({ hash: !location.href.startsWith('about:'), width: 1280, height: 720, margin: 0.06, center: false,
  slideNumber: 'c/t', transition: 'fade', controls: true, progress: true });
</script>
</body>
</html>
`;

writeFileSync(OUT, html);
const slideCount = (deck.match(/<section\b/gi) ?? []).length;
console.log(`✓ slides.html (${theme}, ${slideCount} slides, ${(html.length / 1024).toFixed(0)} KB)`);
if (slideCount > 10) console.warn(`⚠ ${slideCount} slides — the assignment allows 10 max`);
