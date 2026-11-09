import { extractErrorMessage } from '@/lib/errors'
import { ACCEPTED_TYPES, extract, extractGuarded, MAX_BYTES, NotSupportedError } from '@/lib/extract'
import { modelId } from '@/lib/model'
import { DOC_TYPES, type DocType } from '@/lib/schemas'

// Classifying and reading a multi-page PDF can take most of a minute on the free tier
export const maxDuration = 120

const json = (body: object, status = 200) => Response.json(body, { status })

/**
 * Takes a form with `file` (an image or a PDF) and `type` ("auto" or a document type), and
 * returns the fields the model read. The checks run in the browser, so they rerun as the user
 * corrects a field. With GUARD_URL set, the Guardrails server in guard/ runs them first, and a
 * reading that fails one is read once more (`reask` in the answer).
 */
export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'Send the document as multipart form data.' }, 400)
  }
  const file = form.get('file')
  const type = String(form.get('type') ?? 'auto')
  if (!(file instanceof File)) return json({ error: 'Choose a file first.' }, 400)
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return json({ error: 'Use a PNG, JPEG or WebP image, or a PDF.' }, 415)
  if (file.size > MAX_BYTES) return json({ error: `The file is over ${MAX_BYTES / 1024 / 1024} MB.` }, 413)
  if (type !== 'auto' && !(DOC_TYPES as readonly string[]).includes(type)) return json({ error: 'Unknown document type.' }, 400)

  const started = Date.now()
  try {
    const upload = { data: new Uint8Array(await file.arrayBuffer()), mediaType: file.type, name: file.name }
    const opts = { type: type === 'auto' ? undefined : (type as DocType), abortSignal: req.signal }
    const guardUrl = process.env.GUARD_URL
    const { doc, ...guarded } = guardUrl ? await extractGuarded(upload, { ...opts, guardUrl }) : { doc: await extract(upload, opts) }
    return json({ ...doc, ...guarded, model: modelId(), ms: Date.now() - started })
  } catch (error) {
    if (error instanceof NotSupportedError) return json({ error: error.message }, 422)
    return json({ error: extractErrorMessage(error) }, 502)
  }
}
