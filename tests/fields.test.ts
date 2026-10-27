import { describe, expect, it } from 'vitest'
import { fieldLabel, getPath, isMoneyField, parseAmount, setPath } from '@/lib/fields'

describe('fields', () => {
  it('parses amounts typed the Brazilian way or with a dot', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('R$ 3.062,47')).toBe(3062.47)
    expect(parseAmount('1234.56')).toBe(1234.56)
    expect(parseAmount('')).toBeNull()
  })
  it('reads and writes nested paths without touching the original', () => {
    const doc = { itens: [{ valorTotal: 1 }, { valorTotal: 2 }] }
    const next = setPath(doc, 'itens[1].valorTotal', 5)
    expect(getPath(next, 'itens[1].valorTotal')).toBe(5)
    expect(doc.itens[1].valorTotal).toBe(2)
  })
  it('knows which fields are money and labels lines once', () => {
    expect(isMoneyField('isentos[0].valor')).toBe(true)
    expect(isMoneyField('itens[0].quantidade')).toBe(false)
    expect(fieldLabel('itens[4].valorTotal')).toBe(fieldLabel('itens[0].valorTotal'))
  })
})
