// Renders a training set for the fine-tune (github.com/Eric-Souza/doc-extraction-finetune): the
// same three document types as the eval set, from other seeds, with the exact prompts the app
// sends and the known answers as the replies.
//   <out>/images/*.png|jpg   what the model sees: a PDF is drawn page by page, as the local
//                            provider does at inference (src/lib/pdf-images.ts)
//   <out>/train.jsonl        one chat per line: system, prompt, images, answer
//   <out>/val.jsonl          the held-out part, for the eval loss during training
// Usage: npx tsx scripts/make-train-set.ts --out ../doc-extraction-finetune/data [--batches 25] [--seed 100]

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { CLASSIFY_SYSTEM, classifyText, extractText, SYSTEM } from '../src/lib/extract'
import { pdfToPngs } from '../src/lib/pdf-images'
import { SCHEMAS } from '../src/lib/schemas'
import { makeSamples, rng } from '../src/lib/synthetic'
import { EXT, render } from './render'

const option = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}

// Every identifier the eval set uses, so a training document can never be one of its answers
async function evalIds(): Promise<Set<string>> {
  const labels: { truth: Record<string, unknown> }[] = JSON.parse(await readFile('eval/data/labels.json', 'utf8'))
  return new Set(labels.map((l) => String(l.truth.linhaDigitavel ?? l.truth.chaveAcesso ?? JSON.stringify(l.truth))))
}

async function main() {
  const out = option('out', '../doc-extraction-finetune/data')
  const batches = Number(option('batches', '25'))
  const seed = Number(option('seed', '100'))
  await rm(out, { recursive: true, force: true })
  await mkdir(`${out}/images`, { recursive: true })
  const reserved = await evalIds()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1.5 })
  const pick = rng(seed)

  const rows: object[] = []
  let skipped = 0
  // Batches of 12 per type, as the eval set is made: the last two of each type have a planted
  // inconsistency, so the model learns to copy a wrong total rather than fix it
  for (let b = 0; b < batches; b++) {
    for (const s of makeSamples(12, seed + b)) {
      const truth = s.doc.data as unknown as Record<string, unknown>
      if (reserved.has(String(truth.linhaDigitavel ?? truth.chaveAcesso ?? JSON.stringify(truth)))) {
        skipped++
        continue
      }
      const id = `s${seed + b}-${s.id}`
      const file = `${out}/images/${id}.${EXT[s.look.format]}`
      await render(page, s, file)
      let images = [`images/${id}.${EXT[s.look.format]}`]
      if (s.look.format === 'pdf') {
        const pngs = await pdfToPngs(new Uint8Array(await readFile(file)))
        images = await Promise.all(
          pngs.map(async (png, n) => {
            await writeFile(`${out}/images/${id}-p${n + 1}.png`, png)
            return `images/${id}-p${n + 1}.png`
          }),
        )
        await rm(file)
      }
      const name = `document.${EXT[s.look.format]}`
      // Parsing puts the keys in the schema's order, the order the reply is written in
      const answer = JSON.stringify(SCHEMAS[s.doc.type].parse(s.doc.data))
      const split = pick.next() < 0.05 ? 'val' : 'train'
      rows.push({ split, id, task: 'extract', images, system: SYSTEM, prompt: extractText(s.doc.type, name), answer })
      // The app classifies first when the type is not given; a third of the documents teach that too
      if (pick.next() < 0.34) {
        rows.push({ split, id, task: 'classify', images, system: CLASSIFY_SYSTEM, prompt: classifyText(name), answer: JSON.stringify({ type: s.doc.type }) })
      }
    }
    process.stdout.write('.')
  }
  await browser.close()
  for (const split of ['train', 'val']) {
    const lines = rows.filter((r) => (r as { split: string }).split === split).map((r) => JSON.stringify(r))
    await writeFile(`${out}/${split}.jsonl`, `${lines.join('\n')}\n`)
  }
  console.log(`\n${rows.length} examples from ${batches * 36 - skipped} documents in ${out} (${skipped} skipped: in the eval set)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
