import type { ThemeDefinition } from '../model/types.js';

/** Generate CSS custom properties and data-* selector rules from a palette. */
export function generatePaletteCss(palette: NonNullable<ThemeDefinition['palette']>): string {
  return `/* Rich text: palette custom properties */
:root {
  --color-palette-accent:  ${palette.accent};
  --color-palette-muted:   ${palette.muted};
  --color-palette-danger:  ${palette.danger};
  --color-palette-success: ${palette.success};
  --color-palette-warning: ${palette.warning};
  --color-palette-info:    ${palette.info};
}

/* data-color */
[data-color="accent"]   { color: var(--color-palette-accent); }
[data-color="muted"]    { color: var(--color-palette-muted); }
[data-color="danger"]   { color: var(--color-palette-danger); }
[data-color="success"]  { color: var(--color-palette-success); }
[data-color="warning"]  { color: var(--color-palette-warning); }
[data-color="info"]     { color: var(--color-palette-info); }

/* data-highlight */
[data-highlight="accent"]   { background-color: var(--color-palette-accent); }
[data-highlight="muted"]    { background-color: var(--color-palette-muted); }
[data-highlight="danger"]   { background-color: var(--color-palette-danger); }
[data-highlight="success"]  { background-color: var(--color-palette-success); }
[data-highlight="warning"]  { background-color: var(--color-palette-warning); }
[data-highlight="info"]     { background-color: var(--color-palette-info); }

/* data-size */
[data-size="xs"]  { font-size: 0.6em; }
[data-size="sm"]  { font-size: 0.8em; }
[data-size="lg"]  { font-size: 1.3em; }
[data-size="xl"]  { font-size: 1.6em; }
[data-size="2xl"] { font-size: 2em; }

/* data-weight */
[data-weight="bold"]   { font-weight: bold; }
[data-weight="normal"] { font-weight: normal; }

/* data-align */
[data-align="left"]    { text-align: left; }
[data-align="center"]  { text-align: center; }
[data-align="right"]   { text-align: right; }
[data-align="justify"] { text-align: justify; }
`;
}

/**
 * Structural layout rules shared by all themes.
 * Does NOT include color overrides — those are handled by the Reveal.js theme CSS
 * and the dynamically injected palette CSS.
 */
export const SHARED_LAYOUT_CSS = `/* aipres shared layout */
.reveal .slides section {
  text-align: left;
  padding: 20px 40px;
}

.reveal p.subtitle {
  font-size: 0.75em;
  color: var(--color-palette-muted);
  margin-top: 0.5em;
  font-weight: 300;
}

.reveal .content {
  font-size: 0.82em;
  line-height: 1.7;
}

.reveal ul, .reveal ol {
  display: block;
  margin-left: 1em;
}

.reveal li {
  margin-bottom: 0.4em;
}

/* Two-column layout */
.reveal .columns {
  display: flex;
  gap: 2em;
  align-items: flex-start;
}

.reveal .columns > div {
  flex: 1;
}

/* Image layout */
.reveal .slide-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

/* Title slide */
.reveal .slides section.title-slide {
  text-align: center;
  display: flex !important;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.reveal .slides section.title-slide h1 {
  font-size: 2.2em;
}

/* Tables */
.reveal table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.8em;
}
`;

export const DEFAULT_THEME_JSON: ThemeDefinition = {
  name: 'default',
  displayName: 'Default',
  description: 'Default dark theme',
  baseTheme: 'black',
  customCss: 'custom.css',
  assets: [],
  palette: {
    // accent matches --color-highlight (#e94560, the coral used for code/links/progress)
    accent:  '#e94560',
    muted:   '#9e9e9e',
    // bright variants for readability on dark navy background
    danger:  '#ff5555',
    success: '#50fa7b',
    warning: '#ffb86c',
    info:    '#8be9fd',
  },
};

