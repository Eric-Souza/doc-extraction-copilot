// Writes guard/tests/fixtures.json for the guard's parity test: every document the eval has (the
// true values, planted errors included, and each model's cached reading), with the fields the
// app's checks send to review. The guard must flag the same fields.
//
// Usage: npx tsx scripts/guard-fixtures.ts

import { existsSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { reviewDocument } from '../src/lib/review'
import type { DocType, Extracted } from '../src/lib/schemas'

// The same reference date as scripts/eval.ts
const TODAY = '2026-10-27'

interface Fixture {
  id: string
  type: DocType
  data: Extracted['data']
  failed: string[]
}

async function main() {
  const labels: { id: string; type: DocType; truth: Extracted['data'] }[] = JSON.parse(await readFile('eval/data/labels.json', 'utf8'))
  const docs: { id: string; doc: Extracted }[] = labels.map((l) => ({ id: `truth/${l.id}`, doc: { type: l.type, data: l.truth } as Extracted }))
  for (const dir of readdirSync('eval/results')) {
    for (const l of labels) {
      const path = `eval/results/${dir}/${l.id}.json`
      if (!existsSync(path)) continue
      const cached = JSON.parse(await readFile(path, 'utf8'))
      if (cached.doc) docs.push({ id: `${dir}/${l.id}`, doc: cached.doc })
    }
  }
  const fixtures: Fixture[] = docs.map(({ id, doc }) => {
    const review = reviewDocument(doc, new Date(`${TODAY}T12:00:00Z`))
    const failed = [...new Set(review.checks.filter((c) => !c.ok).flatMap((c) => c.paths))].sort()
    return { id, type: doc.type, data: doc.data, failed }
  })
  await writeFile('guard/tests/fixtures.json', `${JSON.stringify({ today: TODAY, fixtures }, null, 1)}\n`)
  console.log(`${fixtures.length} documents, ${fixtures.filter((f) => f.failed.length).length} with a failed check`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
