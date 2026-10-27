import { extractErrorMessage } from '@/lib/errors'
import { ACCEPTED_TYPES, extract, MAX_BYTES, NotSupportedError } from '@/lib/extract'
import { modelId } from '@/lib/model'
import { DOC_TYPES, type DocType } from '@/lib/schemas'

// Classifying and reading a multi-page PDF can take most of a minute on the free tier
export const maxDuration = 120

const json = (body: object, status = 200) => Response.json(body, { status })

/**
 * Takes a form with `file` (an image or a PDF) and `type` ("auto" or a document type), and
 * returns the fields the model read. The checks run in the browser, so they rerun as the user
 * corrects a field.
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
    const doc = await extract(
      { data: new Uint8Array(await file.arrayBuffer()), mediaType: file.type, name: file.name },
      { type: type === 'auto' ? undefined : (type as DocType), abortSignal: req.signal },
    )
    return json({ ...doc, model: modelId(), ms: Date.now() - started })
  } catch (error) {
    if (error instanceof NotSupportedError) return json({ error: error.message }, 422)
    return json({ error: extractErrorMessage(error) }, 502)
  }
}
