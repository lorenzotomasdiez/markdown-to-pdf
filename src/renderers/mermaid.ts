import { Window } from 'happy-dom';

let mermaidInstance: typeof import('mermaid').default | null = null;

/** Geometry stubs for happy-dom — mermaid needs these for dagre layout */
function patchElementGeometry(el: any): void {
  el.getTotalLength = () => 200;
  el.getPointAtLength = (d: number) => ({ x: d, y: 0 });
  el.getBBox = () => ({ x: 0, y: 0, width: 100, height: 40 });
  el.getComputedTextLength = () => 60;
  el.getBoundingClientRect = () => ({ x: 0, y: 0, width: 100, height: 40, top: 0, right: 100, bottom: 40, left: 0 });
}

function setupDOM(): void {
  if (typeof document !== 'undefined') return;

  const w = new Window({ url: 'https://localhost/' });

  const origCreateElement = w.document.createElement.bind(w.document);
  (w.document as any).createElement = function (tag: string, ...rest: unknown[]) {
    const el = origCreateElement(tag, ...(rest as []));
    patchElementGeometry(el);
    return el;
  };

  const origCreateElementNS = w.document.createElementNS.bind(w.document);
  (w.document as any).createElementNS = function (ns: string, tag: string, ...rest: unknown[]) {
    const el = origCreateElementNS(ns, tag, ...(rest as []));
    patchElementGeometry(el);
    return el;
  };

  Object.defineProperty(globalThis, 'window', { value: w, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: w.document, writable: true, configurable: true });
  (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0);
  (globalThis as any).cancelAnimationFrame = clearTimeout;
}

/**
 * After mermaid renders with stub geometry, the viewBox is often wrong.
 * Scan translate() transforms to find the actual bounding box and rewrite
 * the viewBox + explicit width/height on the <svg> root only.
 */
function fixSVGViewBox(svg: string, targetWidth: number): { svg: string; height: number } {
  const translateRe = /translate\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/g;
  let maxX = 100;
  let maxY = 100;

  for (const m of svg.matchAll(translateRe)) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    if (isFinite(x)) maxX = Math.max(maxX, x);
    if (isFinite(y)) maxY = Math.max(maxY, y);
  }

  // Add generous padding beyond the last node position (stub node size = 100×40)
  const contentW = maxX + 160;
  const contentH = maxY + 100;

  const aspectRatio = contentH / contentW;
  const renderHeight = Math.round(targetWidth * aspectRatio);

  // Clean up NaN/undefined transforms
  let fixed = svg
    .replace(/translate\([^)]*undefined[^)]*\)/g, 'translate(0, 0)')
    .replace(/translate\([^)]*NaN[^)]*\)/g, 'translate(0, 0)');

  // Rewrite ONLY the <svg> root element's attributes (not inner elements)
  fixed = fixed.replace(/(<svg\b[^>]*)>/, (_, svgTag) => {
    let tag = svgTag;
    // Remove max-width inline style
    tag = tag.replace(/\s+style="max-width:[^"]*"/, '');
    // Set/replace width
    if (/\bwidth="/.test(tag)) {
      tag = tag.replace(/\bwidth="[^"]*"/, `width="${targetWidth}"`);
    } else {
      tag += ` width="${targetWidth}"`;
    }
    // Set/replace height
    if (/\bheight="/.test(tag)) {
      tag = tag.replace(/\bheight="[^"]*"/, `height="${renderHeight}"`);
    } else {
      tag += ` height="${renderHeight}"`;
    }
    // Set/replace viewBox
    if (/\bviewBox="/.test(tag)) {
      tag = tag.replace(/\bviewBox="[^"]*"/, `viewBox="-8 -8 ${contentW} ${contentH}"`);
    } else {
      tag += ` viewBox="-8 -8 ${contentW} ${contentH}"`;
    }
    return `${tag}>`;
  });

  return { svg: fixed, height: renderHeight };
}

/**
 * svg-to-pdfkit ignores CSS <style> blocks — all visual properties must be
 * in inline style/attribute form.  This function applies the standard mermaid
 * "default" theme colours as inline attributes so the diagram renders correctly.
 *
 * Strategy: match whole opening tags, then replace/add style= within them.
 */
function inlineMermaidStyles(svg: string): string {
  /** Replace or add a style attribute inside an already-matched opening tag. */
  function setStyle(tag: string, newStyle: string): string {
    if (/\bstyle="/.test(tag)) {
      return tag.replace(/\bstyle="[^"]*"/, `style="${newStyle}"`);
    }
    return tag.replace(/(\/?>)$/, ` style="${newStyle}"$1`);
  }

  // Node container rectangles → light-purple fill, purple border
  svg = svg.replace(/<rect\b[^>]*\bclass="[^"]*\blabel-container\b[^"]*"[^>]*>/g, (tag) =>
    setStyle(tag, 'fill:#ECECFF;stroke:#9370DB;stroke-width:1px'),
  );

  // Background rects (used by labels) → invisible
  svg = svg.replace(/<rect\b[^>]*\bclass="[^"]*\bbackground\b[^"]*"[^>]*>/g, (tag) =>
    setStyle(tag, 'fill:none;stroke:none'),
  );

  // Edge paths (flowchart arrows) → dark-gray stroke, transparent fill
  svg = svg.replace(/<path\b[^>]*\bflowchart-link\b[^>]*>/g, (tag) =>
    setStyle(tag, 'fill:none;stroke:#333333;stroke-width:1.5px'),
  );

  // Arrow-marker path/circle shapes → solid dark fill
  svg = svg.replace(/<(?:path|circle)\b[^>]*\barrowMarkerPath\b[^>]*>/g, (tag) =>
    setStyle(tag, 'fill:#333333;stroke:#333333;stroke-width:1px'),
  );

  // Text elements → dark gray, readable font
  svg = svg.replace(/<text\b[^>]*>/g, (tag) =>
    setStyle(tag, 'fill:#333333;font-family:Helvetica,Arial,sans-serif;font-size:14px'),
  );

  // Inner tspan elements inherit fill
  svg = svg.replace(/<tspan\b(?![^>]*\bfill=)/g, '<tspan fill="#333333"');

  // Remove the <style> block entirely so svg-to-pdfkit doesn't try to parse it
  svg = svg.replace(/<style[\s\S]*?<\/style>/g, '');

  return svg;
}

async function getMermaid(): Promise<typeof import('mermaid').default> {
  if (mermaidInstance) return mermaidInstance;

  setupDOM();

  const mod = await import('mermaid/dist/mermaid.core.mjs' as string);
  mermaidInstance = (mod as any).default;
  mermaidInstance!.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    // Use native SVG text instead of <foreignObject> so svg-to-pdfkit can render labels
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  });
  return mermaidInstance!;
}

export async function renderMermaidToSVG(
  code: string,
  targetWidth: number = 400,
): Promise<{ svg: string; height: number }> {
  const mermaid = await getMermaid();
  const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { svg: rawSvg } = await mermaid.render(id, code);

  // Strip XML declaration if present
  const cleaned = rawSvg.replace(/<\?xml[^?]*\?>/g, '');

  // Inline CSS-driven styles so svg-to-pdfkit can render them
  const styled = inlineMermaidStyles(cleaned);

  return fixSVGViewBox(styled, targetWidth);
}

export function preprocessMarkdownForMermaid(markdown: string): string {
  return markdown.replace(/```mermaid\s*([\s\S]*?)\s*```/g, (_match, code) => {
    return `<pre class="mermaid">${code.trim()}</pre>`;
  });
}
