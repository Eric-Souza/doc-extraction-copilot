// Local vision models (through Ollama or vLLM) take images, not PDFs, so a PDF is drawn page by
// page first. The fine-tune's training set goes through the same function, so the model sees
// the same pixels in training and in the eval.

import { createCanvas } from '@napi-rs/canvas'
import type { LanguageModelMiddleware } from 'ai'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** 1.5 times 72 dpi: an A4 page becomes 893 x 1263, the size of the eval's screenshots */
export const PDF_SCALE = 1.5

export async function pdfToPngs(data: Uint8Array, scale = PDF_SCALE): Promise<Uint8Array[]> {
  // pdf.js takes ownership of the buffer it is given, so it gets a copy
  const pdf = await getDocument({ data: data.slice(), useSystemFonts: true }).promise
  const pages: Uint8Array[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise
    pages.push(new Uint8Array(await canvas.encode('png')))
  }
  await pdf.destroy()
  return pages
}

type Prompt = Parameters<NonNullable<LanguageModelMiddleware['transformParams']>>[0]['params']['prompt']

/** Replaces every PDF in a prompt with one PNG per page */
export async function pdfsToImages(prompt: Prompt): Promise<Prompt> {
  return Promise.all(
    prompt.map(async (message) => {
      if (message.role !== 'user') return message
      const content = []
      for (const part of message.content) {
        if (part.type === 'file' && part.mediaType === 'application/pdf' && part.data instanceof Uint8Array) {
          for (const png of await pdfToPngs(part.data)) content.push({ type: 'file' as const, data: png, mediaType: 'image/png' })
        } else content.push(part)
      }
      return { ...message, content }
    }),
  )
}

export const imagesOnly: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => ({ ...params, prompt: await pdfsToImages(params.prompt) }),
}
