import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';
import { encodeImageToBase64 } from './assets.js';

const BLOCK_TAGS = [
  'p', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'pre',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr',
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

const blockOptions: sanitizeHtml.IOptions = {
  allowedTags: [...BLOCK_TAGS, ...INLINE_TAGS],
  allowedAttributes: {
    ...Object.fromEntries(FORMATTED_INLINE_TAGS.map(tag => [tag, DATA_FORMAT_ATTRS])),
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
    a: ['http', 'https', '#'],
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
    img: (tagName, attribs) => {
      const src = attribs['src'] ?? '';
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return { tagName, attribs };
      }
      if (src === '') {
        return { tagName, attribs };
      }
      // Local path — will be converted asynchronously after sanitization
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
  // Find all img src attributes that are local paths
  const imgRegex = /<img([^>]*)\ssrc="([^"]*)"([^>]*)>/gi;
  const replacements: Array<{ original: string; replacement: string }> = [];

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
