import { describe, expect, it } from 'vitest'
import { checkLinhaDigitavel, dueDateFromFactor, factorFromDueDate, makeBankLine, makeUtilityLine } from '@/lib/br/boleto'

const TODAY = new Date('2026-10-27T12:00:00Z')

describe('bank boletos', () => {
  it('reads a published Banco do Brasil sample line', () => {
    const r = checkLinhaDigitavel('00190.50095 40144.816069 06809.350314 3 37370000000100', new Date('2008-01-01'))
    expect(r.errors).toEqual([])
    expect(r.bank).toBe('001')
    expect(r.amount).toBe(1)
    expect(r.dueDate).toBe('2007-12-31')
    expect(r.barcode).toHaveLength(44)
  })

  it('round-trips a generated line with its amount and due date', () => {
    const line = makeBankLine('341', 1234.56, '2026-11-10', '1090000012345678901234567')
    const r = checkLinhaDigitavel(line, TODAY)
    expect(r.errors).toEqual([])
    expect(r.amount).toBe(1234.56)
    expect(r.dueDate).toBe('2026-11-10')
  })

  it('catches any single digit misread', () => {
    const line = makeBankLine('237', 89.9, '2026-12-01', '0000000000987654321012345').replace(/\D/g, '')
    for (let i = 0; i < line.length; i++) {
      const wrong = line.slice(0, i) + ((Number(line[i]) + 3) % 10) + line.slice(i + 1)
      expect(checkLinhaDigitavel(wrong, TODAY).errors, `digit ${i + 1}`).not.toEqual([])
    }
  })

  it('says which check failed and catches a missing digit', () => {
    const line = makeBankLine('001', 50, '2026-11-01', '1234567890123456789012345')
    const swapped = line.replace(/^(\d{5})\.(\d)(\d)/, '$1.$3$2')
    expect(checkLinhaDigitavel(swapped, TODAY).errors.join()).toMatch(/block 1|general/)
    expect(checkLinhaDigitavel(line.slice(0, -1), TODAY).errors).toEqual(['has 46 digits, expected 47'])
  })

  it('reads a line with no due date or amount', () => {
    const r = checkLinhaDigitavel(makeBankLine('104', 0, null, '1234567890123456789012345'), TODAY)
    expect(r.errors).toEqual([])
    expect(r.dueDate).toBeNull()
    expect(r.amount).toBeNull()
  })
})

describe('due date factor', () => {
  it('handles the reset to 1000 on 2025-02-22', () => {
    expect(dueDateFromFactor(9999, new Date('2025-02-01'))).toBe('2025-02-21')
    expect(dueDateFromFactor(1000, new Date('2025-03-01'))).toBe('2025-02-22')
    expect(dueDateFromFactor(1000, new Date('2000-07-01'))).toBe('2000-07-03')
    expect(factorFromDueDate('2025-02-22')).toBe(1000)
    expect(factorFromDueDate('2026-10-27')).toBe(1612)
  })
})

describe('utility boletos', () => {
  it('reads a published energy bill line', () => {
    const r = checkLinhaDigitavel('83640000001-1 33120138000-2 81288462711-6 08013618155-1', TODAY)
    expect(r.kind).toBe('utility')
    expect(r.errors).toEqual([])
    expect(r.amount).toBe(133.12)
  })

  it('round-trips a generated line and catches a misread', () => {
    const line = makeUtilityLine('2', 245.8, '00851234567890123456789012345')
    const r = checkLinhaDigitavel(line, TODAY)
    expect(r.errors).toEqual([])
    expect(r.amount).toBe(245.8)
    const digits = line.replace(/\D/g, '')
    const wrong = digits.slice(0, 15) + ((Number(digits[15]) + 1) % 10) + digits.slice(16)
    expect(checkLinhaDigitavel(wrong, TODAY).errors).not.toEqual([])
  })
})
