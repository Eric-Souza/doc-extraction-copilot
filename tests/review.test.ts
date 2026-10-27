import { describe, expect, it } from 'vitest'
import { flatten, reviewDocument } from '@/lib/review'
import type { Boleto, Extracted, Nfe } from '@/lib/schemas'
import { makeSamples } from '@/lib/synthetic'

const TODAY = new Date('2026-10-27T12:00:00Z')
const samples = makeSamples(12)
const flagged = (doc: Extracted) =>
  reviewDocument(doc, TODAY)
    .fields.filter((f) => f.status === 'review')
    .map((f) => f.path)
    .sort()

describe('review', () => {
  it('passes every consistent synthetic document', () => {
    for (const s of samples.filter((s) => !s.planted)) expect(flagged(s.doc), s.id).toEqual([])
  })

  it('flags exactly the planted inconsistencies', () => {
    const planted = samples.filter((s) => s.planted)
    expect(planted).toHaveLength(6)
    for (const s of planted) expect(flagged(s.doc), s.id).toEqual([...s.planted!.paths].sort())
  })

  it('flags a misread CNPJ, digit line and due date on a boleto', () => {
    const doc = structuredClone(samples.find((s) => s.id === 'boleto-01')!.doc) as { type: 'boleto'; data: Boleto }
    const ok = reviewDocument(doc, TODAY)
    expect(ok.fields.find((f) => f.path === 'valor')?.status).toBe('ok')

    doc.data.beneficiarioDocumento = doc.data.beneficiarioDocumento!.replace(/\d(?=\D*$)/, (d) => String((Number(d) + 1) % 10))
    expect(flagged(doc)).toEqual(['beneficiarioDocumento'])

    doc.data.linhaDigitavel = doc.data.linhaDigitavel.replace(/^(\d)/, (d) => String((Number(d) + 1) % 10))
    expect(flagged(doc)).toContain('linhaDigitavel')
  })

  it('cross-checks an NF-e against its access key', () => {
    const doc = structuredClone(samples.find((s) => s.id === 'nfe-01')!.doc) as { type: 'nfe'; data: Nfe }
    doc.data.numero += 1
    doc.data.emitente.uf = doc.data.emitente.uf === 'SP' ? 'RJ' : 'SP'
    const r = reviewDocument(doc, TODAY)
    expect(flagged(doc)).toEqual(['emitente.uf', 'numero'])
    expect(r.checks.find((c) => c.name === 'Number in key')?.detail).toMatch(/^the access key says \d+$/)
  })

  it('flags what the model was unsure of, including whole lines', () => {
    const doc = structuredClone(samples.find((s) => s.id === 'nfe-01')!.doc) as { type: 'nfe'; data: Nfe }
    doc.data.uncertain = ['destinatario.nome', 'itens[1]']
    const r = reviewDocument(doc, TODAY)
    expect(flagged(doc)).toEqual(['destinatario.nome', 'itens[1].descricao', 'itens[1].quantidade', 'itens[1].valorTotal', 'itens[1].valorUnitario'])
    expect(r.toReview).toBe(5)
    expect(r.fields.find((f) => f.path === 'destinatario.nome')?.notes).toContain('The model was not sure it read this right')
  })

  it('flattens nested fields to paths, leaving out the uncertain list', () => {
    expect(flatten({ a: 1, b: { c: [{ d: 2 }] }, uncertain: ['a'] })).toEqual([
      ['a', 1],
      ['b.c[0].d', 2],
    ])
  })
})
