import type { SlideModel } from '../model/types.js';

const PLACEHOLDER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">',
  '<rect width="400" height="300" fill="#444"/>',
  '<line x1="0" y1="0" x2="400" y2="300" stroke="#666" stroke-width="2"/>',
  '<line x1="400" y1="0" x2="0" y2="300" stroke="#666" stroke-width="2"/>',
  '<text x="200" y="155" text-anchor="middle" fill="#999" font-size="18" font-family="sans-serif">Image Placeholder</text>',
  '</svg>',
].join('');

const PLACEHOLDER_IMAGE_URL = `data:image/svg+xml;base64,${Buffer.from(PLACEHOLDER_SVG).toString('base64')}`;

export const SAMPLE_SLIDES: SlideModel = {
  version: '1.0',
  theme: 'default',
  revealOptions: {
    transition: 'slide',
    slideNumber: true,
    controls: true,
    progress: true,
    hash: false,
  },
  slides: [
    {
      id: 'sample-1',
      layout: 'title',
      title: 'Theme Preview',
      subtitle: 'aipres theme editor',
    },
    {
      id: 'sample-2',
      layout: 'content',
      title: 'Content Slide',
      body: [
        '<ul>',
        '<li>First bullet point</li>',
        '<li>Second bullet point with <strong>bold text</strong></li>',
        '<li>Third point with <em>emphasis</em> and <code>inline code</code></li>',
        '</ul>',
      ].join(''),
    },
    {
      id: 'sample-3',
      layout: 'two-column',
      title: 'Two Column Layout',
      leftCol: '<p>Left column</p><ul><li>Item A</li><li>Item B</li><li>Item C</li></ul>',
      rightCol: '<p>Right column</p><ul><li>Item D</li><li>Item E</li><li>Item F</li></ul>',
    },
    {
      id: 'sample-4',
      layout: 'image',
      title: 'Image Slide',
      imageUrl: PLACEHOLDER_IMAGE_URL,
    },
    {
      id: 'sample-5',
      layout: 'blank',
      body: [
        '<h2>Blank Layout</h2>',
        '<p>Free content area with <em>emphasis</em>, <strong>bold</strong>, and <code>inline code</code>.</p>',
        '<blockquote><p>A blockquote example showing pull-quote styling.</p></blockquote>',
      ].join(''),
    },
  ],
};

/**
 * Returns a plain-text description of the sample slides for injection into the
 * theme editing system prompt. Gives the LLM enough context to understand what
 * is visible in the preview when the user refers to specific slides or elements.
 */
export function buildSampleDescription(): string {
  return `The preview browser shows 5 sample slides:

Slide 1 (title layout): Title "Theme Preview", subtitle "aipres theme editor". Centred on the page.

Slide 2 (content layout): Title "Content Slide". Body contains a bulleted list:
  • First bullet point
  • Second bullet point with bold text
  • Third point with emphasis and inline code

Slide 3 (two-column layout): Title "Two Column Layout". Left column: paragraph "Left column" followed by list items A, B, C. Right column: paragraph "Right column" followed by list items D, E, F.

Slide 4 (image layout): Title "Image Slide". A placeholder image (grey rectangle with an X) centred below the title.

Slide 5 (blank layout): No title. Body contains an h2 heading "Blank Layout", a paragraph with emphasis/bold/code, and a blockquote.`;
}
