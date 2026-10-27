import { describe, expect, it } from 'vitest'
import { checkNfeKey, makeNfeKey } from '@/lib/br/nfe'

const params = { uf: 'SP', date: '2026-09-15', cnpj: '11.222.333/0001-81', series: 1, number: 4521, code: '12345678' }

describe('NF-e access key', () => {
  it('decodes a generated key', () => {
    const key = makeNfeKey(params)
    expect(key).toMatch(/^(\d{4} ){10}\d{4}$/)
    expect(checkNfeKey(key)).toEqual({ errors: [], uf: 'SP', month: '2026-09', cnpj: '11222333000181', model: '55', series: 1, number: 4521 })
  })

  it('accepts an alphanumeric CNPJ in the key', () => {
    const r = checkNfeKey(makeNfeKey({ ...params, cnpj: '12.ABC.345/01DE-35' }))
    expect(r.errors).toEqual([])
    expect(r.cnpj).toBe('12ABC34501DE35')
  })

  it('catches a misread digit and a wrong length', () => {
    const key = makeNfeKey(params).replace(/\s/g, '')
    for (const i of [0, 10, 30, 43]) {
      const wrong = key.slice(0, i) + ((Number(key[i]) + 1) % 10) + key.slice(i + 1)
      expect(checkNfeKey(wrong).errors, `digit ${i + 1}`).not.toEqual([])
    }
    expect(checkNfeKey(key.slice(1)).errors).toEqual(['has 43 characters, expected 44'])
  })
})
