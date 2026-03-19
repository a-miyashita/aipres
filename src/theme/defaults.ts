import type { ThemeDefinition } from '../model/types.js';

export const DEFAULT_THEME_JSON: ThemeDefinition = {
  name: 'default',
  displayName: 'Default',
  description: 'Default dark theme',
  baseTheme: 'black',
  customCss: 'custom.css',
  assets: [],
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
