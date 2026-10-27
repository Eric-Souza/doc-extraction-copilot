'use client'

import { useMemo, useState } from 'react'
import { fieldLabel, formatAmount, getPath, isMoneyField, parseAmount, setPath } from '@/lib/fields'
import { type FieldReport, reviewDocument, type Status } from '@/lib/review'
import { DOC_LABELS, DOC_TYPES, type DocType, type Extracted } from '@/lib/schemas'

interface Result {
  doc: Extracted
  model: string
  ms: number
}

const SAMPLES = [
  { file: 'boleto.png', label: 'Boleto' },
  { file: 'boleto-adulterado.png', label: 'Tampered boleto' },
  { file: 'nfe.png', label: 'DANFE' },
  { file: 'informe.png', label: 'Informe' },
]

/** Lists shown as tables, by document type */
const TABLES: Record<DocType, { key: string; title: string }[]> = {
  boleto: [],
  nfe: [{ key: 'itens', title: 'Products' }],
  informe: [
    { key: 'isentos', title: 'Exempt income (isentos)' },
    { key: 'exclusivos', title: 'Exclusive taxation (tributação exclusiva)' },
    { key: 'bens', title: 'Assets (bens e direitos)' },
  ],
}

type Shown = Status | 'confirmed'

const BADGE: Record<Shown, { text: string; icon: string; className: string }> = {
  ok: { text: 'Checked', icon: '✓', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  review: { text: 'Review', icon: '!', className: 'bg-amber-50 text-amber-900 ring-amber-300' },
  unchecked: { text: 'Not checked', icon: '–', className: 'bg-zinc-50 text-zinc-600 ring-zinc-200' },
  confirmed: { text: 'Confirmed', icon: '✓', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
}

function Badge({ status }: { status: Shown }) {
  const b = BADGE[status]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${b.className}`}>
      <span aria-hidden>{b.icon}</span>
      {b.text}
    </span>
  )
}

const display = (path: string, value: unknown) =>
  value === null || value === undefined ? '' : typeof value === 'number' && isMoneyField(path) ? formatAmount(value) : String(value)

/** A field's input: it keeps what the user types and commits the parsed value on blur */
function FieldInput({ path, value, status, onCommit, className = '' }: { path: string; value: unknown; status: Shown; onCommit: (v: unknown) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const text = draft.trim()
    let next: unknown = text === '' ? null : text
    if (isMoneyField(path)) next = parseAmount(text)
    else if (typeof value === 'number' && text !== '') next = Number(text.replace(',', '.'))
    setDraft(null)
    if (next !== value && !(typeof next === 'number' && Number.isNaN(next))) onCommit(next)
  }
  const ring = status === 'review' ? 'border-amber-400 bg-amber-50/60' : 'border-zinc-200 bg-white'
  return (
    <input
      aria-label={fieldLabel(path)}
      data-path={path}
      className={`w-full rounded-md border px-2 py-1 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 ${ring} ${isMoneyField(path) || typeof value === 'number' ? 'text-right tabular-nums' : ''} ${className}`}
      value={draft ?? display(path, value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export function Extractor() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [type, setType] = useState<'auto' | DocType>('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState(false)

  const review = useMemo(() => (result ? reviewDocument(result.doc) : null), [result])
  const byPath = useMemo(() => new Map(review?.fields.map((f) => [f.path, f])), [review])
  const shown = (f: FieldReport | undefined): Shown => (f && f.status === 'review' && confirmed.has(f.path) ? 'confirmed' : (f?.status ?? 'unchecked'))
  const left = review ? review.fields.filter((f) => f.status === 'review' && !confirmed.has(f.path)).length : 0

  async function run(f: File, as = type) {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(f))
    setLoading(true)
    setError(null)
    setResult(null)
    setConfirmed(new Set())
    try {
      const form = new FormData()
      form.set('file', f)
      form.set('type', as)
      const res = await fetch('/api/extract', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong.')
      setResult({ doc: { type: body.type, data: body.data }, model: body.model, ms: body.ms })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function trySample(name: string) {
    const blob = await (await fetch(`/samples/${name}`)).blob()
    await run(new File([blob], name, { type: 'image/png' }), 'auto')
  }

  /** A correction: the model's doubt about the field goes, and the checks rerun */
  function edit(path: string, value: unknown) {
    if (!result) return
    let data = setPath(result.doc.data, path, value)
    data = { ...data, uncertain: data.uncertain.filter((p) => p !== path && !path.startsWith(`${p}.`)) }
    setResult({ ...result, doc: { ...result.doc, data } as Extracted })
    setConfirmed((c) => new Set([...c].filter((p) => p !== path)))
  }

  function download() {
    if (!result || !review) return
    const body = { type: result.doc.type, data: { ...result.doc.data, uncertain: undefined }, checks: review.checks, confirmedByUser: [...confirmed] }
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${result.doc.type}.json` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const tables = result ? TABLES[result.doc.type] : []
  const scalar = review?.fields.filter((f) => !tables.some((t) => f.path.startsWith(`${t.key}[`))) ?? []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="space-y-4">
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) run(f)
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-300 bg-white hover:border-indigo-400'}`}
        >
          <span className="text-sm font-semibold text-zinc-900">Drop a boleto, DANFE or informe de rendimentos</span>
          <span className="mt-1 text-xs text-zinc-500">PNG, JPEG, WebP or PDF, up to 8 MB. Photos are fine.</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="sr-only"
            data-testid="file-input"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) run(f)
              e.target.value = ''
            }}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="doc-type" className="text-zinc-600">
            Document type
          </label>
          <select
            id="doc-type"
            value={type}
            onChange={(e) => setType(e.target.value as 'auto' | DocType)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900"
          >
            <option value="auto">Detect it</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Or try a fictional sample</p>
          <div className="grid grid-cols-4 gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.file}
                type="button"
                onClick={() => trySample(s.file)}
                disabled={loading}
                className="group overflow-hidden rounded-lg border border-zinc-200 bg-white text-left transition hover:border-indigo-400 disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/samples/${s.file}`} alt="" className="h-16 w-full object-cover object-top" />
                <span className="block px-2 py-1 text-xs font-medium text-zinc-700 group-hover:text-indigo-700">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {preview && file && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500">{file.name}</div>
            {file.type === 'application/pdf' ? (
              <iframe src={preview} title="Document" className="h-[560px] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="The uploaded document" className="w-full" />
            )}
          </div>
        )}
      </section>

      <section className="min-w-0">
        {!result && !loading && !error && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm leading-6 text-zinc-600">
            <h2 className="mb-2 text-base font-semibold text-zinc-900">How it works</h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Gemini reads the document and returns every field as typed JSON.</li>
              <li>Code checks what it can: CPF and CNPJ check digits, the boleto digit line, the NF-e access key, and that the totals add up.</li>
              <li>You only review the fields that failed a check or that the model was unsure of.</li>
            </ol>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            Reading the document…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        {result && review && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{DOC_LABELS[result.doc.type]}</div>
                <div className="mt-0.5 text-lg font-semibold text-zinc-900" data-testid="summary">
                  {left === 0 ? 'Nothing left to review' : `${left} field${left === 1 ? '' : 's'} to review`}
                </div>
                <div className="text-xs text-zinc-500">
                  {review.fields.filter((f) => f.status === 'ok').length} of {review.fields.length} fields confirmed by a check · read by {result.model} in{' '}
                  {(result.ms / 1000).toFixed(1)}s
                </div>
              </div>
              <button
                type="button"
                onClick={download}
                disabled={left > 0}
                title={left > 0 ? 'Review the flagged fields first' : undefined}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Download JSON
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900">Checks</h2>
              <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="checks">
                {review.checks.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex gap-2 text-xs leading-5">
                    <span aria-label={c.ok ? 'passed' : 'failed'} className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-200 text-amber-900'}`}>
                      {c.ok ? '✓' : '!'}
                    </span>
                    <span>
                      <span className="font-medium text-zinc-800">{c.name}:</span> <span className="text-zinc-600">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">Fields</h2>
              <div className="divide-y divide-zinc-100">
                {scalar.map((f) => (
                  <div key={f.path} className="grid gap-2 py-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-start" data-field={f.path}>
                    <div className="pt-1 text-sm text-zinc-600">{fieldLabel(f.path)}</div>
                    <div>
                      <FieldInput path={f.path} value={f.value} status={shown(f)} onCommit={(v) => edit(f.path, v)} />
                      {f.status === 'review' && <Notes f={f} />}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge status={shown(f)} />
                      {f.status === 'review' && !confirmed.has(f.path) && (
                        <button type="button" onClick={() => setConfirmed((c) => new Set(c).add(f.path))} className="text-xs font-medium text-indigo-700 hover:underline">
                          It&apos;s right
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {tables.map((t) => {
              const rows = (getPath(result.doc.data, t.key) as object[] | undefined) ?? []
              if (!rows.length) return null
              const cols = Object.keys(rows[0])
              const flagged = review.fields.filter((f) => f.path.startsWith(`${t.key}[`) && f.status === 'review')
              return (
                <div key={t.key} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-900">{t.title}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          {cols.map((c) => (
                            <th key={c} className="px-1 pb-1 font-medium">
                              {fieldLabel(`${t.key}[0].${c}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((_, i) => (
                          <tr key={i}>
                            {cols.map((c) => {
                              const path = `${t.key}[${i}].${c}`
                              const f = byPath.get(path)
                              return (
                                <td key={c} className={`p-1 ${c === 'descricao' ? 'w-1/2' : ''}`} data-field={path}>
                                  <FieldInput path={path} value={f?.value} status={shown(f)} onCommit={(v) => edit(path, v)} />
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {flagged.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {flagged.map((f) => (
                        <li key={f.path} className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-amber-50/70 px-3 py-2">
                          <div>
                            <div className="text-xs font-medium text-zinc-800">
                              Line {Number(f.path.match(/\[(\d+)\]/)![1]) + 1}, {fieldLabel(f.path).toLowerCase()}
                            </div>
                            <Notes f={f} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge status={shown(f)} />
                            {!confirmed.has(f.path) && (
                              <button type="button" onClick={() => setConfirmed((c) => new Set(c).add(f.path))} className="text-xs font-medium text-indigo-700 hover:underline">
                                It&apos;s right
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Notes({ f }: { f: FieldReport }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {f.notes.map((n, i) => (
        <li key={i} className="text-xs text-amber-900">
          {n}
        </li>
      ))}
    </ul>
  )
}
