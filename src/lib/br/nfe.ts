// The NF-e access key (chave de acesso), the 44 digits printed on every DANFE. Besides its check
// digit, it encodes the issuer's state, the month of issue, the issuer's CNPJ, the model, the
// series and the invoice number, which can each be compared with the fields read from the page.
//
//   UU AAMM CCCCCCCCCCCCCC MM SSS NNNNNNNNN T RRRRRRRR D
//   state, year and month, CNPJ, model (55 NF-e, 65 NFC-e), series, number, emission type, random
//   code, check digit

import { mod11, normalizeCnpj } from './ids'

export const UF_CODES: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

export interface NfeKey {
  errors: string[]
  uf?: string
  /** YYYY-MM */
  month?: string
  cnpj?: string
  model?: string
  series?: number
  number?: number
}

/** The key as printed, in groups of four, with letters allowed in the CNPJ part since 2026 */
export function normalizeKey(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

export function checkNfeKey(value: string): NfeKey {
  const key = normalizeKey(value)
  if (key.length !== 44) return { errors: [`has ${key.length} characters, expected 44`] }
  const errors: string[] = []
  if (!/^\d{6}[0-9A-Z]{12}\d{26}$/.test(key)) errors.push('has letters outside the CNPJ part')
  const dv = mod11(key.slice(0, 43))
  if (dv !== Number(key[43])) errors.push(`check digit is ${key[43]}, expected ${dv}`)
  const uf = UF_CODES[key.slice(0, 2)]
  if (!uf) errors.push(`state code ${key.slice(0, 2)} does not exist`)
  const mm = Number(key.slice(4, 6))
  if (mm < 1 || mm > 12) errors.push(`month ${key.slice(4, 6)} does not exist`)
  const model = key.slice(20, 22)
  if (model !== '55' && model !== '65') errors.push(`model is ${model}, expected 55 or 65`)
  return {
    errors,
    uf,
    month: `20${key.slice(2, 4)}-${key.slice(4, 6)}`,
    cnpj: key.slice(6, 20),
    model,
    series: Number(key.slice(22, 25)),
    number: Number(key.slice(25, 34)),
  }
}

/** Builds a valid key, for the synthetic test documents */
export function makeNfeKey(p: { uf: string; date: string; cnpj: string; series: number; number: number; code: string }): string {
  const ufCode = Object.entries(UF_CODES).find(([, uf]) => uf === p.uf)?.[0]
  if (!ufCode) throw new Error(`unknown state ${p.uf}`)
  const base =
    ufCode +
    p.date.slice(2, 4) +
    p.date.slice(5, 7) +
    normalizeCnpj(p.cnpj) +
    '55' +
    String(p.series).padStart(3, '0') +
    String(p.number).padStart(9, '0') +
    '1' +
    p.code.padStart(8, '0')
  const key = base + mod11(base)
  return key.match(/.{4}/g)!.join(' ')
}
