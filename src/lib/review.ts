// Decides which fields a person should look at. Each field starts as "unchecked"; a check that
// passes marks the fields it covers "ok", and a check that fails, or the model saying it was
// unsure, marks them "review". Review wins over ok: one failed check is enough.

import { checkLinhaDigitavel } from './br/boleto'
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, isValidDocument, normalizeCnpj } from './br/ids'
import { checkNfeKey } from './br/nfe'
import type { Boleto, Extracted, Informe, Nfe } from './schemas'

export type Status = 'ok' | 'review' | 'unchecked'

export interface FieldReport {
  /** Like "valor" or "itens[2].valorTotal" */
  path: string
  value: unknown
  status: Status
  /** Why it is ok or needs review, in words */
  notes: string[]
}

export interface Check {
  name: string
  ok: boolean
  detail: string
  paths: string[]
}

export interface Review {
  fields: FieldReport[]
  checks: Check[]
  /** How many fields need review */
  toReview: number
}

const cents = (n: number) => Math.round(n * 100)
const sameMoney = (a: number, b: number) => Math.abs(cents(a) - cents(b)) <= 1
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

/** Every leaf of the extracted data, by path, leaving out the model's own list of uncertain fields */
export function flatten(value: unknown, prefix = ''): [string, unknown][] {
  if (Array.isArray(value)) return value.flatMap((v, i) => flatten(v, `${prefix}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      prefix === '' && k === 'uncertain' ? [] : flatten(v, prefix ? `${prefix}.${k}` : k),
    )
  }
  return [[prefix, value]]
}

class Checks {
  list: Check[] = []
  add(name: string, ok: boolean, detail: string, paths: string[]) {
    this.list.push({ name, ok, detail, paths })
  }
  /** A CPF or CNPJ, when one was read */
  id(name: string, path: string, value: string | null | undefined, kind: 'cpf' | 'cnpj' | 'either') {
    if (!value) return
    const ok = kind === 'cpf' ? isValidCpf(value) : kind === 'cnpj' ? isValidCnpj(value) : isValidDocument(value)
    const n = normalizeCnpj(value)
    const what = n.length === 11 ? 'CPF' : n.length === 14 ? 'CNPJ' : kind === 'cpf' ? 'CPF' : 'CNPJ'
    this.add(name, ok, ok ? `${what} check digits match` : `${value} is not a valid ${kind === 'either' ? 'CPF or CNPJ' : what}`, [path])
  }
  date(path: string, value: string | null | undefined) {
    if (value && !isIsoDate(value)) this.add('Date', false, `${value} is not a date`, [path])
  }
  /** Lines that should add up to a printed total. Lines that passed their own check are trusted */
  total(name: string, totalPath: string, total: number | null, lines: { path: string; value: number; trusted?: boolean }[]) {
    if (total === null || !lines.length) return
    const got = sum(lines.map((l) => l.value))
    const ok = sameMoney(got, total)
    const paths = ok ? [totalPath, ...lines.map((l) => l.path)] : [totalPath, ...lines.filter((l) => !l.trusted).map((l) => l.path)]
    this.add(name, ok, ok ? `${lines.length} lines add up to ${brl(total)}` : `the lines add up to ${brl(got)}, not ${brl(total)}`, paths)
  }
}

// The largest issuers of boletos, for when the bank is printed as a logo or a name without its code
const BANK_CODES: [RegExp, string][] = [
  [/banco do brasil|\bbb\b/, '001'],
  [/bradesco/, '237'],
  [/ita[uú]/, '341'],
  [/caixa/, '104'],
  [/santander/, '033'],
  [/inter\b/, '077'],
  [/nu ?pagamentos|nubank/, '260'],
  [/sicoob/, '756'],
  [/sicredi/, '748'],
  [/btg/, '208'],
  [/\bc6\b/, '336'],
]

export function bankCode(printed: string): string | undefined {
  const code = printed.match(/\b(\d{3})\b/)?.[1]
  if (code) return code
  const name = printed.toLowerCase()
  return BANK_CODES.find(([pattern]) => pattern.test(name))?.[1]
}

function boletoChecks(d: Boleto, c: Checks, today: Date) {
  const line = checkLinhaDigitavel(d.linhaDigitavel, today)
  c.add(
    'Digit line',
    !line.errors.length,
    line.errors.length ? `the digit line ${line.errors.join('; ')}` : `${line.kind === 'bank' ? 'bank' : 'utility'} boleto check digits match`,
    ['linhaDigitavel'],
  )
  if (line.errors.length) return
  if (d.valor !== null && line.amount !== null) {
    const ok = sameMoney(d.valor, line.amount)
    c.add('Amount', ok, ok ? 'matches the amount in the digit line' : `the digit line says ${brl(line.amount)}`, ['valor'])
  }
  if (d.vencimento && line.dueDate) {
    const ok = d.vencimento === line.dueDate
    c.add('Due date', ok, ok ? 'matches the due date in the digit line' : `the digit line says ${line.dueDate}`, ['vencimento'])
  }
  const code = d.banco ? bankCode(d.banco) : undefined
  if (code && line.bank) {
    c.add('Bank', code === line.bank, code === line.bank ? 'matches the bank code in the digit line' : `the digit line is from bank ${line.bank}`, ['banco'])
  }
}

function nfeChecks(d: Nfe, c: Checks) {
  const key = checkNfeKey(d.chaveAcesso)
  c.add('Access key', !key.errors.length, key.errors.length ? `the access key ${key.errors.join('; ')}` : 'check digit matches', ['chaveAcesso'])
  c.id('Issuer CNPJ', 'emitente.cnpj', d.emitente.cnpj, 'cnpj')
  c.id('Customer CPF/CNPJ', 'destinatario.documento', d.destinatario.documento, 'either')
  c.date('dataEmissao', d.dataEmissao)

  if (!key.errors.length) {
    const match = (name: string, path: string, ok: boolean, inKey: string) =>
      c.add(name, ok, ok ? 'matches the access key' : `the access key says ${inKey}`, [path])
    match('Issuer in key', 'emitente.cnpj', normalizeCnpj(d.emitente.cnpj) === key.cnpj, formatCnpj(key.cnpj!))
    match('Number in key', 'numero', d.numero === key.number, String(key.number))
    match('Series in key', 'serie', d.serie === key.series, String(key.series))
    match('Month in key', 'dataEmissao', d.dataEmissao.slice(0, 7) === key.month, key.month!)
    match('State in key', 'emitente.uf', d.emitente.uf.toUpperCase() === key.uf, key.uf!)
  }

  const trusted = d.itens.map((item, i) => {
    // Unit prices can have more decimals than the printed total, so allow a cent of rounding
    const ok = Math.abs(item.quantidade * item.valorUnitario - item.valorTotal) <= 0.011
    const p = `itens[${i}]`
    c.add(
      `Line ${i + 1}`,
      ok,
      ok ? 'quantity × unit price = total' : `${item.quantidade} × ${brl(item.valorUnitario)} is ${brl(item.quantidade * item.valorUnitario)}, not ${brl(item.valorTotal)}`,
      [`${p}.quantidade`, `${p}.valorUnitario`, `${p}.valorTotal`],
    )
    return ok
  })
  c.total(
    'Products total',
    'valorProdutos',
    d.valorProdutos,
    d.itens.map((item, i) => ({ path: `itens[${i}].valorTotal`, value: item.valorTotal, trusted: trusted[i] })),
  )
  const expected = d.valorProdutos + d.valorFrete + d.valorOutros - d.valorDesconto
  const ok = sameMoney(expected, d.valorTotal)
  c.add(
    'Invoice total',
    ok,
    ok ? 'products + freight + other − discount = total' : `products + freight + other − discount is ${brl(expected)}, not ${brl(d.valorTotal)}`,
    ['valorTotal', 'valorProdutos', 'valorFrete', 'valorOutros', 'valorDesconto'],
  )
}

function informeChecks(d: Informe, c: Checks, today: Date) {
  c.id('Payer CNPJ', 'fontePagadora.cnpj', d.fontePagadora.cnpj, 'cnpj')
  c.id('Taxpayer CPF', 'beneficiario.cpf', d.beneficiario.cpf, 'cpf')
  const year = today.getUTCFullYear()
  const plausible = d.anoCalendario >= 2000 && d.anoCalendario < year
  c.add('Year', plausible, plausible ? 'a past year' : `${d.anoCalendario} is not a past year`, ['anoCalendario'])
  c.total('Exempt income total', 'totalIsentos', d.totalIsentos, d.isentos.map((l, i) => ({ path: `isentos[${i}].valor`, value: l.valor })))
  c.total('Exclusive taxation total', 'totalExclusivos', d.totalExclusivos, d.exclusivos.map((l, i) => ({ path: `exclusivos[${i}].valor`, value: l.valor })))
}

export function reviewDocument(doc: Extracted, today = new Date()): Review {
  const c = new Checks()
  if (doc.type === 'boleto') {
    boletoChecks(doc.data, c, today)
    c.id('Beneficiary CPF/CNPJ', 'beneficiarioDocumento', doc.data.beneficiarioDocumento, 'either')
    c.id('Payer CPF/CNPJ', 'pagadorDocumento', doc.data.pagadorDocumento, 'either')
    c.date('vencimento', doc.data.vencimento)
  } else if (doc.type === 'nfe') nfeChecks(doc.data, c)
  else informeChecks(doc.data, c, today)

  const fields = new Map<string, FieldReport>(
    flatten(doc.data).map(([path, value]) => [path, { path, value, status: 'unchecked' as Status, notes: [] }]),
  )
  for (const check of c.list) {
    for (const path of check.paths) {
      const f = fields.get(path)
      if (!f) continue
      f.notes.push(`${check.name}: ${check.detail}`)
      if (!check.ok) f.status = 'review'
      else if (f.status === 'unchecked') f.status = 'ok'
    }
  }
  for (const path of doc.data.uncertain) {
    // The model may name a whole line ("itens[2]") rather than one of its fields
    for (const f of fields.values()) {
      if (f.path === path || f.path.startsWith(`${path}.`)) {
        f.status = 'review'
        f.notes.push('The model was not sure it read this right')
      }
    }
  }
  const list = [...fields.values()]
  return { fields: list, checks: c.list, toReview: list.filter((f) => f.status === 'review').length }
}

/** Identifiers shown the way they are printed, whatever the model returned */
export function displayId(value: string): string {
  const n = normalizeCnpj(value)
  if (n.length === 11 && /^\d+$/.test(n)) return formatCpf(n)
  if (n.length === 14) return formatCnpj(n)
  return value
}

