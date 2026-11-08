// Draws a synthetic sample as the eval set and the training set store it: a PNG of the page, a
// phone photo as JPEG, or an A4 PDF.

import type { Page } from '@playwright/test'
import type { Sample } from '../src/lib/synthetic'
import { sampleHtml } from '../src/lib/templates'

export const EXT = { png: 'png', jpeg: 'jpg', pdf: 'pdf' } as const

export async function render(page: Page, s: Sample, path: string) {
  await page.setContent(sampleHtml(s), { waitUntil: 'load' })
  if (s.look.format === 'pdf') {
    await page.pdf({ path, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } })
  } else if (s.look.format === 'jpeg') {
    await page.locator('body').screenshot({ path, type: 'jpeg', quality: 62 })
  } else {
    await page.locator('.page').screenshot({ path, type: 'png' })
  }
}