export const DEFAULT_THEME_CSS = `/* aipres default theme */
:root {
  --color-bg: #1a1a2e;
  --color-bg2: #16213e;
  --color-accent: #0f3460;
  --color-highlight: #e94560;
  --color-text: #e0e0e0;
  --color-muted: #9e9e9e;
  --font-main: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'Fira Code', 'Consolas', monospace;
}

.reveal-viewport {
  background: var(--color-bg);
  background-color: var(--color-bg);
}

.reveal {
  font-family: var(--font-main);
  font-size: 38px;
  font-weight: normal;
  color: var(--color-text);
}

.reveal .slides section {
  text-align: left;
  padding: 20px 40px;
}

.reveal h1, .reveal h2, .reveal h3 {
  font-family: var(--font-main);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: #ffffff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

.reveal h1 {
  font-size: 2.0em;
  margin-bottom: 0.3em;
}

.reveal h2 {
  font-size: 1.4em;
  margin-bottom: 0.4em;
  color: #f0f0f0;
}

.reveal p.subtitle {
  font-size: 0.75em;
  color: var(--color-muted);
  margin-top: 0.5em;
  font-weight: 300;
}

.reveal .content {
  font-size: 0.82em;
  line-height: 1.7;
}

.reveal ul, .reveal ol {
  display: block;
  margin-left: 1em;
}

.reveal li {
  margin-bottom: 0.4em;
}

.reveal code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  color: #e94560;
}

.reveal pre {
  background: rgba(0,0,0,0.4);
  border-radius: 6px;
  padding: 0.8em 1em;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  width: 100%;
}

.reveal pre code {
  background: transparent;
  padding: 0;
  color: #e0e0e0;
  font-size: 0.8em;
}

.reveal blockquote {
  border-left: 4px solid var(--color-highlight);
  padding-left: 1em;
  margin-left: 0;
  color: var(--color-muted);
  font-style: italic;
}

/* Two-column layout */
.reveal .columns {
  display: flex;
  gap: 2em;
  align-items: flex-start;
}

.reveal .columns > div {
  flex: 1;
}

/* Image layout */
.reveal .slide-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

/* Title slide special styling */
.reveal .slides section.title-slide {
  text-align: center;
  display: flex !important;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.reveal .slides section.title-slide h1 {
  font-size: 2.2em;
}

/* Controls and progress bar */
.reveal .progress {
  color: var(--color-highlight);
}

.reveal .controls button {
  color: var(--color-highlight);
}

/* Slide number */
.reveal .slide-number {
  color: var(--color-muted);
  font-size: 0.6em;
}

/* Links */
.reveal a {
  color: var(--color-highlight);
  text-decoration: none;
}

.reveal a:hover {
  text-decoration: underline;
}

/* Tables */
.reveal table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.8em;
}

.reveal table th {
  background: rgba(233, 69, 96, 0.3);
  padding: 0.5em 0.8em;
  text-align: left;
}

.reveal table td {
  padding: 0.4em 0.8em;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.reveal table tr:nth-child(even) td {
  background: rgba(255,255,255,0.03);
}
`;

