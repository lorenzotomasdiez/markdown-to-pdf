// Simple LaTeX to Unicode converter for common math expressions
export function latexToUnicode(latex: string): string {
  const conversions: Record<string, string> = {
    // Greek letters
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
    '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
    '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
    '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
    '\\Psi': 'Ψ', '\\Omega': 'Ω',

    // Operators
    '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
    '\\cdot': '·', '\\ast': '∗', '\\star': '⋆', '\\circ': '∘',
    '\\bullet': '•', '\\oplus': '⊕', '\\ominus': '⊖', '\\otimes': '⊗',
    '\\oslash': '⊘', '\\odot': '⊙', '\\land': '∧', '\\lor': '∨',
    '\\cap': '∩', '\\cup': '∪', '\\subset': '⊂', '\\supset': '⊃',
    '\\subseteq': '⊆', '\\supseteq': '⊇', '\\in': '∈', '\\notin': '∉',
    '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\approx': '≈',
    '\\equiv': '≡', '\\sim': '∼', '\\simeq': '≃', '\\cong': '≅',
    '\\propto': '∝', '\\parallel': '∥', '\\perp': '⊥',
    '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
    '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
    '\\sum': 'Σ', '\\prod': 'Π', '\\coprod': '∐',
    '\\int': '∫', '\\iint': '∬', '\\iiint': '∭',
    '\\oint': '∮', '\\sqrt': '√', '\\angle': '∠',
    '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
    '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
    '\\uparrow': '↑', '\\downarrow': '↓', '\\updownarrow': '↕',
    '\\Uparrow': '⇑', '\\Downarrow': '⇓', '\\Updownarrow': '⇕',

    // Misc
    '\\ldots': '...', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
    '\\therefore': '∴', '\\because': '∵',
  };

  let result = latex;

  // Handle superscripts
  result = result.replace(/\^{([^}]+)}/g, (_, exp) => '^' + exp);
  result = result.replace(/\^{(\d+)}/g, (_, exp) => '^' + exp);
  result = result.replace(/\^{([a-zA-Z])}/g, (_, exp) => '^' + exp);

  // Handle subscripts
  result = result.replace(/_{([^}]+)}/g, (_, sub) => '_' + sub);
  result = result.replace(/_{(\d+)}/g, (_, sub) => '_' + sub);
  result = result.replace(/_{([a-zA-Z])}/g, (_, sub) => '_' + sub);

  // Handle square roots BEFORE fractions so nested \sqrt{} inside \frac{} resolves correctly
  result = result.replace(/\\sqrt\[([^\]]+)\]{([^}]+)}/g, '√[$1]($2)');
  result = result.replace(/\\sqrt{([^}]+)}/g, '√($1)');

  // Handle fractions - convert to inline form (now safe because nested \sqrt already expanded)
  result = result.replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1)/($2)');

  // Handle \left and \right
  result = result.replace(/\\left\(/g, '(');
  result = result.replace(/\\right\)/g, ')');
  result = result.replace(/\\left\[/g, '[');
  result = result.replace(/\\right\]/g, ']');
  result = result.replace(/\\left\\{/g, '{');
  result = result.replace(/\\right\\}/g, '}');
  result = result.replace(/\\left\|/g, '|');
  result = result.replace(/\\right\|/g, '|');

  // Replace common LaTeX commands.
  // Use a negative lookahead (?![a-zA-Z]) so that shorter commands like \in
  // don't accidentally match as a prefix of longer ones (\int, \infty, etc.)
  // and \subset doesn't swallow \subseteq, and so on.
  for (const [latexCmd, unicode] of Object.entries(conversions)) {
    const escaped = latexCmd.replace(/\\/g, '\\\\');
    result = result.replace(new RegExp(escaped + '(?![a-zA-Z])', 'g'), unicode);
  }

  // Handle \text{} - just extract the text
  result = result.replace(/\\text{([^}]+)}/g, '$1');

  // Handle LaTeX spacing commands
  result = result.replace(/\\,/g, ' ');
  result = result.replace(/\\ /g, ' ');
  result = result.replace(/\\!/g, '');
  result = result.replace(/\\;/g, ' ');
  result = result.replace(/\\:/g, ' ');
  result = result.replace(/\\quad(?![a-zA-Z])/g, '  ');
  result = result.replace(/\\qquad(?![a-zA-Z])/g, '    ');
  result = result.replace(/\\\\/g, ' ');

  // Remove any remaining unrecognised \cmd sequences so they don't show as stray backslashes
  result = result.replace(/\\[a-zA-Z]+/g, '');

  // Clean up remaining braces
  result = result.replace(/[{}]/g, '');

  return result;
}

