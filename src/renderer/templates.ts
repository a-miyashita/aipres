import { marked } from 'marked';
import type { Slide } from '../model/types.js';

function renderMarkdown(text: string): string {
  const result = marked.parse(text);
  if (typeof result === 'string') return result;
  // If promise, return synchronously rendered fallback
  return String(result);
}

function renderNotes(notes?: string): string {
  if (!notes) return '';
  return `<aside class="notes">${renderMarkdown(notes)}</aside>`;
}

function renderTitleSlide(slide: Slide): string {
  const title = slide.title ? `<h1>${slide.title}</h1>` : '';
  const subtitle = slide.subtitle ? `<p class="subtitle">${slide.subtitle}</p>` : '';
  return `<section class="title-slide" data-id="${slide.id}">
  ${title}
  ${subtitle}
  ${renderNotes(slide.notes)}
</section>`;
}

function renderContentSlide(slide: Slide): string {
  const title = slide.title ? `<h2>${slide.title}</h2>` : '';
  const body = slide.body ? `<div class="content">${renderMarkdown(slide.body)}</div>` : '';
  return `<section data-id="${slide.id}">
  ${title}
  ${body}
  ${renderNotes(slide.notes)}
</section>`;
}

function renderTwoColumnSlide(slide: Slide): string {
  const title = slide.title ? `<h2>${slide.title}</h2>` : '';
  const left = slide.leftCol ? `<div class="col-left">${renderMarkdown(slide.leftCol)}</div>` : '<div class="col-left"></div>';
  const right = slide.rightCol ? `<div class="col-right">${renderMarkdown(slide.rightCol)}</div>` : '<div class="col-right"></div>';
  return `<section data-id="${slide.id}">
  ${title}
  <div class="columns">
    ${left}
    ${right}
  </div>
  ${renderNotes(slide.notes)}
</section>`;
}

function renderImageSlide(slide: Slide): string {
  const title = slide.title ? `<h2>${slide.title}</h2>` : '';
  const img = slide.imageUrl ? `<img class="slide-image" src="${slide.imageUrl}" alt="${slide.title ?? ''}" />` : '';
  return `<section data-id="${slide.id}">
  ${title}
  ${img}
  ${renderNotes(slide.notes)}
</section>`;
}

function renderBlankSlide(slide: Slide): string {
  return `<section data-id="${slide.id}">
  ${renderNotes(slide.notes)}
</section>`;
}

export function renderSlide(slide: Slide): string {
  switch (slide.layout) {
    case 'title':
      return renderTitleSlide(slide);
    case 'content':
      return renderContentSlide(slide);
    case 'two-column':
      return renderTwoColumnSlide(slide);
    case 'image':
      return renderImageSlide(slide);
    case 'blank':
      return renderBlankSlide(slide);
    default:
      return renderContentSlide(slide);
  }
}
