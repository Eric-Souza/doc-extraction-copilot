// One document in, typed fields out. When the type is not given, a first call classifies the
// document; a second reads its fields with that type's schema. Code checks them afterwards
// (review.ts), so the prompt asks the model to copy what is printed and never to fix it.

import { generateText, type LanguageModel, Output } from 'ai'
import type { z } from 'zod'
import { getModel } from './model'
import { ClassifySchema, type DocType, type Extracted, SCHEMAS } from './schemas'

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const
export const MAX_BYTES = 8 * 1024 * 1024

export interface Upload {
  data: Uint8Array
  mediaType: string
  name?: string
}

export class NotSupportedError extends Error {}

const SYSTEM = `You read Brazilian financial documents (boletos, DANFEs of NF-e, informes de rendimentos) from images and PDFs.
Copy every value exactly as printed. Never correct a digit, a check digit, a date or a total, even if it looks wrong: separate code checks them.
Amounts are numbers in reais (R$ 1.234,56 is 1234.56). Dates are YYYY-MM-DD (15/03/2026 is 2026-03-15).
A field the document does not show is null; never guess one.
List in "uncertain" the path of every field you could not read clearly (blur, glare, cut off, handwriting) or had to infer.`

const TYPE_HINTS: Record<DocType, string> = {
  boleto: 'This is a boleto. The digit line (linha digitável) is the long number above the barcode.',
  nfe: 'This is a DANFE. Read every product line. The access key is the 44 digits near the barcode.',
  informe:
    'This is an informe de rendimentos financeiros. Read every line of the exempt (isentos) and exclusive taxation (tributação exclusiva) sections, and each bens e direitos position.',
}

const filePart = (file: Upload) => ({ type: 'file' as const, data: file.data, mediaType: file.mediaType })

export async function classify(file: Upload, model: LanguageModel = getModel(), abortSignal?: AbortSignal): Promise<DocType | 'other'> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: ClassifySchema }),
    system: 'You classify Brazilian financial documents.',
    messages: [{ role: 'user', content: [{ type: 'text', text: `Which kind of document is this? File: ${file.name ?? 'upload'}` }, filePart(file)] }],
    abortSignal,
    timeout: { totalMs: 30_000 },
    maxRetries: 1,
  })
  return output.type
}

export async function extract(
  file: Upload,
  opts: { type?: DocType; model?: LanguageModel; abortSignal?: AbortSignal } = {},
): Promise<Extracted> {
  const model = opts.model ?? getModel()
  const type = opts.type ?? (await classify(file, model, opts.abortSignal))
  if (type === 'other') throw new NotSupportedError('This does not look like a boleto, a DANFE or an informe de rendimentos.')
  const { output } = await generateText({
    model,
    // One call per type, so the union of the three schemas is only for the compiler
    output: Output.object({ schema: SCHEMAS[type] as z.ZodType<Extracted['data']> }),
    system: SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: `${TYPE_HINTS[type]} File: ${file.name ?? 'upload'}` }, filePart(file)] }],
    abortSignal: opts.abortSignal,
    timeout: { totalMs: 90_000 },
    maxRetries: 2,
  })
  return { type, data: output } as Extracted
}
