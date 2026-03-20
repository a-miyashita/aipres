import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import { encodeImageToBase64 } from './assets.js';

const BLOCK_TAGS = [
  'p', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'pre',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr',
];

const SVG_TAGS = [
  'svg', 'g', 'defs', 'symbol', 'use',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan',
  'lineargradient', 'radialgradient', 'stop',
  'clippath', 'mask',
  'image',
  'animate', 'animatetransform', 'animatemotion',
];

const INLINE_TAGS = [
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'sup', 'sub',
  'mark', 'a', 'span', 'img', 'br',
];

const ALIGN_VALUES = ['left', 'center', 'right', 'justify'];

// Tags that may carry data-color/data-highlight/data-size/data-weight
const FORMATTED_INLINE_TAGS = [
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sup', 'sub', 'mark', 'span', 'li',
];

const DATA_FORMAT_ATTRS = ['data-size', 'data-color', 'data-highlight', 'data-weight'];

// SVG presentation attributes — safe to allow globally (no effect on HTML elements)
const SVG_PRESENTATION_ATTRS = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity',
  'opacity', 'color', 'transform', 'clip-path', 'mask',
  'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor', 'dominant-baseline', 'letter-spacing', 'word-spacing',
];

// SVG structural/geometry attributes per element
const SVG_ATTRS: Record<string, string[]> = {
  svg:              ['xmlns', 'viewBox', 'preserveAspectRatio', 'width', 'height', 'x', 'y', 'id'],
  g:                ['id'],
  defs:             ['id'],
  symbol:           ['id', 'viewBox', 'preserveAspectRatio'],
  use:              ['href', 'x', 'y', 'width', 'height'],
  path:             ['d', 'id'],
  rect:             ['x', 'y', 'width', 'height', 'rx', 'ry', 'id'],
  circle:           ['cx', 'cy', 'r', 'id'],
  ellipse:          ['cx', 'cy', 'rx', 'ry', 'id'],
  line:             ['x1', 'y1', 'x2', 'y2', 'id'],
  polyline:         ['points', 'id'],
  polygon:          ['points', 'id'],
  text:             ['x', 'y', 'dx', 'dy', 'id'],
  tspan:            ['x', 'y', 'dx', 'dy'],
  lineargradient:   ['id', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'x1', 'y1', 'x2', 'y2'],
  radialgradient:   ['id', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'cx', 'cy', 'r', 'fx', 'fy'],
  stop:             ['offset', 'stop-color', 'stop-opacity'],
  clippath:         ['id', 'clipPathUnits'],
  mask:             ['id', 'x', 'y', 'width', 'height', 'maskUnits'],
  image:            ['href', 'x', 'y', 'width', 'height', 'preserveAspectRatio'],
  animate:          ['attributeName', 'from', 'to', 'by', 'dur', 'repeatCount', 'values', 'keyTimes', 'keySplines', 'calcMode', 'additive', 'accumulate', 'begin', 'end'],
  animatetransform: ['attributeName', 'type', 'from', 'to', 'by', 'dur', 'repeatCount', 'values', 'keyTimes', 'keySplines', 'calcMode', 'additive', 'accumulate', 'begin', 'end'],
  animatemotion:    ['path', 'from', 'to', 'by', 'dur', 'repeatCount', 'values', 'keyTimes', 'keySplines', 'calcMode', 'additive', 'accumulate', 'begin', 'end'],
};

