import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeBlock, sanitizeInline, renderContent } from './sanitizer.js';

// Mock encodeImageToBase64 from assets
vi.mock('./assets.js', () => ({
  encodeImageToBase64: vi.fn(async (filePath: string) => {
    if (filePath === '/img/found.png') {
      return 'data:image/png;base64,abc123';
    }
    throw new Error('File not found');
  }),
}));

describe('sanitizeBlock', () => {
  it('preserves allowed block tags', async () => {
    const input = '<p>Hello</p><ul><li>item</li></ul><h3>Sub</h3>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('<p>Hello</p>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>item</li>');
    expect(result).toContain('<h3>Sub</h3>');
  });

  it('preserves table tags', async () => {
    const input = '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('<table>');
    expect(result).toContain('<thead>');
    expect(result).toContain('<th>A</th>');
    expect(result).toContain('<td>B</td>');
  });

  it('strips disallowed tags', async () => {
    const input = '<p>safe</p><script>alert(1)</script><style>body{}</style>';
    const result = await sanitizeBlock(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<style>');
    expect(result).toContain('<p>safe</p>');
  });

  it('strips onclick and other event attributes', async () => {
    const input = '<p onclick="bad()">text</p>';
    const result = await sanitizeBlock(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<p>text</p>');
  });

  it('preserves data-color with palette names on span', async () => {
    const input = '<span data-color="accent">text</span>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('data-color="accent"');
  });

  it('preserves data-color on strong (inline tag)', async () => {
    const input = '<li><strong data-color="info">効率的</strong> - 説明</li>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('<strong data-color="info">効率的</strong>');
  });

  it('preserves data-color on em', async () => {
    const input = '<em data-color="danger">warning</em>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('data-color="danger"');
  });

  it('preserves data-color with hex values', async () => {
    const input = '<span data-color="#ff6b35">text</span>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('data-color="#ff6b35"');
  });

  it('preserves data-size values', async () => {
    const input = '<span data-size="xl">big</span>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('data-size="xl"');
  });

  it('preserves data-align on <p>', async () => {
    const input = '<p data-align="center">centered</p>';
    const result = await sanitizeBlock(input);
    expect(result).toContain('data-align="center"');
    expect(result).toContain('<p');
  });

  it('strips style attribute', async () => {
    const input = '<p style="color:red">text</p>';
    const result = await sanitizeBlock(input);
    expect(result).not.toContain('style=');
    expect(result).toContain('text');
  });

  it('strips id attribute', async () => {
    const input = '<p id="x">text</p>';
    const result = await sanitizeBlock(input);
    expect(result).not.toContain('id=');
    expect(result).toContain('text');
  });

  it('blocks javascript: href', async () => {
    const input = '<a href="javascript:alert(1)">link</a>';
    const result = await sanitizeBlock(input);
    expect(result).not.toContain('javascript:');
  });

  it('converts local image src to base64', async () => {
    const input = '<img src="/img/found.png" alt="test" />';
    const result = await sanitizeBlock(input);
    expect(result).toContain('data:image/png;base64,abc123');
  });

  it('replaces missing local image src with empty string', async () => {
    const input = '<img src="/img/missing.png" alt="oops" />';
    const result = await sanitizeBlock(input);
    expect(result).toContain('src=""');
    expect(result).not.toContain('missing.png');
  });

  it('passes through http image URLs unchanged', async () => {
    const input = '<img src="https://example.com/img.png" alt="remote" />';
    const result = await sanitizeBlock(input);
    expect(result).toContain('src="https://example.com/img.png"');
  });
});

describe('sanitizeInline', () => {
  it('strips block tags in inline mode', async () => {
    const input = '<p>text</p><strong>bold</strong>';
    const result = await sanitizeInline(input);
    expect(result).not.toContain('<p>');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('keeps inline tags in inline mode', async () => {
    const input = '<strong>bold</strong><span data-size="lg">big</span>';
    const result = await sanitizeInline(input);
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('data-size="lg"');
  });
});

describe('renderContent', () => {
  it('treats text with < as HTML and sanitizes', async () => {
    const input = '<p>Hello <strong>world</strong></p>';
    const result = await renderContent(input, 'block');
    expect(result).toContain('<p>Hello <strong>world</strong></p>');
  });

  it('treats plain text without < as legacy Markdown', async () => {
    const input = '**bold text**';
    const result = await renderContent(input, 'block');
    expect(result).toContain('<strong>bold text</strong>');
  });

  it('returns empty string for empty input', async () => {
    const result = await renderContent('', 'block');
    expect(result).toBe('');
  });
});
