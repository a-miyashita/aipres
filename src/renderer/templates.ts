import type { Slide } from '../model/types.js';
import { renderContent } from './sanitizer.js';
import { encodeImageToBase64 } from './assets.js';

async function renderNotes(notes?: string): Promise<string> {
  if (!notes) return '';
  const rendered = await renderContent(notes, 'block');
  return `<aside class="notes">${rendered}</aside>`;
}

async function renderTitleSlide(slide: Slide): Promise<string> {
  const title = slide.title ? `<h1>${await renderContent(slide.title, 'inline')}</h1>` : '';
  const subtitle = slide.subtitle ? `<p class="subtitle">${await renderContent(slide.subtitle, 'inline')}</p>` : '';
  return `<section class="title-slide" data-id="${slide.id}">
  ${title}
  ${subtitle}
  ${await renderNotes(slide.notes)}
</section>`;
}

async function renderContentSlide(slide: Slide): Promise<string> {
  const title = slide.title ? `<h2>${await renderContent(slide.title, 'inline')}</h2>` : '';
  const body = slide.body ? `<div class="content">${await renderContent(slide.body, 'block')}</div>` : '';
  return `<section data-id="${slide.id}">
  ${title}
  ${body}
  ${await renderNotes(slide.notes)}
</section>`;
}

async function renderTwoColumnSlide(slide: Slide): Promise<string> {
  const title = slide.title ? `<h2>${await renderContent(slide.title, 'inline')}</h2>` : '';
  const left = slide.leftCol
    ? `<div class="col-left">${await renderContent(slide.leftCol, 'block')}</div>`
    : '<div class="col-left"></div>';
  const right = slide.rightCol
    ? `<div class="col-right">${await renderContent(slide.rightCol, 'block')}</div>`
    : '<div class="col-right"></div>';
  return `<section data-id="${slide.id}">
  ${title}
  <div class="columns">
    ${left}
    ${right}
  </div>
  ${await renderNotes(slide.notes)}
</section>`;
}

async function renderImageSlide(slide: Slide): Promise<string> {
  const title = slide.title ? `<h2>${await renderContent(slide.title, 'inline')}</h2>` : '';
  let imgSrc = slide.imageUrl ?? '';
  if (imgSrc && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://') && !imgSrc.startsWith('data:')) {
    try {
      imgSrc = await encodeImageToBase64(imgSrc);
    } catch {
      console.warn(`[templates] Could not load image: ${imgSrc}`);
      imgSrc = '';
    }
  }
  const img = imgSrc ? `<img class="slide-image" src="${imgSrc}" alt="${slide.title ?? ''}" />` : '';
  return `<section data-id="${slide.id}">
  ${title}
  ${img}
  ${await renderNotes(slide.notes)}
</section>`;
}

async function renderBlankSlide(slide: Slide): Promise<string> {
  return `<section data-id="${slide.id}">
  ${await renderNotes(slide.notes)}
</section>`;
}

export async function renderSlide(slide: Slide): Promise<string> {
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
