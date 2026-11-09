// One document in, typed fields out. When the type is not given, a first call classifies the
// document; a second reads its fields with that type's schema. Code checks them afterwards
// (review.ts), so the prompt asks the model to copy what is printed and never to fix it.

import { SpanStatusCode, trace } from '@opentelemetry/api'
import { generateText, type LanguageModel, Output } from 'ai'
import type { z } from 'zod'
import { type GuardIssue, guardDocument, reaskText } from './guard'
import { getModel } from './model'
import { flatten } from './review'
import { ClassifySchema, type DocType, type Extracted, SCHEMAS } from './schemas'

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const
export const MAX_BYTES = 8 * 1024 * 1024

export interface Upload {
  data: Uint8Array
  mediaType: string
  name?: string
}

export class NotSupportedError extends Error {}

// Exported for the fine-tune's training set (scripts/make-train-set.ts), which must ask exactly the same
export const SYSTEM = `You read Brazilian financial documents (boletos, DANFEs of NF-e, informes de rendimentos) from images and PDFs.
Copy every value exactly as printed. Never correct a digit, a check digit, a date or a total, even if it looks wrong: separate code checks them.
Amounts are numbers in reais (R$ 1.234,56 is 1234.56). Dates are YYYY-MM-DD (15/03/2026 is 2026-03-15).
A field the document does not show is null; never guess one.
List in "uncertain" the path of every field you could not read clearly (blur, glare, cut off, handwriting) or had to infer.`

export const TYPE_HINTS: Record<DocType, string> = {
  boleto: 'This is a boleto. The digit line (linha digitável) is the long number above the barcode.',
  nfe: 'This is a DANFE. Read every product line. The access key is the 44 digits near the barcode.',
  informe:
    'This is an informe de rendimentos financeiros. Read every line of the exempt (isentos) and exclusive taxation (tributação exclusiva) sections, and each bens e direitos position.',
}

const tracer = trace.getTracer('doc-extraction-copilot')
// Spans for Phoenix, when tracing is registered (tracing.ts); without it they cost nothing
const telemetry = (functionId: string, metadata: Record<string, string> = {}) => ({ isEnabled: true, functionId, metadata })

const filePart = (file: Upload) => ({ type: 'file' as const, data: file.data, mediaType: file.mediaType })

export const CLASSIFY_SYSTEM = 'You classify Brazilian financial documents.'
export const classifyText = (name = 'upload') => `Which kind of document is this? File: ${name}`
export const extractText = (type: DocType, name = 'upload') => `${TYPE_HINTS[type]} File: ${name}`

export async function classify(file: Upload, model: LanguageModel = getModel(), abortSignal?: AbortSignal): Promise<DocType | 'other'> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: ClassifySchema }),
    system: CLASSIFY_SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: classifyText(file.name) }, filePart(file)] }],
    abortSignal,
    experimental_telemetry: telemetry('classify'),
    timeout: { totalMs: 30_000 },
    maxRetries: 1,
  })
  return output.type
}

/** Reads the fields of a known type; with a previous reading and its failed checks, reads them again */
async function read(
  file: Upload,
  type: DocType,
  model: LanguageModel,
  abortSignal?: AbortSignal,
  again?: { previous: Extracted; issues: GuardIssue[] },
): Promise<Extracted> {
  const { output } = await generateText({
    model,
    // One call per type, so the union of the three schemas is only for the compiler
    output: Output.object({ schema: SCHEMAS[type] as z.ZodType<Extracted['data']> }),
    system: SYSTEM,
    messages: [
      { role: 'user', content: [{ type: 'text', text: extractText(type, file.name) }, filePart(file)] },
      ...(again
        ? [
            { role: 'assistant' as const, content: JSON.stringify(again.previous.data) },
            { role: 'user' as const, content: reaskText(again.issues) },
          ]
        : []),
    ],
    abortSignal,
    experimental_telemetry: telemetry(again ? 'read-again' : 'read', { type }),
    timeout: { totalMs: 90_000 },
    maxRetries: 2,
  })
  return { type, data: output } as Extracted
}

export async function extract(
  file: Upload,
  opts: { type?: DocType; model?: LanguageModel; abortSignal?: AbortSignal } = {},
): Promise<Extracted> {
  const model = opts.model ?? getModel()
  const type = opts.type ?? (await classify(file, model, opts.abortSignal))
  if (type === 'other') throw new NotSupportedError('This does not look like a boleto, a DANFE or an informe de rendimentos.')
  return read(file, type, model, opts.abortSignal)
}

export interface Reask {
  /** The checks the first reading failed, which the model was shown */
  issues: GuardIssue[]
  /** The fields the second reading changed */
  changed: string[]
  /** The checks the second reading still fails */
  after: GuardIssue[]
}

export interface Guarded {
  doc: Extracted
  /** Present when the first reading failed a check and was read again */
  reask?: Reask
  /** The guard could not be reached, so the first reading is returned unchecked by it */
  guardError?: string
}

/**
 * extract, then the guard: a reading that fails a check is read once more with the failures. The
 * eval passes `first`, its cached first reading, so only the second reading costs a call.
 */
export async function extractGuarded(
  file: Upload,
  opts: { type?: DocType; model?: LanguageModel; abortSignal?: AbortSignal; guardUrl: string; today?: Date; first?: Extracted },
): Promise<Guarded> {
  // One trace per document: the readings, the guard calls and their validators under one span
  return tracer.startActiveSpan('extract', { attributes: { 'openinference.span.kind': 'CHAIN', 'input.value': file.name ?? 'upload' } }, async (span) => {
    try {
      const out = await guarded(file, opts)
      span.setAttributes({
        'output.value': JSON.stringify(out.doc.data),
        'output.mime_type': 'application/json',
        'document.type': out.doc.type,
        'guard.read_again': Boolean(out.reask),
        'guard.changed': out.reask?.changed ?? [],
      })
      return out
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
      throw error
    } finally {
      span.end()
    }
  })
}

async function guarded(file: Upload, opts: Parameters<typeof extractGuarded>[1]): Promise<Guarded> {
  const model = opts.model ?? getModel()
  const doc = opts.first ?? (await extract(file, { ...opts, model }))
  const guard = { url: opts.guardUrl, today: opts.today }
  let issues: GuardIssue[]
  try {
    issues = await guardDocument(doc, guard)
  } catch (error) {
    // The checks still run in the browser, so a guard that is down costs only the second look
    console.error('[guard]', error)
    return { doc, guardError: error instanceof Error ? error.message : String(error) }
  }
  if (!issues.length) return { doc }
  const second = await read(file, doc.type, model, opts.abortSignal, { previous: doc, issues })
  const before = new Map(flatten(doc.data).map(([path, value]) => [path, JSON.stringify(value)]))
  const changed = flatten(second.data)
    .filter(([path, value]) => before.get(path) !== JSON.stringify(value))
    .map(([path]) => path)
  const after = await guardDocument(second, guard).catch(() => issues)
  return { doc: second, reask: { issues, changed, after } }
}
