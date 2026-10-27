import { describe, expect, it } from 'vitest'
import { completeCnpj, completeCpf, formatCnpj, formatCpf, isValidCnpj, isValidCpf, isValidDocument } from '@/lib/br/ids'

describe('CPF', () => {
  it('accepts valid CPFs, formatted or not', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('rejects a wrong check digit, a swapped digit, the wrong length and repeated digits', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('259.982.247-25')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })

  it('completes and formats', () => {
    expect(completeCpf('529982247')).toBe('52998224725')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
  })
})

describe('CNPJ', () => {
  it('accepts valid CNPJs', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000181')).toBe(true)
  })

  it('accepts the alphanumeric CNPJs issued from July 2026', () => {
    // The example in the Receita Federal technical note
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true)
    expect(isValidCnpj('12.abc.345/01de-35')).toBe(true)
    expect(isValidCnpj('12.ABC.345/01DE-36')).toBe(false)
  })

  it('rejects wrong digits and repeated digits', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false)
    expect(isValidCnpj('11.222.333/0010-81')).toBe(false)
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false)
  })

  it('completes and formats', () => {
    expect(completeCnpj('112223330001')).toBe('11222333000181')
    expect(formatCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })

  it('tells a CPF from a CNPJ by length', () => {
    expect(isValidDocument('529.982.247-25')).toBe(true)
    expect(isValidDocument('11.222.333/0001-81')).toBe(true)
    expect(isValidDocument('1234')).toBe(false)
  })
})
