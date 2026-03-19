import { v4 as uuidv4 } from 'uuid';
import type { SlideModel, Slide, SlideLayout, Result } from './types.js';

export interface AddSlideInput {
  layout: SlideLayout;
  title?: string;
  subtitle?: string;
  body?: string;
  leftCol?: string;
  rightCol?: string;
  imageUrl?: string;
  notes?: string;
  insertAt?: number;
}

export function addSlide(model: SlideModel, input: AddSlideInput): Result<SlideModel> {
  const { insertAt, ...fields } = input;
  const newSlide: Slide = {
    id: uuidv4(),
    ...fields,
  };

  const slides = [...model.slides];
  if (insertAt !== undefined) {
    if (insertAt < 0 || insertAt > slides.length) {
      return { ok: false, error: `insertAt ${insertAt} is out of range (0-${slides.length})` };
    }
    slides.splice(insertAt, 0, newSlide);
  } else {
    slides.push(newSlide);
  }

  return { ok: true, value: { ...model, slides } };
}

export function updateSlide(
  model: SlideModel,
  index: number,
  patch: Partial<Omit<Slide, 'id' | 'layout'>>
): Result<SlideModel> {
  if (index < 0 || index >= model.slides.length) {
    return { ok: false, error: `Index ${index} is out of range (0-${model.slides.length - 1})` };
  }

  const slides = [...model.slides];
  slides[index] = { ...slides[index], ...patch };

  return { ok: true, value: { ...model, slides } };
}

export function deleteSlide(model: SlideModel, index: number): Result<SlideModel> {
  if (index < 0 || index >= model.slides.length) {
    return { ok: false, error: `Index ${index} is out of range (0-${model.slides.length - 1})` };
  }

  const slides = [...model.slides];
  slides.splice(index, 1);

  return { ok: true, value: { ...model, slides } };
}

export function reorderSlides(model: SlideModel, from: number, to: number): Result<SlideModel> {
  if (from < 0 || from >= model.slides.length) {
    return { ok: false, error: `from index ${from} is out of range (0-${model.slides.length - 1})` };
  }
  if (to < 0 || to >= model.slides.length) {
    return { ok: false, error: `to index ${to} is out of range (0-${model.slides.length - 1})` };
  }

  const slides = [...model.slides];
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);

  return { ok: true, value: { ...model, slides } };
}

export function setTheme(model: SlideModel, theme: string): Result<SlideModel> {
  return { ok: true, value: { ...model, theme } };
}

export function setRevealOption(model: SlideModel, key: string, value: unknown): Result<SlideModel> {
  return {
    ok: true,
    value: {
      ...model,
      revealOptions: { ...model.revealOptions, [key]: value },
    },
  };
}
