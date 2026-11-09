// Runs the extraction on every document in eval/data and scores it against labels.json.
// Answers are cached in eval/results/<model>/, so a rerun only calls the model for documents it
// has not read yet, and the free tier's daily quota goes further.
//
// Usage: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/eval.ts [--known-type] [--fresh] [--delay 4000] [--guard]
// (or npm run eval, with the key in the environment)
//
// --guard sends each reading through the Guardrails server (GUARD_URL, http://localhost:8100 by
// default) and reads the document again when a check fails. The first reading comes from the plain
// run's cache, so only the second costs a call. Results go to eval/results/<model>-guarded/.
// With PHOENIX_COLLECTOR_ENDPOINT set, the calls it makes are traced to Phoenix.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extract, extractGuarded, type Reask } from '../src/lib/extract'
import { modelId } from '../src/lib/model'
import { reviewDocument } from '../src/lib/review'
import type { DocType, Extracted } from '../src/lib/schemas'
import { type DocScore, scoreDocument, summarize } from '../src/lib/score'
import type { Look, Planted } from '../src/lib/synthetic'
import { flushTraces, traceToPhoenix } from '../src/lib/tracing'

interface Label {
  id: string
  file: string
  type: DocType
  look: Look
  planted: Planted | null
  truth: object
}
type Cached = { doc: Extracted; ms: number } | { error: string; ms: number }
type CachedGuarded = { doc: Extracted; reask?: Reask; ms: number } | { error: string; ms: number }

