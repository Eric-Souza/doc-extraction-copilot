// What the model returns for each kind of document. Amounts are numbers in reais, dates are
// YYYY-MM-DD, and identifiers are copied as printed: code normalizes and checks them afterwards.
// A field the document does not show is null rather than a guess.

import { z } from 'zod'

const money = z.number().describe('In reais, as a number: R$ 1.234,56 is 1234.56')
const date = z.string().describe('YYYY-MM-DD')

/** The fields the model is unsure of, as paths like "valor" or "itens[2].valorTotal" */
const uncertain = z
  .array(z.string())
  .describe('Paths of the fields you could not read clearly or had to infer, e.g. "valor" or "itens[2].valorTotal"')

export const BoletoSchema = z.object({
  banco: z.string().nullable().describe('Bank name or code, as printed'),
  beneficiario: z.string().describe('Who receives the payment (beneficiário / cedente)'),
  beneficiarioDocumento: z.string().nullable().describe("The beneficiário's CNPJ or CPF, as printed"),
  pagador: z.string().nullable().describe('Who pays (pagador / sacado)'),
  pagadorDocumento: z.string().nullable().describe("The pagador's CPF or CNPJ, as printed"),
  linhaDigitavel: z.string().describe('The digit line above the barcode, as printed, with its dots and spaces'),
  vencimento: date.nullable().describe('Due date (vencimento)'),
  valor: money.nullable().describe('Amount due (valor do documento)'),
  nossoNumero: z.string().nullable(),
  uncertain,
})

const Item = z.object({
  descricao: z.string(),
  quantidade: z.number(),
  valorUnitario: money,
  valorTotal: money,
})

export const NfeSchema = z.object({
  chaveAcesso: z.string().describe('The 44-digit access key (chave de acesso), as printed'),
  numero: z.number().int().describe('Invoice number (nº)'),
  serie: z.number().int(),
  dataEmissao: date,
  emitente: z.object({
    nome: z.string(),
    cnpj: z.string().describe('As printed'),
    uf: z.string().describe('Two-letter state of the address'),
  }),
  destinatario: z.object({
    nome: z.string(),
    documento: z.string().nullable().describe('CPF or CNPJ, as printed'),
  }),
  itens: z.array(Item).describe('Every product line, in order'),
  valorProdutos: money.describe('Valor total dos produtos'),
  valorFrete: money.describe('0 when there is none'),
  valorDesconto: money.describe('0 when there is none'),
  valorOutros: money.describe('Outras despesas acessórias; 0 when there are none'),
  valorTotal: money.describe('Valor total da nota'),
  uncertain,
})

const Line = z.object({ descricao: z.string(), valor: money })

export const InformeSchema = z.object({
  anoCalendario: z.number().int().describe('Ano-calendário the income refers to'),
  fontePagadora: z.object({ nome: z.string(), cnpj: z.string().describe('As printed') }),
  beneficiario: z.object({ nome: z.string(), cpf: z.string().describe('As printed') }),
  isentos: z.array(Line).describe('Rendimentos isentos e não tributáveis (LCI, LCA, poupança...), each line'),
  totalIsentos: money.nullable().describe('The printed total of that section, null if none is printed'),
  exclusivos: z.array(Line).describe('Rendimentos sujeitos à tributação exclusiva / definitiva (CDB, Tesouro, funds...), each line'),
  totalExclusivos: money.nullable(),
  impostoRetido: money.nullable().describe('Income tax withheld at source on those (IR retido na fonte)'),
  bens: z
    .array(z.object({ descricao: z.string(), saldoAnterior: money, saldoAtual: money }))
    .describe('Bens e direitos: each position with its balance on 31/12 of the previous year and of the ano-calendário'),
  uncertain,
})

export const DOC_TYPES = ['boleto', 'nfe', 'informe'] as const
export type DocType = (typeof DOC_TYPES)[number]

export const SCHEMAS = { boleto: BoletoSchema, nfe: NfeSchema, informe: InformeSchema } as const

export type Boleto = z.infer<typeof BoletoSchema>
export type Nfe = z.infer<typeof NfeSchema>
export type Informe = z.infer<typeof InformeSchema>
export type Extracted = { type: 'boleto'; data: Boleto } | { type: 'nfe'; data: Nfe } | { type: 'informe'; data: Informe }

export const DOC_LABELS: Record<DocType, string> = {
  boleto: 'Boleto',
  nfe: 'Nota fiscal (DANFE)',
  informe: 'Informe de rendimentos',
}

export const ClassifySchema = z.object({
  type: z.enum([...DOC_TYPES, 'other']).describe(
    'boleto: a payment slip with a digit line and barcode. nfe: a DANFE, the printout of an NF-e. ' +
      'informe: an annual income statement (informe de rendimentos) from a bank, broker or employer. other: anything else',
  ),
})
