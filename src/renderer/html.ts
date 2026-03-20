import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { SlideModel, ResolvedConfig } from '../model/types.js';
import { renderSlide } from './templates.js';
import { loadRevealJs, loadRevealCss, loadRevealThemeCss, loadThemeCss } from './assets.js';
import { loadTheme } from '../theme/manager.js';
import { DEFAULT_THEME_JSON, DEFAULT_THEME_CSS, SHARED_LAYOUT_CSS, generatePaletteCss } from '../theme/defaults.js';

const HOT_RELOAD_SCRIPT = (port: number) => `
<script>
(function() {
  var ws = new WebSocket('ws://localhost:${port}/ws');
  ws.onmessage = function(event) {
    try {
      var msg = JSON.parse(event.data);
      if (msg.type === 'reload') {
        location.reload();
      }
    } catch(e) {
      location.reload();
    }
  };
  ws.onclose = function() {
    setTimeout(function() { location.reload(); }, 2000);
  };
})();
</script>`;

export async function renderPresentation(
  model: SlideModel,
  config: ResolvedConfig,
  opts?: { hotReload?: boolean; port?: number }
): Promise<string> {
  // Load theme
  let themeDef = DEFAULT_THEME_JSON;
  let customCss = DEFAULT_THEME_CSS;

  try {
    const loadedTheme = await loadTheme(model.theme);
    themeDef = loadedTheme;
    if (themeDef.customCss) {
      const themeDir = path.join(os.homedir(), '.aipres', 'themes', model.theme);
      const loaded = await loadThemeCss(themeDef, themeDir);
      customCss = loaded || SHARED_LAYOUT_CSS;
    } else {
      // 'black' shares the same rich dark styling as 'default'
      // All other built-in themes use shared layout only (preserving Reveal.js theme colors)
      customCss = themeDef.name === 'black' ? DEFAULT_THEME_CSS : SHARED_LAYOUT_CSS;
    }
  } catch {
    // Use defaults
  }

  const paletteCss = themeDef.palette ? generatePaletteCss(themeDef.palette) : '';

  const revealJs = loadRevealJs();
  const revealCss = loadRevealCss();
  const themeCss = loadRevealThemeCss(themeDef.baseTheme);

  const slidesHtml = (await Promise.all(model.slides.map(renderSlide))).join('\n');

  const revealOptions = JSON.stringify(model.revealOptions, null, 2);

  const hotReloadScript = opts?.hotReload && opts?.port
    ? HOT_RELOAD_SCRIPT(opts.port)
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentation</title>
  <style>
${revealCss}
  </style>
  <style>
${themeCss}
  </style>
  <style>
${customCss}
  </style>
  <style>
${paletteCss}
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  <script>
${revealJs}
  </script>
  <script>
    Reveal.initialize(${revealOptions});
  </script>
  ${hotReloadScript}
</body>
</html>`;
}

export async function writeHtml(
  model: SlideModel,
  outputPath: string,
  config: ResolvedConfig
): Promise<void> {
  const html = await renderPresentation(model, config);
  const absPath = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, html, 'utf-8');
}
