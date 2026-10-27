// Fictional documents with known answers, for the eval set and the demo samples. Every name,
// CPF and CNPJ is made up; the identifiers get valid check digits so that only a misread, or a
// planted inconsistency, fails a check.

import { makeBankLine, makeUtilityLine } from './br/boleto'
import { completeCnpj, completeCpf, formatCnpj, formatCpf } from './br/ids'
import { makeNfeKey } from './br/nfe'
import type { Boleto, Extracted, Informe, Nfe } from './schemas'

/** A small seeded random generator (mulberry32), so the same seed always gives the same set */
export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]
  const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join('')
  const money = (min: number, max: number) => Math.round((min + next() * (max - min)) * 100) / 100
  return { next, int, pick, digits, money }
}
type Rng = ReturnType<typeof rng>

const FIRST = ['Mariana', 'João', 'Ana Clara', 'Pedro', 'Luíza', 'Rafael', 'Beatriz', 'Thiago', 'Camila', 'Gustavo', 'Larissa', 'Felipe']
const LAST = ['Alves', 'Costa', 'Ribeiro', 'Moura', 'Teixeira', 'Barbosa', 'Nogueira', 'Pacheco', 'Siqueira', 'Fontes', 'Azevedo', 'Lacerda']
const COMPANIES = [
  'Condomínio Residencial Jardim das Acácias',
  'Escola Pequeno Saber Ltda',
  'Clínica Bem Viver Ltda',
  'Academia Corpo em Movimento ME',
  'Papelaria Ponto Final Ltda',
  'Distribuidora Rio Claro de Alimentos Ltda',
  'Oficina Mecânica Dois Irmãos ME',
  'TecnoLar Eletrodomésticos S.A.',
  'Livraria Página Aberta Ltda',
  'Hortifruti Vale Verde Ltda',
]
const BROKERS = [
  'Horizonte Corretora de Valores S.A.',
  'Banco Atlântico Investimentos S.A.',
  'Âncora Distribuidora de Títulos Ltda',
  'Cooperativa de Crédito Serra Azul',
]
const BANKS = [
  ['001', '9', 'Banco do Brasil'],
  ['237', '2', 'Bradesco'],
  ['341', '7', 'Itaú'],
  ['104', '0', 'Caixa'],
  ['077', '9', 'Inter'],
] as const
const PRODUCTS = [
  ['Caneta esferográfica azul cx 50', 32.9],
  ['Papel sulfite A4 500 fls', 27.45],
  ['Arroz tipo 1 5kg', 28.99],
  ['Café torrado 500g', 18.7],
  ['Cabo HDMI 2m', 39.9],
  ['Mouse sem fio', 74.5],
  ['Detergente 500ml', 2.89],
  ['Filtro de óleo', 42.0],
  ['Livro: Introdução à Estatística', 89.0],
  ['Caderno universitário 10 matérias', 24.9],
  ['Lâmpada LED 9W', 11.49],
  ['Pilha AA c/ 4', 19.99],
] as const
const UFS = ['SP', 'RJ', 'MG', 'PR', 'RS', 'BA', 'PE', 'SC', 'GO', 'DF'] as const

const person = (r: Rng) => `${r.pick(FIRST)} ${r.pick(LAST)} ${r.pick(LAST)}`
const cpf = (r: Rng) => formatCpf(completeCpf(r.digits(9)))
/** One in four CNPJs uses the new alphanumeric format */
function cnpj(r: Rng) {
  const root = r.next() < 0.25 ? r.digits(2) + Array.from({ length: 3 }, () => r.pick([...'ABCDEFGHJKLMNPRSTUVWXYZ'])).join('') + r.digits(3) : r.digits(8)
  return formatCnpj(completeCnpj(`${root}0001`))
}
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/** How a sample is rendered and photographed */
export interface Look {
  format: 'png' | 'jpeg' | 'pdf'
  /** Degrees, for photos taken at an angle */
  rotate: number
  /** CSS blur in pixels */
  blur: number
  /** 0 to 1: lower is a duller, grayer photo */
  contrast: number
}

/** A document whose printed fields disagree on purpose, and the fields a reviewer must see */
export interface Planted {
  what: string
  paths: string[]
}

export interface Sample {
  id: string
  doc: Extracted
  look: Look
  planted?: Planted
}

function look(r: Rng): Look {
  const kind = r.next()
  if (kind < 0.35) return { format: 'png', rotate: 0, blur: 0, contrast: 1 }
  if (kind < 0.65) return { format: 'pdf', rotate: 0, blur: 0, contrast: 1 }
  // A phone photo: slightly turned, a little soft, duller
  return { format: 'jpeg', rotate: Math.round((r.next() * 6 - 3) * 10) / 10, blur: Math.round(r.next() * 9) / 10, contrast: 0.75 + r.next() * 0.2 }
}

function boleto(r: Rng, plant: boolean): { data: Boleto; planted?: Planted } {
  const utility = r.next() < 0.25
  const valor = r.money(45, 3200)
  const vencimento = addDays('2026-10-01', r.int(0, 75))
  const [code, dv, name] = r.pick(BANKS)
  const data: Boleto = utility
    ? {
        banco: null,
        beneficiario: r.pick(['Companhia de Energia Vale do Sol', 'Águas do Planalto S.A.', 'Gás Bem Brasil Distribuidora']),
        beneficiarioDocumento: cnpj(r),
        pagador: person(r),
        pagadorDocumento: cpf(r),
        linhaDigitavel: makeUtilityLine(r.pick(['2', '3']), valor, r.digits(29)),
        vencimento,
        valor,
        nossoNumero: null,
        uncertain: [],
      }
    : {
        banco: `${name} ${code}-${dv}`,
        beneficiario: r.pick(COMPANIES),
        beneficiarioDocumento: cnpj(r),
        pagador: person(r),
        pagadorDocumento: cpf(r),
        linhaDigitavel: makeBankLine(code, valor, vencimento, r.digits(25)),
        vencimento,
        valor,
        nossoNumero: r.digits(11),
        uncertain: [],
      }
  if (!plant) return { data }
  // A tampered boleto: the printed amount was edited, but the digit line still pays the old one
  return {
    data: { ...data, valor: Math.round(valor * 0.8 * 100) / 100 },
    planted: { what: 'printed amount differs from the digit line', paths: ['valor'] },
  }
}

