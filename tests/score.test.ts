import { describe, expect, it } from 'vitest'
import { reviewDocument } from '@/lib/review'
import { fieldName, sameValue, scoreDocument, summarize } from '@/lib/score'
import { makeSamples } from '@/lib/synthetic'

const TODAY = new Date('2026-10-27T12:00:00Z')

describe('sameValue', () => {
  it('compares amounts in cents', () => {
    expect(sameValue('valor', 10.1, 10.1000001)).toBe(true)
    expect(sameValue('valor', 10.1, 10.11)).toBe(false)
    expect(sameValue('valor', 10.1, '10.10')).toBe(false)
  })
  it('compares identifiers by their digits', () => {
    expect(sameValue('emitente.cnpj', '11.222.333/0001-81', '11222333000181')).toBe(true)
    expect(sameValue('linhaDigitavel', '00190.50095 40144', '0019050095-40144')).toBe(true)
  })
  it('ignores case and spacing in text, and needs a null for a missing field', () => {
    expect(sameValue('pagador', 'Ana  Lima', 'ana lima')).toBe(true)
    expect(sameValue('nossoNumero', null, null)).toBe(true)
    expect(sameValue('nossoNumero', null, '123')).toBe(false)
  })
  it('counts the bank by name or by code', () => {
    expect(sameValue('banco', 'Bradesco 237-2', 'Bradesco')).toBe(true)
    expect(sameValue('banco', 'Inter 077-9', '077-9')).toBe(true)
    expect(sameValue('banco', 'Inter 077-9', 'Itaú 341-7')).toBe(false)
  })
  it('collapses line indices into one field name', () => {
    expect(fieldName('itens[3].valorTotal')).toBe('itens[].valorTotal')
  })
})

describe('scoreDocument', () => {
  const sample = makeSamples(3).find((s) => s.doc.type === 'boleto')!
  if (sample.doc.type !== 'boleto') throw new Error('no boleto sample')
  const truth = sample.doc.data

  it('scores a perfect read as an exact match with nothing to flag', () => {
    const s = scoreDocument(sample.id, truth, truth, reviewDocument(sample.doc, TODAY))
    expect(s.exact).toBe(true)
    expect(s.fields.every((f) => f.right && !f.shouldFlag && !f.flagged)).toBe(true)
  })

  it('counts a misread that the checks caught, and one that slipped through', () => {
    const got = { ...truth, valor: truth.valor! + 1, pagador: 'Someone Else' }
    const s = scoreDocument(sample.id, truth, got, reviewDocument({ type: 'boleto', data: got }, TODAY))
    const valor = s.fields.find((f) => f.path === 'valor')!
    const pagador = s.fields.find((f) => f.path === 'pagador')!
    expect(valor).toMatchObject({ right: false, flagged: true, shouldFlag: true })
    expect(pagador).toMatchObject({ right: false, flagged: false, shouldFlag: true })

    const sum = summarize([s])
    expect(sum.exactMatch).toBe(0)
    expect(sum.silentErrors).toBe(1)
    expect(sum.flagPrecision).toBe(1)
    expect(sum.flagRecall).toBe(0.5)
    expect(sum.perField[0].accuracy).toBe(0)
  })
})