/** Built-in Reveal.js themes available without installation. */
export const BUILTIN_THEMES: ThemeDefinition[] = [
  {
    name: 'black',
    displayName: 'Black',
    description: 'Dark background, white text (Reveal.js built-in)',
    baseTheme: 'black',
    customCss: '',
    assets: [],
    palette: { accent: '#42affa', muted: '#aaaaaa', danger: '#ff5555', success: '#50fa7b', warning: '#ffb86c', info: '#8be9fd' },
  },
  {
    name: 'white',
    displayName: 'White',
    description: 'White background, dark text (Reveal.js built-in)',
    baseTheme: 'white',
    customCss: '',
    assets: [],
    palette: { accent: '#2a76dd', muted: '#6b7280', danger: '#dc2626', success: '#16a34a', warning: '#d97706', info: '#0284c7' },
  },
  {
    name: 'league',
    displayName: 'League',
    description: 'Dark gray, cyan accents (Reveal.js built-in)',
    baseTheme: 'league',
    customCss: '',
    assets: [],
    palette: { accent: '#13daec', muted: '#aaaaaa', danger: '#ff5555', success: '#50fa7b', warning: '#ffb86c', info: '#8be9fd' },
  },
  {
    name: 'beige',
    displayName: 'Beige',
    description: 'Warm beige background, brown text (Reveal.js built-in)',
    baseTheme: 'beige',
    customCss: '',
    assets: [],
    palette: { accent: '#8b743d', muted: '#888888', danger: '#b91c1c', success: '#15803d', warning: '#b45309', info: '#1d4ed8' },
  },
  {
    name: 'sky',
    displayName: 'Sky',
    description: 'Light blue-white background (Reveal.js built-in)',
    baseTheme: 'sky',
    customCss: '',
    assets: [],
    palette: { accent: '#3b759e', muted: '#64748b', danger: '#dc2626', success: '#16a34a', warning: '#ca8a04', info: '#0369a1' },
  },
  {
    name: 'night',
    displayName: 'Night',
    description: 'Near-black background, gold accents (Reveal.js built-in)',
    baseTheme: 'night',
    customCss: '',
    assets: [],
    palette: { accent: '#e7ad52', muted: '#aaaaaa', danger: '#ff5555', success: '#50fa7b', warning: '#ffb86c', info: '#8be9fd' },
  },
  {
    name: 'serif',
    displayName: 'Serif',
    description: 'Cream background, serif fonts (Reveal.js built-in)',
    baseTheme: 'serif',
    customCss: '',
    assets: [],
    palette: { accent: '#51483d', muted: '#888888', danger: '#b91c1c', success: '#15803d', warning: '#b45309', info: '#1d4ed8' },
  },
  {
    name: 'simple',
    displayName: 'Simple',
    description: 'White, minimal styling (Reveal.js built-in)',
    baseTheme: 'simple',
    customCss: '',
    assets: [],
    palette: { accent: '#1a73e8', muted: '#6b7280', danger: '#dc2626', success: '#16a34a', warning: '#d97706', info: '#0284c7' },
  },
  {
    name: 'solarized',
    displayName: 'Solarized',
    description: 'Solarized light color scheme (Reveal.js built-in)',
    baseTheme: 'solarized',
    customCss: '',
    assets: [],
    palette: { accent: '#268bd2', muted: '#93a1a1', danger: '#dc322f', success: '#859900', warning: '#b58900', info: '#2aa198' },
  },
  {
    name: 'blood',
    displayName: 'Blood',
    description: 'Dark background, blood red accents (Reveal.js built-in)',
    baseTheme: 'blood',
    customCss: '',
    assets: [],
    palette: { accent: '#cc3344', muted: '#aaaaaa', danger: '#ff5555', success: '#50fa7b', warning: '#ffb86c', info: '#8be9fd' },
  },
  {
    name: 'moon',
    displayName: 'Moon',
    description: 'Dark teal/solarized-dark background (Reveal.js built-in)',
    baseTheme: 'moon',
    customCss: '',
    assets: [],
    palette: { accent: '#268bd2', muted: '#657b83', danger: '#ff5555', success: '#50fa7b', warning: '#ffb86c', info: '#2aa198' },
  },
  {
    name: 'dracula',
    displayName: 'Dracula',
    description: 'Dark purple Dracula color scheme (Reveal.js built-in)',
    baseTheme: 'dracula',
    customCss: '',
    assets: [],
    palette: { accent: '#bd93f9', muted: '#6272a4', danger: '#ff5555', success: '#50fa7b', warning: '#ffb86c', info: '#8be9fd' },
  },
  {
    name: 'black-contrast',
    displayName: 'Black (High Contrast)',
    description: 'High contrast dark theme for accessibility (Reveal.js built-in)',
    baseTheme: 'black-contrast',
    customCss: '',
    assets: [],
    palette: { accent: '#ffffff', muted: '#cccccc', danger: '#ff5555', success: '#50fa7b', warning: '#ffb86c', info: '#8be9fd' },
  },
  {
    name: 'white-contrast',
    displayName: 'White (High Contrast)',
    description: 'High contrast light theme for accessibility (Reveal.js built-in)',
    baseTheme: 'white-contrast',
    customCss: '',
    assets: [],
    palette: { accent: '#000000', muted: '#555555', danger: '#cc0000', success: '#006600', warning: '#996600', info: '#0055aa' },
  },
];
