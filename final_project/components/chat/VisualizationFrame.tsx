'use client';

import { useEffect, useRef, useState } from 'react';

// No network, no external code: only inline script/style and data: images. Together with the sandbox
// (scripts and popups only, no same-origin), LLM-written HTML can't read cookies, call the API or
// reach the parent page, even if a stored mention smuggled instructions into it.
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:";

// Theme roles the visualizer prompt uses, read from the app's brand CSS vars at render time.
const VARS: Record<string, string> = {
  '--bg': '--brand-color-background',
  '--text': '--brand-color-text',
  '--muted': '--brand-color-muted',
  '--panel': '--brand-color-panel',
  '--border': '--brand-color-border',
  '--accent': '--brand-color-accent-text',
  '--positive': '--brand-chart-positive',
  '--neutral': '--brand-chart-neutral',
  '--negative': '--brand-color-destructive',
};

// Reports the content height on load and on every resize, so the frame grows to fit (postMessage is allowed from the sandbox).
const RESIZE_SCRIPT = `<script>(function(){var s=function(){parent.postMessage({perspectivesVizHeight:Math.ceil(document.documentElement.getBoundingClientRect().height)},'*')};s();addEventListener('load',s);new ResizeObserver(s).observe(document.documentElement);})();</script>`;

function buildDoc(html: string): string {
  const root = getComputedStyle(document.documentElement);
  const vars = Object.entries(VARS)
    .map(([name, brandVar]) => `${name}: ${root.getPropertyValue(brandVar).trim()};`)
    .join(' ');
  const head = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><style>:root { ${vars} color-scheme: light dark; }</style>`;
  // The CSP meta must be inside <head> to apply; insert after an existing <head>, else before everything.
  // The resize script goes last, once <body> exists for its ResizeObserver.
  const withHead = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : head + html;
  return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${RESIZE_SCRIPT}</body>`) : withHead + RESIZE_SCRIPT;
}

export default function VisualizationFrame({ title, html }: { title: string; html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => setDoc(buildDoc(html)), [html]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const h = e.data?.perspectivesVizHeight;
      // A frame that hasn't been painted yet (e.g. in a background tab) reports 0; keep the current height until a real one arrives.
      if (e.source === ref.current?.contentWindow && typeof h === 'number' && h > 40) setHeight(Math.min(h, 900));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <figure className="w-full overflow-hidden rounded-md border border-border" data-testid="visualization">
      <figcaption className="border-b border-border bg-panel px-sm py-xs text-xs font-semibold">{title}</figcaption>
      {doc && (
        <iframe
          ref={ref}
          title={`Chart: ${title}`}
          srcDoc={doc}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          className="block w-full border-0"
          style={{ height }}
        />
      )}
    </figure>
  );
}