interface MathJaxInstance {
  doc: any;
  adaptor: any;
}

let mjxInstance: MathJaxInstance | null = null;

async function getMathJax(): Promise<MathJaxInstance> {
  if (mjxInstance) return mjxInstance;

  const { mathjax } = await import('mathjax-full/js/mathjax.js');
  const { TeX } = await import('mathjax-full/js/input/tex.js');
  const { SVG } = await import('mathjax-full/js/output/svg.js');
  const { liteAdaptor } = await import('mathjax-full/js/adaptors/liteAdaptor.js');
  const { RegisterHTMLHandler } = await import('mathjax-full/js/handlers/html.js');
  const { AllPackages } = await import('mathjax-full/js/input/tex/AllPackages.js');

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const doc = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'none' }),
  });

  mjxInstance = { doc, adaptor };
  return mjxInstance;
}

export async function renderMathToSVG(
  math: string,
  displayMode: boolean = false,
): Promise<{ svg: string; width: number; height: number }> {
  const { doc, adaptor } = await getMathJax();

  const node = doc.convert(math, { display: displayMode });
  const html: string = adaptor.outerHTML(node);

  // Extract the <svg> element from the <mjx-container> wrapper
  const svgMatch = html.match(/<svg[\s\S]*<\/svg>/);
  if (!svgMatch) {
    throw new Error('MathJax failed to produce SVG output');
  }

  let svg = svgMatch[0];

  // Parse ex dimensions and convert to points (1ex ≈ 10pt for display, 8pt for inline)
  const exToPt = displayMode ? 10 : 8;
  const wMatch = svg.match(/width="([\d.]+)ex"/);
  const hMatch = svg.match(/height="([\d.]+)ex"/);
  const width = wMatch ? Math.ceil(parseFloat(wMatch[1]) * exToPt) : 200;
  const height = hMatch ? Math.ceil(parseFloat(hMatch[1]) * exToPt) : 50;

  // Replace ex dimensions with concrete point values
  svg = svg.replace(/width="[\d.]+ex"/, `width="${width}"`);
  svg = svg.replace(/height="[\d.]+ex"/, `height="${height}"`);

  // Replace currentColor with a concrete color so svg-to-pdfkit renders it
  svg = svg.replace(/currentColor/g, '#333333');

  // Remove style attribute from root svg (vertical-align not relevant in PDF)
  svg = svg.replace(/<svg([^>]*)\bstyle="[^"]*"/, '<svg$1');

  return { svg, width, height };
}

export function extractMathExpressions(text: string): Array<{ type: 'inline' | 'display'; math: string; start: number; end: number }> {
  const expressions: Array<{ type: 'inline' | 'display'; math: string; start: number; end: number }> = [];
  let i = 0;

  while (i < text.length) {
    if (text.slice(i, i + 2) === '$$') {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        expressions.push({
          type: 'display',
          math: text.slice(i + 2, end).trim(),
          start: i,
          end: end + 2,
        });
        i = end + 2;
        continue;
      }
    } else if (text[i] === '$' && (i === 0 || text[i - 1] !== '\\')) {
      const end = text.indexOf('$', i + 1);
      if (end !== -1 && text[end - 1] !== '\\') {
        expressions.push({
          type: 'inline',
          math: text.slice(i + 1, end).trim(),
          start: i,
          end: end + 1,
        });
        i = end + 1;
        continue;
      }
    } else if (text.slice(i, i + 2) === '\\[') {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) {
        expressions.push({
          type: 'display',
          math: text.slice(i + 2, end).trim(),
          start: i,
          end: end + 2,
        });
        i = end + 2;
        continue;
      }
    } else if (text.slice(i, i + 2) === '\\(') {
      const end = text.indexOf('\\)', i + 2);
      if (end !== -1) {
        expressions.push({
          type: 'inline',
          math: text.slice(i + 2, end).trim(),
          start: i,
          end: end + 2,
        });
        i = end + 2;
        continue;
      }
    }
    i++;
  }

  return expressions;
}