const flag = (name: string) => process.argv.includes(`--${name}`)
const option = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? Number(process.argv[i + 1]) : fallback
}
const MEDIA = { png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf' } as Record<string, string>
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const list = (xs: string[]) => xs.join(', ') || '-'
// The reference date the digit lines were generated around, so due dates decode the same way any day
const TODAY = new Date('2026-10-27T12:00:00Z')

async function main() {
  traceToPhoenix('doc-extraction-eval')
  const knownType = flag('known-type')
  const guardUrl = flag('guard') ? process.env.GUARD_URL || 'http://localhost:8100' : undefined
  const model = modelId()
  // Ollama names like qwen3.5:2b are not valid folder names on Windows
  const dir = `eval/results/${model.replace(/[:/]/g, '-')}${process.env.AI_SCHEMA_IN_PROMPT ? '-schema-in-prompt' : ''}${knownType ? '-known-type' : ''}`
  const out = guardUrl ? `${dir}-guarded` : dir
  await mkdir(dir, { recursive: true })
  await mkdir(out, { recursive: true })
  const labels: Label[] = JSON.parse(await readFile('eval/data/labels.json', 'utf8'))

  const scores: (DocScore & { label: Label; cached: Cached })[] = []
  // The documents read twice, with both readings' scores
  const reasked: { label: Label; first: DocScore; second: DocScore; reask: Reask }[] = []
  let classified = 0
  for (const label of labels) {
    const ext = label.file.split('.').pop()!
    const upload = async () => ({ data: new Uint8Array(await readFile(`eval/data/${label.file}`)), mediaType: MEDIA[ext], name: `document.${ext}` })
    const path = `${dir}/${label.id}.json`
    let cached: Cached
    if (existsSync(path) && !flag('fresh')) cached = JSON.parse(await readFile(path, 'utf8'))
    else {
      const started = Date.now()
      try {
        const doc = await extract(await upload(), { type: knownType ? label.type : undefined })
        cached = { doc, ms: Date.now() - started }
      } catch (error) {
        cached = { error: error instanceof Error ? error.message : String(error), ms: Date.now() - started }
      }
      // A missing model or key fails every document the same way: stop rather than score it
      if ('error' in cached && /no longer available|not found|api key/i.test(cached.error)) throw new Error(cached.error)
      // Quota errors are not the model's reading: leave them out of the cache to retry later
      if ('doc' in cached || !/quota|rate limit|429/i.test(cached.error)) await writeFile(path, `${JSON.stringify(cached, null, 2)}\n`)
      process.stdout.write('error' in cached ? 'x' : '.')
      await new Promise((r) => setTimeout(r, option('delay', 4000)))
    }
    if ('error' in cached || cached.doc.type !== label.type) {
      // A failed or misclassified document scores every field as wrong and unflagged
      const empty = { fields: [], checks: [], toReview: 0 }
      scores.push({ ...scoreDocument(label.id, label.truth, {}, empty), label, cached })
      continue
    }
    classified++
    const score = (doc: Extracted) => scoreDocument(label.id, label.truth, doc.data, reviewDocument(doc, TODAY), label.planted?.paths)

    if (guardUrl) {
      const gpath = `${out}/${label.id}.json`
      let guarded: CachedGuarded
      if (existsSync(gpath) && !flag('fresh')) guarded = JSON.parse(await readFile(gpath, 'utf8'))
      else {
        const started = Date.now()
        const first = cached.doc
        try {
          const g = await extractGuarded(await upload(), { type: first.type, guardUrl, today: TODAY, first })
          // A guard that is down would score as "nothing to re-ask": stop instead
          if (g.guardError) throw new Error(`The guard at ${guardUrl} failed: ${g.guardError}`)
          guarded = { doc: g.doc, reask: g.reask, ms: Date.now() - started }
        } catch (error) {
          if (String(error).includes(`The guard at ${guardUrl}`)) throw error
          guarded = { error: error instanceof Error ? error.message : String(error), ms: Date.now() - started }
        }
        if ('doc' in guarded || !/quota|rate limit|429/i.test(guarded.error)) await writeFile(gpath, `${JSON.stringify(guarded, null, 2)}\n`)
        process.stdout.write('error' in guarded ? 'x' : guarded.reask ? 'r' : '.')
        if ('error' in guarded || guarded.reask) await new Promise((r) => setTimeout(r, option('delay', 4000)))
      }
      // A second reading that failed leaves the first one, as the app does
      if ('doc' in guarded && guarded.reask) {
        const second = score(guarded.doc)
        reasked.push({ label, first: score(cached.doc), second, reask: guarded.reask })
        scores.push({ ...second, label, cached: { doc: guarded.doc, ms: cached.ms + guarded.ms } })
        continue
      }
    }
    scores.push({ ...score(cached.doc), label, cached })
  }

  const s = summarize(scores)
  const group = (key: (x: (typeof scores)[number]) => string) => {
    const groups = new Map<string, typeof scores>()
    for (const x of scores) groups.set(key(x), [...(groups.get(key(x)) ?? []), x])
    return [...groups].map(([name, xs]) => ({ name, ...summarize(xs) }))
  }
  const row = (g: { name: string } & ReturnType<typeof summarize>) =>
    `| ${g.name} | ${g.documents} | ${pct(g.fieldAccuracy)} | ${pct(g.exactMatch)} | ${pct(g.flagPrecision)} | ${pct(g.flagRecall)} | ${g.silentErrors} |`
  const head = '| | Docs | Field accuracy | Exact match | Flag precision | Flag recall | Silent errors |\n|---|---|---|---|---|---|---|'
  const planted = scores.filter((x) => x.label.planted)
  const caught = planted.filter((x) => x.label.planted!.paths.every((p) => x.fields.find((f) => f.path === p)?.flagged))
  const ms = scores.map((x) => x.cached.ms).sort((a, b) => a - b)
  const wrong = scores.flatMap((x) =>
    x.fields.filter((f) => !f.right).map((f) => `| ${x.id} | ${f.path} | ${f.flagged ? 'flagged' : '**silent**'} |`),
  )

  // What the second reading did to each field: a planted value is right when it stays as printed
  const second = reasked.map(({ label, first, second, reask }) => {
    const before = new Map(first.fields.map((f) => [f.path, f.right]))
    const after = new Map(second.fields.map((f) => [f.path, f.right]))
    const plantedPaths = label.planted?.paths ?? []
    return {
      id: label.id,
      failed: reask.issues.length,
      changed: reask.changed,
      fixed: [...before].filter(([p, ok]) => !ok && after.get(p)).map(([p]) => p),
      broken: [...before].filter(([p, ok]) => ok && !after.get(p)).map(([p]) => p),
      stillFailing: reask.after.length,
      // kept as printed, changed away from what is printed, or misread the first time already
      planted: !plantedPaths.length
        ? ''
        : !plantedPaths.every((p) => before.get(p))
          ? 'misread'
          : plantedPaths.every((p) => after.get(p))
            ? 'kept'
            : '**changed**',
    }
  })
  const sum = (f: (r: (typeof second)[number]) => number) => second.reduce((n, r) => n + f(r), 0)
  const guardSection = guardUrl
    ? [
        '## Guard and second reading',
        '',
        `${reasked.length} of ${classified} readings failed a check and were read again. ` +
          `${sum((r) => r.changed.length)} fields changed: ${sum((r) => r.fixed.length)} fixed, ${sum((r) => r.broken.length)} broken. ` +
          `${second.filter((r) => r.stillFailing).length} still failed a check after it. ` +
          `Of the planted errors read right the first time, ${second.filter((r) => r.planted === 'kept').length} were kept as printed ` +
          `and ${second.filter((r) => r.planted === '**changed**').length} changed to pass the check.`,
        '',
        '| Document | Checks failed | Changed | Fixed | Broken | Still failing | Planted error |',
        '|---|---|---|---|---|---|---|',
        ...second.map(
          (r) =>
            `| ${r.id} | ${r.failed} | ${list(r.changed)} | ${list(r.fixed)} | ${list(r.broken)} | ${r.stillFailing} | ${r.planted} |`,
        ),
        '',
      ]
    : []

  const report = [
    `# Eval: ${model}${knownType ? ' (type given)' : ' (type detected)'}${guardUrl ? ', guarded' : ''}`,
    '',
    `${s.documents} synthetic documents, ${s.totalFields} fields. Classified correctly: ${classified}/${labels.length}. ` +
      `Median time per document: ${(ms[Math.floor(ms.length / 2)] / 1000).toFixed(1)}s.`,
    '',
    head,
    row({ name: '**All**', ...s }),
    ...group((x) => x.label.type).map(row),
    ...group((x) => ({ png: 'Clean PNG', pdf: 'PDF', jpeg: 'Phone photo (JPEG)' })[x.label.look.format]).map(row),
    '',
    `Planted inconsistencies caught: ${caught.length}/${planted.length}. ${s.flaggedFields} of ${s.totalFields} fields were sent to review.`,
    '',
    ...guardSection,
    '## Accuracy per field',
    '',
    '| Field | Accuracy | Count |',
    '|---|---|---|',
    ...s.perField.map((f) => `| ${f.name} | ${pct(f.accuracy)} | ${f.count} |`),
    '',
    '## Every wrong field',
    '',
    ...(wrong.length ? ['| Document | Field | Review |', '|---|---|---|', ...wrong] : ['None.']),
    '',
  ].join('\n')
  await writeFile(`${out}/report.md`, report)
  await writeFile(`${out}/summary.json`, `${JSON.stringify({ model, knownType, classified, ...s, ...(guardUrl ? { secondReadings: second } : {}) }, null, 2)}\n`)
  console.log(`\n${report.split('## Accuracy per field')[0]}\nFull report: ${out}/report.md`)
  await flushTraces()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
