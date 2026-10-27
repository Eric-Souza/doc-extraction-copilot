// The linha digitável, the number printed above a boleto's barcode. It carries its own check
// digits, and it encodes the amount and (for bank boletos) the due date, so both can be checked
// against what the model read from the rest of the page.
//
// Bank boletos have 47 digits:
//   AAABC.CCCCX DDDDD.DDDDDY EEEEE.EEEEEZ K UUUUVVVVVVVVVV
//   bank, currency, free field split over three blocks with a mod 10 digit each (X, Y, Z),
//   the barcode's mod 11 digit (K), the due date factor (UUUU) and the amount in cents.
// Utility and tax boletos (arrecadação) have 48 digits, start with 8, and are four blocks of 11
// digits, each followed by a mod 10 or mod 11 digit.

import { mod10, mod11, onlyDigits, weightedSum11 } from './ids'

export interface BoletoCheck {
  kind: 'bank' | 'utility'
  /** Each failed check, in words; empty when the line is consistent */
  errors: string[]
  /** The amount the line encodes, in reais, or null when it encodes none */
  amount: number | null
  /** The due date the line encodes, YYYY-MM-DD, or null when it encodes none */
  dueDate: string | null
  /** The three-digit bank code, for bank boletos */
  bank?: string
  /** The 44-digit barcode the line stands for */
  barcode: string
}

const DAY = 86_400_000

/** The barcode's general check digit for bank boletos: mod 11, with 0, 10 and 11 becoming 1 */
function bankBarcodeDigit(digits43: string): number {
  const dv = 11 - (weightedSum11(digits43) % 11)
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv
}

/**
 * The due date factor counts days from 1997-10-07. It reached 9999 on 2025-02-21 and started
 * again at 1000 the next day, so one factor stands for two dates 9000 days apart: take the one
 * closer to the reference date.
 */
export function dueDateFromFactor(factor: number, reference = new Date()): string | null {
  if (factor === 0) return null
  const old = Date.UTC(1997, 9, 7) + factor * DAY
  const current = Date.UTC(2025, 1, 22) + (factor - 1000) * DAY
  const ref = reference.getTime()
  const pick = Math.abs(current - ref) <= Math.abs(old - ref) ? current : old
  return new Date(pick).toISOString().slice(0, 10)
}

/** The factor for a due date in the current cycle, from 2025-02-22 */
export function factorFromDueDate(iso: string): number {
  const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.UTC(2025, 1, 22)) / DAY)
  if (days < 0 || days > 8999) throw new Error(`${iso} is outside the current due date cycle`)
  return days + 1000
}

function checkBank(line: string, reference: Date): BoletoCheck {
  const errors: string[] = []
  const blocks = [
    [line.slice(0, 9), line[9]],
    [line.slice(10, 20), line[20]],
    [line.slice(21, 31), line[31]],
  ] as const
  blocks.forEach(([digits, dv], i) => {
    if (mod10(digits) !== Number(dv)) errors.push(`block ${i + 1} check digit is ${dv}, expected ${mod10(digits)}`)
  })
  const barcode = line.slice(0, 4) + line[32] + line.slice(33, 47) + line.slice(4, 9) + line.slice(10, 20) + line.slice(21, 31)
  const general = bankBarcodeDigit(barcode.slice(0, 4) + barcode.slice(5))
  if (general !== Number(line[32])) errors.push(`general check digit is ${line[32]}, expected ${general}`)
  const cents = Number(line.slice(37, 47))
  return {
    kind: 'bank',
    errors,
    amount: cents ? cents / 100 : null,
    dueDate: dueDateFromFactor(Number(line.slice(33, 37)), reference),
    bank: line.slice(0, 3),
    barcode,
  }
}

function checkUtility(line: string): BoletoCheck {
  const errors: string[] = []
  // The third digit says how the amount is written and which check digit the blocks use
  const valueId = line[2]
  const useMod10 = valueId === '6' || valueId === '7'
  if (!'6789'.includes(valueId)) errors.push(`value identifier is ${valueId}, expected 6, 7, 8 or 9`)
  const check = useMod10 ? mod10 : mod11
  let barcode = ''
  for (let i = 0; i < 4; i++) {
    const digits = line.slice(i * 12, i * 12 + 11)
    const dv = Number(line[i * 12 + 11])
    if (check(digits) !== dv) errors.push(`block ${i + 1} check digit is ${dv}, expected ${check(digits)}`)
    barcode += digits
  }
  const general = check(barcode.slice(0, 3) + barcode.slice(4))
  if (general !== Number(barcode[3])) errors.push(`general check digit is ${barcode[3]}, expected ${general}`)
  // 6 and 8 mean the amount is in reais; 7 and 9 mean it is a reference number
  const cents = Number(barcode.slice(4, 15))
  return { kind: 'utility', errors, amount: (valueId === '6' || valueId === '8') && cents ? cents / 100 : null, dueDate: null, barcode }
}

/** Checks a linha digitável as printed, with or without dots and spaces */
export function checkLinhaDigitavel(value: string, reference = new Date()): BoletoCheck {
  const line = onlyDigits(value)
  if (line.length === 47) return checkBank(line, reference)
  if (line.length === 48 && line[0] === '8') return checkUtility(line)
  const kind = line[0] === '8' ? 'utility' : 'bank'
  const expected = kind === 'utility' ? 48 : 47
  return { kind, errors: [`has ${line.length} digits, expected ${expected}`], amount: null, dueDate: null, barcode: '' }
}

/** Builds a valid bank linha digitável, for the synthetic test documents */
export function makeBankLine(bank: string, amount: number, dueDate: string | null, freeField: string): string {
  if (!/^\d{3}$/.test(bank) || !/^\d{25}$/.test(freeField)) throw new Error('bank needs 3 digits and the free field 25')
  const factor = dueDate ? String(factorFromDueDate(dueDate)) : '0000'
  const tail = factor + String(Math.round(amount * 100)).padStart(10, '0')
  const head = `${bank}9`
  const dv = bankBarcodeDigit(head + tail + freeField)
  const b1 = head + freeField.slice(0, 5)
  const b2 = freeField.slice(5, 15)
  const b3 = freeField.slice(15, 25)
  const withDv = (s: string) => s + mod10(s)
  const [f1, f2, f3] = [withDv(b1), withDv(b2), withDv(b3)]
  return `${f1.slice(0, 5)}.${f1.slice(5)} ${f2.slice(0, 5)}.${f2.slice(5)} ${f3.slice(0, 5)}.${f3.slice(5)} ${dv} ${tail}`
}

/** Builds a valid utility linha digitável (amount in reais, mod 10), for the synthetic documents */
export function makeUtilityLine(segment: string, amount: number, rest: string): string {
  if (!/^\d$/.test(segment) || !/^\d{29}$/.test(rest)) throw new Error('segment needs 1 digit and the rest 29')
  const body = `8${segment}6` + String(Math.round(amount * 100)).padStart(11, '0') + rest
  const barcode = body.slice(0, 3) + mod10(body) + body.slice(3)
  const blocks = [0, 1, 2, 3].map((i) => barcode.slice(i * 11, i * 11 + 11))
  return blocks.map((b) => `${b}-${mod10(b)}`).join(' ')
}