/**
 * Convert Unicode math symbols that PDFKit's built-in fonts (Helvetica,
 * Times-Roman, Courier) cannot render — they use WinAnsi/Latin-1 encoding
 * which only covers U+0000–U+00FF.  Characters like √ ∞ α β show as "?" or
 * the wrong glyph, so we replace them with readable ASCII equivalents.
 *
 * Latin-1 math characters that DO render (± × ÷ ² ³ · °) are left as-is.
 */
export function sanitizeMathText(text: string): string {
  return text
    // Mathematical operators not in Latin-1
    .replace(/√/g, 'sqrt')
    .replace(/∞/g, 'inf')
    .replace(/∑/g, 'sum')
    .replace(/∏/g, 'prod')
    .replace(/∫/g, 'int')
    .replace(/∬/g, 'iint')
    .replace(/∭/g, 'iiint')
    .replace(/∮/g, 'oint')
    .replace(/∂/g, 'd')
    .replace(/∇/g, 'nabla')
    .replace(/∀/g, 'forall ')
    .replace(/∃/g, 'exists ')
    .replace(/∄/g, '!exists ')
    .replace(/∈/g, ' in ')
    .replace(/∉/g, ' not in ')
    .replace(/⊂/g, ' C ')
    .replace(/⊃/g, ' D ')
    .replace(/⊆/g, ' C= ')
    .replace(/⊇/g, ' D= ')
    .replace(/∩/g, ' ^ ')
    .replace(/∪/g, ' v ')
    .replace(/∧/g, ' & ')
    .replace(/∨/g, ' | ')
    .replace(/⊕/g, '(+)')
    .replace(/⊗/g, '(x)')
    .replace(/⊙/g, '(.)')
    // Comparison operators
    .replace(/≠/g, '!=')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≈/g, '~=')
    .replace(/≡/g, '===')
    .replace(/∼/g, '~')
    .replace(/≃/g, '~=')
    .replace(/≅/g, '~=')
    .replace(/∝/g, 'prop')
    .replace(/∥/g, '||')
    .replace(/⊥/g, '_|_')
    // Arrows
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/⇒/g, '=>')
    .replace(/⇐/g, '<=')
    .replace(/⇔/g, '<=>')
    .replace(/↑/g, 'up')
    .replace(/↓/g, 'down')
    // Misc
    .replace(/⋯/g, '...')
    .replace(/⋮/g, '...')
    .replace(/⋱/g, '...')
    .replace(/∴/g, 'therefore ')
    .replace(/∵/g, 'because ')
    .replace(/∠/g, 'angle ')
    // Lowercase Greek
    .replace(/α/g, 'alpha').replace(/β/g, 'beta').replace(/γ/g, 'gamma')
    .replace(/δ/g, 'delta').replace(/ε/g, 'epsilon').replace(/ζ/g, 'zeta')
    .replace(/η/g, 'eta').replace(/θ/g, 'theta').replace(/ι/g, 'iota')
    .replace(/κ/g, 'kappa').replace(/λ/g, 'lambda').replace(/μ/g, 'mu')
    .replace(/ν/g, 'nu').replace(/ξ/g, 'xi').replace(/π/g, 'pi')
    .replace(/ρ/g, 'rho').replace(/σ/g, 'sigma').replace(/τ/g, 'tau')
    .replace(/υ/g, 'upsilon').replace(/φ/g, 'phi').replace(/χ/g, 'chi')
    .replace(/ψ/g, 'psi').replace(/ω/g, 'omega')
    // Uppercase Greek
    .replace(/Γ/g, 'Gamma').replace(/Δ/g, 'Delta').replace(/Θ/g, 'Theta')
    .replace(/Λ/g, 'Lambda').replace(/Ξ/g, 'Xi').replace(/Π/g, 'Pi')
    .replace(/Σ/g, 'Sigma').replace(/Φ/g, 'Phi').replace(/Ψ/g, 'Psi')
    .replace(/Ω/g, 'Omega');
}

export interface TextSegment {
  type: 'text' | 'math';
  content: string;
  mathType?: 'inline' | 'display';
}

export function parseTextWithMath(text: string): TextSegment[] {
  const expressions = extractMathExpressions(text);
  if (expressions.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const expr of expressions) {
    if (expr.start > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, expr.start),
      });
    }

    segments.push({
      type: 'math',
      content: expr.math,
      mathType: expr.type,
    });

    lastIndex = expr.end;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
