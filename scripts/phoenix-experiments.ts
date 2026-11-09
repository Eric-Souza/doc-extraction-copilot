// Logs cached eval runs to Phoenix as experiments on one dataset, the eval set, so runs can be
// compared document by document: field accuracy, silent errors, exact match, the planted error, and
// whether the guard had the document read again. No model is called: the outputs come from
// eval/results/<run>/, written by scripts/eval.ts, and are scored with the same code.
//
// Usage: npx tsx scripts/phoenix-experiments.ts gemini-3.5-flash-lite gemini-3.5-flash-lite-guarded ...
// (Phoenix at PHOENIX_COLLECTOR_ENDPOINT, http://localhost:6006 by default)

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { reviewDocument } from '../src/lib/review'
import type { DocType, Extracted } from '../src/lib/schemas'
import { scoreDocument } from '../src/lib/score'
import type { Look, Planted } from '../src/lib/synthetic'

interface Label {
  id: string
  file: string
  type: DocType
  look: Look
  planted: Planted | null
  truth: object
}
type Cached = { doc: Extracted; reask?: { issues: unknown[]; changed: string[] }; ms: number } | { error: string; ms: number }

const PHOENIX = (process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006').replace(/\/$/, '')
const DATASET = 'doc-extraction-eval'
// The same reference date as scripts/eval.ts
const TODAY = new Date('2026-10-27T12:00:00Z')

async function api<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${PHOENIX}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Phoenix answered ${res.status} to ${path}: ${(await res.text()).slice(0, 300)}`)
  return res.json() as Promise<T>
}

/** The eval set as a dataset, created the first time: example ids by document id */
async function dataset(labels: Label[]): Promise<{ id: string; examples: Map<string, string> }> {
  const found = await api<{ data: { id: string; name: string }[] }>(`/v1/datasets?name=${DATASET}`)
  let id = found.data.find((d) => d.name === DATASET)?.id
  if (!id) {
    const created = await api<{ data: { dataset_id: string } }>('/v1/datasets/upload?sync=true', {
      action: 'create',
      name: DATASET,
      description: 'Synthetic boletos, DANFEs and informes with their true values (eval/data/labels.json)',
      inputs: labels.map((l) => ({ id: l.id, file: l.file, type: l.type, look: l.look })),
      outputs: labels.map((l) => ({ truth: l.truth })),
      metadata: labels.map((l) => ({ planted: l.planted })),
    })
    id = created.data.dataset_id
  }
  const { data } = await api<{ data: { examples: { id: string; input: { id: string } }[] } }>(`/v1/datasets/${id}/examples`)
  return { id, examples: new Map(data.examples.map((e) => [e.input.id, e.id])) }
}

async function main() {
  const runs = process.argv.slice(2)
  if (!runs.length) throw new Error('Name the runs to log, like gemini-3.5-flash-lite gemini-3.5-flash-lite-guarded')
  const labels: Label[] = JSON.parse(await readFile('eval/data/labels.json', 'utf8'))
  const { id: datasetId, examples } = await dataset(labels)

  for (const run of runs) {
    const guarded = run.endsWith('-guarded')
    const summary = JSON.parse(await readFile(`eval/results/${run}/summary.json`, 'utf8'))
    const { data: experiment } = await api<{ data: { id: string } }>(`/v1/datasets/${datasetId}/experiments`, {
      name: run,
      metadata: { model: summary.model, knownType: summary.knownType, guarded },
      repetitions: 1,
    })
    for (const label of labels) {
      // A guarded run only has the documents the model classified right; the rest are the first run's
      const path = [`eval/results/${run}/${label.id}.json`, `eval/results/${run.replace(/-guarded$/, '')}/${label.id}.json`].find(existsSync)
      if (!path) continue
      const cached: Cached = JSON.parse(await readFile(path, 'utf8'))
      const ok = 'doc' in cached && cached.doc.type === label.type
      const score = ok
        ? scoreDocument(label.id, label.truth, cached.doc.data, reviewDocument(cached.doc, TODAY), label.planted?.paths)
        : scoreDocument(label.id, label.truth, {}, { fields: [], checks: [], toReview: 0 })
      const end = new Date()
      const times = { start_time: new Date(end.getTime() - cached.ms).toISOString(), end_time: end.toISOString() }
      const { data: created } = await api<{ data: { id: string } }>(`/v1/experiments/${experiment.id}/runs`, {
        dataset_example_id: examples.get(label.id),
        output: 'doc' in cached ? { ...cached.doc, ...(cached.reask ? { reask: cached.reask } : {}) } : null,
        repetition_number: 1,
        ...times,
        error: 'error' in cached ? cached.error : null,
      })

      const right = score.fields.filter((f) => f.right).length
      const silent = score.fields.filter((f) => !f.right && !f.flagged).map((f) => f.path)
      const results: { name: string; score: number; label?: string; explanation?: string }[] = [
        { name: 'field accuracy', score: right / score.fields.length, explanation: `${right} of ${score.fields.length} fields right` },
        { name: 'silent errors', score: silent.length, explanation: silent.join(', ') || undefined },
        { name: 'exact match', score: Number(score.exact), label: score.exact ? 'yes' : 'no' },
      ]
      if (label.planted) {
        const caught = label.planted.paths.every((p) => score.fields.find((f) => f.path === p)?.flagged)
        results.push({ name: 'planted error caught', score: Number(caught), label: caught ? 'yes' : 'no', explanation: label.planted.paths.join(', ') })
      }
      if (guarded && 'doc' in cached) {
        results.push({ name: 'read again', score: Number(Boolean(cached.reask)), label: cached.reask ? 'yes' : 'no', explanation: cached.reask?.changed.join(', ') || undefined })
      }
      for (const result of results) {
        const { name, ...rest } = result
        await api('/v1/experiment_evaluations', { experiment_run_id: created.id, name, annotator_kind: 'CODE', ...times, result: rest })
      }
    }
    console.log(`${run}: logged ${labels.length} runs`)
  }
  console.log(`${PHOENIX}/datasets/${datasetId}/experiments`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
