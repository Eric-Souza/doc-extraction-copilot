// Renders the synthetic eval set with headless Chromium:
//   eval/data/<id>.png|jpg|pdf   the documents
//   eval/data/labels.json        what each one says, and its planted inconsistency if any
//   public/samples/*.png         the demo samples on the page
// Usage: npm run dataset [-- --per-type 12]

import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, type Page } from '@playwright/test'
import { makeSamples, type Sample } from '../src/lib/synthetic'
import { sampleHtml } from '../src/lib/templates'

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? Number(process.argv[i + 1]) : fallback
}

const EXT = { png: 'png', jpeg: 'jpg', pdf: 'pdf' } as const

async function render(page: Page, s: Sample, path: string) {
  await page.setContent(sampleHtml(s), { waitUntil: 'load' })
  if (s.look.format === 'pdf') {
    await page.pdf({ path, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } })
  } else if (s.look.format === 'jpeg') {
    await page.locator('body').screenshot({ path, type: 'jpeg', quality: 62 })
  } else {
    await page.locator('.page').screenshot({ path, type: 'png' })
  }
}

async function main() {
  const samples = makeSamples(arg('per-type', 12))
  await mkdir('eval/data', { recursive: true })
  await mkdir('public/samples', { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1.5 })

  const labels = []
  for (const s of samples) {
    const file = `${s.id}.${EXT[s.look.format]}`
    await render(page, s, `eval/data/${file}`)
    labels.push({ id: s.id, file, type: s.doc.type, look: s.look, planted: s.planted ?? null, truth: s.doc.data })
    process.stdout.write('.')
  }
  await writeFile('eval/data/labels.json', `${JSON.stringify(labels, null, 2)}\n`)

  // The page's samples: one clean document of each type, and the tampered boleto
  const clean = { format: 'png', rotate: 0, blur: 0, contrast: 1 } as const
  const demo: [string, Sample | undefined][] = [
    ['boleto', samples.find((s) => s.doc.type === 'boleto' && !s.planted)],
    ['boleto-adulterado', samples.find((s) => s.doc.type === 'boleto' && s.planted)],
    ['nfe', samples.find((s) => s.doc.type === 'nfe' && !s.planted)],
    ['informe', samples.find((s) => s.doc.type === 'informe' && !s.planted)],
  ]
  for (const [name, s] of demo) if (s) await render(page, { ...s, look: clean }, `public/samples/${name}.png`)
  await browser.close()
  console.log(`\n${samples.length} documents in eval/data, ${demo.length} samples in public/samples`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
