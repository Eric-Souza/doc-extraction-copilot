// Field labels for the page, and reading and writing a field by its path.

import { fieldName } from './score'

const LABELS: Record<string, string> = {
  banco: 'Bank',
  beneficiario: 'Beneficiary (beneficiário)',
  beneficiarioDocumento: 'Beneficiary CPF/CNPJ',
  pagador: 'Payer (pagador)',
  pagadorDocumento: 'Payer CPF/CNPJ',
  linhaDigitavel: 'Digit line (linha digitável)',
  vencimento: 'Due date',
  valor: 'Amount',
  nossoNumero: 'Nosso número',
  chaveAcesso: 'Access key (chave de acesso)',
  numero: 'Invoice number',
  serie: 'Series',
  dataEmissao: 'Issue date',
  'emitente.nome': 'Issuer',
  'emitente.cnpj': 'Issuer CNPJ',
  'emitente.uf': 'Issuer state',
  'destinatario.nome': 'Customer',
  'destinatario.documento': 'Customer CPF/CNPJ',
  'itens[].descricao': 'Description',
  'itens[].quantidade': 'Qty',
  'itens[].valorUnitario': 'Unit price',
  'itens[].valorTotal': 'Total',
  valorProdutos: 'Products total',
  valorFrete: 'Freight',
  valorDesconto: 'Discount',
  valorOutros: 'Other charges',
  valorTotal: 'Invoice total',
  anoCalendario: 'Calendar year',
  'fontePagadora.nome': 'Paying institution',
  'fontePagadora.cnpj': 'Institution CNPJ',
  'beneficiario.nome': 'Taxpayer',
  'beneficiario.cpf': 'Taxpayer CPF',
  'isentos[].descricao': 'Description',
  'isentos[].valor': 'Amount',
  totalIsentos: 'Exempt income total',
  'exclusivos[].descricao': 'Description',
  'exclusivos[].valor': 'Amount',
  totalExclusivos: 'Exclusive taxation total',
  impostoRetido: 'Tax withheld',
  'bens[].descricao': 'Description',
  'bens[].saldoAnterior': 'Previous Dec 31',
  'bens[].saldoAtual': 'Dec 31',
}

export const fieldLabel = (path: string) => LABELS[fieldName(path)] ?? path

/** Which fields hold money, to show and parse them as reais */
export const isMoneyField = (path: string) => /^(valor|total|saldo|imposto)/.test(path.split('.').pop()!)

const keys = (path: string) => path.split(/\.|\[(\d+)\]/).filter((k) => k !== undefined && k !== '')

export function getPath(obj: unknown, path: string): unknown {
  return keys(path).reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj)
}

/** A copy of obj with the value at path replaced */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const copy = structuredClone(obj)
  const ks = keys(path)
  let o = copy as Record<string, unknown>
  for (const k of ks.slice(0, -1)) o = o[k] as Record<string, unknown>
  o[ks.at(-1)!] = value
  return copy
}

/** "1.234,56", "1234,56" and "1234.56" all to 1234.56; null when it is not a number */
export function parseAmount(text: string): number | null {
  const t = text.replace(/R\$|\s/g, '')
  if (!t) return null
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export const formatAmount = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