function nfe(r: Rng, plant: boolean): { data: Nfe; planted?: Planted } {
  const uf = r.pick(UFS)
  const dataEmissao = addDays('2026-08-01', r.int(0, 80))
  const emitente = { nome: r.pick(COMPANIES), cnpj: cnpj(r), uf }
  const numero = r.int(100, 99999)
  const serie = r.int(1, 3)
  const itens = Array.from({ length: r.int(2, 6) }, () => {
    const [descricao, price] = r.pick(PRODUCTS)
    const quantidade = r.int(1, 12)
    return { descricao, quantidade, valorUnitario: price, valorTotal: Math.round(quantidade * price * 100) / 100 }
  })
  const valorProdutos = Math.round(itens.reduce((a, i) => a + i.valorTotal, 0) * 100) / 100
  const valorFrete = r.next() < 0.5 ? r.money(10, 60) : 0
  const valorDesconto = r.next() < 0.3 ? r.money(5, 30) : 0
  const valorOutros = 0
  const data: Nfe = {
    chaveAcesso: makeNfeKey({ uf, date: dataEmissao, cnpj: emitente.cnpj, series: serie, number: numero, code: r.digits(8) }),
    numero,
    serie,
    dataEmissao,
    emitente,
    destinatario: { nome: person(r), documento: cpf(r) },
    itens,
    valorProdutos,
    valorFrete,
    valorDesconto,
    valorOutros,
    valorTotal: Math.round((valorProdutos + valorFrete + valorOutros - valorDesconto) * 100) / 100,
    uncertain: [],
  }
  if (!plant) return { data }
  // A line total that does not match its quantity and price, nor the products total
  const wrong = { ...itens[0], valorTotal: Math.round((itens[0].valorTotal + 10) * 100) / 100 }
  return {
    data: { ...data, itens: [wrong, ...itens.slice(1)] },
    // Code can't tell which of the four is wrong, so a reviewer needs to see all of them
    planted: { what: 'first line total is R$ 10 off', paths: ['itens[0].quantidade', 'itens[0].valorUnitario', 'itens[0].valorTotal', 'valorProdutos'] },
  }
}

function informe(r: Rng, plant: boolean): { data: Informe; planted?: Planted } {
  const round = (n: number) => Math.round(n * 100) / 100
  const isentos = [
    { descricao: 'LCI - Letra de Crédito Imobiliário', valor: r.money(200, 6000) },
    { descricao: 'LCA - Letra de Crédito do Agronegócio', valor: r.money(200, 6000) },
    ...(r.next() < 0.5 ? [{ descricao: 'Rendimentos de caderneta de poupança', valor: r.money(20, 900) }] : []),
  ]
  const exclusivos = [
    { descricao: 'CDB - Certificado de Depósito Bancário', valor: r.money(300, 9000) },
    ...(r.next() < 0.6 ? [{ descricao: 'Tesouro Direto', valor: r.money(100, 5000) }] : []),
    ...(r.next() < 0.4 ? [{ descricao: 'Fundos de investimento', valor: r.money(50, 3000) }] : []),
  ]
  const totalExclusivos = round(exclusivos.reduce((a, l) => a + l.valor, 0))
  const data: Informe = {
    anoCalendario: 2025,
    fontePagadora: { nome: r.pick(BROKERS), cnpj: cnpj(r) },
    beneficiario: { nome: person(r), cpf: cpf(r) },
    isentos,
    totalIsentos: round(isentos.reduce((a, l) => a + l.valor, 0)),
    exclusivos,
    totalExclusivos,
    impostoRetido: round(totalExclusivos * 0.15 / 0.85),
    bens: [
      { descricao: 'Saldo em conta corrente', saldoAnterior: r.money(100, 5000), saldoAtual: r.money(100, 5000) },
      { descricao: 'Aplicações em renda fixa', saldoAnterior: r.money(10000, 150000), saldoAtual: r.money(10000, 150000) },
    ],
    uncertain: [],
  }
  if (!plant) return { data }
  return {
    data: { ...data, totalIsentos: round(data.totalIsentos! + 100) },
    planted: { what: 'exempt income total is R$ 100 more than its lines', paths: ['totalIsentos', ...isentos.map((_, i) => `isentos[${i}].valor`)] },
  }
}

const MAKERS = { boleto, nfe, informe }

/** The eval set: `perType` documents of each type, the last two of each with a planted inconsistency */
export function makeSamples(perType = 12, seed = 2026): Sample[] {
  const r = rng(seed)
  return (['boleto', 'nfe', 'informe'] as const).flatMap((type) =>
    Array.from({ length: perType }, (_, i) => {
      const { data, planted } = MAKERS[type](r, i >= perType - 2)
      return { id: `${type}-${String(i + 1).padStart(2, '0')}`, doc: { type, data } as Extracted, look: look(r), planted }
    }),
  )
}
