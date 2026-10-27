// Scores extractions against the eval set's known answers: accuracy per field, exact match per
// document, and how well the review flags line up with the fields that were actually wrong.

import { normalizeCnpj } from './br/ids'
import { bankCode, flatten, type Review } from './review'

/** Field paths with their indices taken out, so every line's total scores as one field */
export const fieldName = (path: string) => path.replace(/\[\d+\]/g, '[]')

const ID_FIELDS = /(Documento|documento|cnpj|cpf|linhaDigitavel|chaveAcesso|nossoNumero)$/

/** Whether a read value counts as right: same cents, same identifier digits, same text ignoring case and spacing */
export function sameValue(path: string, truth: unknown, got: unknown): boolean {
  if (truth === null || truth === undefined) return got === null || got === undefined || got === ''
  if (typeof truth === 'number') return typeof got === 'number' && Math.round(truth * 100) === Math.round(got * 100)
  if (typeof got !== 'string') return false
  if (ID_FIELDS.test(path)) return normalizeCnpj(String(truth)) === normalizeCnpj(got)
  const text = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
  // The bank is printed as a name and a code: the name alone, the code alone, or both count, as long as it is the same bank
  if (path === 'banco') return bankCode(got) !== undefined && bankCode(got) === bankCode(String(truth))
  return text(String(truth)) === text(got)
}

export interface DocScore {
  id: string
  fields: { path: string; right: boolean; flagged: boolean; shouldFlag: boolean }[]
  exact: boolean
}

export function scoreDocument(id: string, truth: object, got: object, review: Review, planted: string[] = []): DocScore {
  const gotValues = new Map(flatten(got))
  const status = new Map(review.fields.map((f) => [f.path, f.status]))
  const fields = flatten(truth).map(([path, value]) => {
    const right = sameValue(path, value, gotValues.get(path))
    return { path, right, flagged: status.get(path) === 'review', shouldFlag: !right || planted.includes(path) }
  })
  // A document only matches exactly if it has no extra lines either
  const extra = [...gotValues.keys()].some((p) => !fields.some((f) => f.path === p))
  return { id, fields, exact: !extra && fields.every((f) => f.right) }
}

export interface Summary {
  documents: number
  fieldAccuracy: number
  exactMatch: number
  /** Of the flagged fields, how many needed it */
  flagPrecision: number
  /** Of the fields that needed review, how many were flagged */
  flagRecall: number
  /** Wrong fields nobody was asked to look at: the number that matters */
  silentErrors: number
  flaggedFields: number
  totalFields: number
  perField: { name: string; accuracy: number; count: number }[]
}

const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b)

export function summarize(scores: DocScore[]): Summary {
  const all = scores.flatMap((s) => s.fields)
  const flagged = all.filter((f) => f.flagged)
  const needed = all.filter((f) => f.shouldFlag)
  const byName = new Map<string, { right: number; count: number }>()
  for (const f of all) {
    const e = byName.get(fieldName(f.path)) ?? { right: 0, count: 0 }
    e.count++
    if (f.right) e.right++
    byName.set(fieldName(f.path), e)
  }
  return {
    documents: scores.length,
    fieldAccuracy: ratio(all.filter((f) => f.right).length, all.length),
    exactMatch: ratio(scores.filter((s) => s.exact).length, scores.length),
    flagPrecision: ratio(flagged.filter((f) => f.shouldFlag).length, flagged.length),
    flagRecall: ratio(needed.filter((f) => f.flagged).length, needed.length),
    silentErrors: all.filter((f) => !f.right && !f.flagged).length,
    flaggedFields: flagged.length,
    totalFields: all.length,
    perField: [...byName].map(([name, e]) => ({ name, accuracy: e.right / e.count, count: e.count })).sort((a, b) => a.accuracy - b.accuracy || a.name.localeCompare(b.name)),
  }
}
