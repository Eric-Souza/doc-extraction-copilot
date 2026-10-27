// Runs the extraction on every document in eval/data and scores it against labels.json.
// Answers are cached in eval/results/<model>/, so a rerun only calls the model for documents it
// has not read yet, and the free tier's daily quota goes further.
//
// Usage: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/eval.ts [--known-type] [--fresh] [--delay 4000]
// (or npm run eval, with the key in the environment)

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extract } from '../src/lib/extract'
import { modelId } from '../src/lib/model'
import { reviewDocument } from '../src/lib/review'
import type { DocType, Extracted } from '../src/lib/schemas'
import { type DocScore, scoreDocument, summarize } from '../src/lib/score'
import type { Look, Planted } from '../src/lib/synthetic'

interface Label {
  id: string
  file: string
  type: DocType
  look: Look
  planted: Planted | null
  truth: object
}
type Cached = { doc: Extracted; ms: number } | { error: string; ms: number }

const flag = (name: string) => process.argv.includes(`--${name}`)
const option = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? Number(process.argv[i + 1]) : fallback
}
const MEDIA = { png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf' } as Record<string, string>
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
// The reference date the digit lines were generated around, so due dates decode the same way any day
const TODAY = new Date('2026-10-27T12:00:00Z')

async function main() {
  const knownType = flag('known-type')
  const model = modelId()
  const dir = `eval/results/${model}${knownType ? '-known-type' : ''}`
  await mkdir(dir, { recursive: true })
  const labels: Label[] = JSON.parse(await readFile('eval/data/labels.json', 'utf8'))

  const scores: (DocScore & { label: Label; cached: Cached })[] = []
  let classified = 0
  for (const label of labels) {
    const path = `${dir}/${label.id}.json`
    let cached: Cached
    if (existsSync(path) && !flag('fresh')) cached = JSON.parse(await readFile(path, 'utf8'))
    else {
      const ext = label.file.split('.').pop()!
      const started = Date.now()
      try {
        const doc = await extract(
          { data: new Uint8Array(await readFile(`eval/data/${label.file}`)), mediaType: MEDIA[ext], name: `document.${ext}` },
          { type: knownType ? label.type : undefined },
        )
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
    const review = reviewDocument(cached.doc, TODAY)
    scores.push({ ...scoreDocument(label.id, label.truth, cached.doc.data, review, label.planted?.paths), label, cached })
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

  const report = [
    `# Eval: ${model}${knownType ? ' (type given)' : ' (type detected)'}`,
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
  await writeFile(`${dir}/report.md`, report)
  await writeFile(`${dir}/summary.json`, `${JSON.stringify({ model, knownType, classified, ...s }, null, 2)}\n`)
  console.log(`\n${report.split('## Accuracy per field')[0]}\nFull report: ${dir}/report.md`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