const blockOptions: sanitizeHtml.IOptions = {
  allowedTags: [...BLOCK_TAGS, ...SVG_TAGS, ...INLINE_TAGS],
  allowedAttributes: {
    '*':  SVG_PRESENTATION_ATTRS,
    ...Object.fromEntries(FORMATTED_INLINE_TAGS.map(tag => [tag, DATA_FORMAT_ATTRS])),
    ...SVG_ATTRS,
    p:    ['data-align', ...DATA_FORMAT_ATTRS],
    th:   ['data-align', 'colspan', 'rowspan'],
    td:   ['data-align', 'colspan', 'rowspan'],
    ol:   ['type'],
    code: ['class'],
    a:    ['href'],
    img:  ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'data'],
  allowedSchemesByTag: {
    a:   ['http', 'https', '#'],
    use: ['http', 'https', 'data', '#'],
  },
  allowedClasses: {
    code: ['language-*'],
  },
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs['href'] ?? '';
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        return { tagName, attribs: { ...attribs, href: '' } };
      }
      return { tagName, attribs };
    },
    'p':  filterDataAlign,
    'th': filterDataAlign,
    'td': filterDataAlign,
  },
  disallowedTagsMode: 'discard',
};

const inlineOptions: sanitizeHtml.IOptions = {
  allowedTags: INLINE_TAGS,
  allowedAttributes: blockOptions.allowedAttributes,
  allowedSchemes: blockOptions.allowedSchemes,
  allowedSchemesByTag: blockOptions.allowedSchemesByTag,
  allowedClasses: blockOptions.allowedClasses,
  transformTags: blockOptions.transformTags,
  disallowedTagsMode: 'discard',
};

function filterDataAlign(tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const align = attribs['data-align'];
  if (align !== undefined && !ALIGN_VALUES.includes(align)) {
    const { 'data-align': _removed, ...rest } = attribs;
    return { tagName, attribs: rest };
  }
  return { tagName, attribs };
}

async function replaceLocalImages(html: string): Promise<string> {
  const replacements: Array<{ original: string; replacement: string }> = [];

  // <img src="..."> — HTML image elements
  const imgRegex = /<img([^>]*)\ssrc="([^"]*)"([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const src = match[2];
    if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      continue;
    }
    try {
      const dataUrl = await encodeImageToBase64(src);
      replacements.push({
        original: fullTag,
        replacement: fullTag.replace(`src="${src}"`, `src="${dataUrl}"`),
      });
    } catch {
      console.warn(`[sanitizer] Could not load image: ${src}`);
      replacements.push({
        original: fullTag,
        replacement: fullTag.replace(`src="${src}"`, `src=""`),
      });
    }
  }

  // <image href="..."> — SVG image elements
  const svgImageRegex = /<image([^>]*)\shref="([^"]*)"([^>]*?)(?:\/>|>)/gi;
  while ((match = svgImageRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const href = match[2];
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:') || href.startsWith('#')) {
      continue;
    }
    try {
      const dataUrl = await encodeImageToBase64(href);
      replacements.push({
        original: fullTag,
        replacement: fullTag.replace(`href="${href}"`, `href="${dataUrl}"`),
      });
    } catch {
      console.warn(`[sanitizer] Could not load image: ${href}`);
      replacements.push({
        original: fullTag,
        replacement: fullTag.replace(`href="${href}"`, `href=""`),
      });
    }
  }

  let result = html;
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  return result;
}

/** Sanitize HTML block content (body, leftCol, rightCol, notes) */
export async function sanitizeBlock(html: string): Promise<string> {
  const sanitized = sanitizeHtml(html, blockOptions);
  return replaceLocalImages(sanitized);
}

/** Sanitize HTML inline content (title, subtitle) */
export async function sanitizeInline(html: string): Promise<string> {
  const sanitized = sanitizeHtml(html, inlineOptions);
  return replaceLocalImages(sanitized);
}

/**
 * Detect content type and process:
 * - Contains '<': treat as HTML subset → sanitize
 * - No '<': treat as legacy Markdown → run through marked
 */
export async function renderContent(text: string, mode: 'block' | 'inline'): Promise<string> {
  if (!text) return '';
  if (text.includes('<')) {
    return mode === 'block' ? sanitizeBlock(text) : sanitizeInline(text);
  }
  // Legacy Markdown fallback
  const result = marked.parse(text);
  if (typeof result === 'string') return result;
  return String(await result);
}
