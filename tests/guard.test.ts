import { MockLanguageModelV3 } from 'ai/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractGuarded } from '@/lib/extract'
import { issuesFrom, reaskText } from '@/lib/guard'
import type { Boleto, Extracted } from '@/lib/schemas'
import { makeSamples } from '@/lib/synthetic'

const boleto = makeSamples(1).find((s) => s.doc.type === 'boleto')!.doc as { type: 'boleto'; data: Boleto }
const misread = { ...boleto.data, valor: boleto.data.valor! + 1 }
const file = { data: new Uint8Array([1]), mediaType: 'image/png', name: 'boleto.png' }
const valorFails = [
  { validatorName: 'br/boleto-matches-line', validatorStatus: 'fail', propertyPath: '$', failureReason: 'valor: the digit line says R$ 1,00' },
]

type Options = Parameters<MockLanguageModelV3['doGenerate']>[0]
const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
}
/** A model that answers each call with the next reading, and remembers the prompts */
function scripted(...readings: object[]) {
  const prompts: Options['prompt'][] = []
  const model = new MockLanguageModelV3({
    doGenerate: async (options) => {
      prompts.push(options.prompt)
      return { content: [{ type: 'text', text: JSON.stringify(readings[prompts.length - 1]) }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] }
    },
  })
  return { model, prompts }
}
/** The guard server, answering each validate call with the next summaries */
function guard(...answers: object[][]) {
  const bodies: { llm_output: string; num_reasks: number; metadata: object }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string))
      return Response.json({ validationPassed: true, validationSummaries: answers[bodies.length - 1] })
    }),
  )
  return bodies
}

afterEach(() => vi.unstubAllGlobals())

describe('issuesFrom', () => {
  it('reads a field validator by its path and a document validator by its lines', () => {
    const issues = issuesFrom([
      { validatorName: 'br/document-id', validatorStatus: 'fail', propertyPath: '$.emitente.cnpj', failureReason: '12 is not a valid CNPJ' },
      { validatorName: 'br/iso-date', validatorStatus: 'pass', propertyPath: '$.vencimento' },
      {
        validatorName: 'br/nfe-totals',
        validatorStatus: 'fail',
        propertyPath: '$',
        failureReason: 'itens[0].valorTotal, valorProdutos: the lines add up to R$ 2,00, not R$ 3,00\nvalorTotal: products is R$ 1,00',
      },
    ])
    expect(issues).toEqual([
      { paths: ['emitente.cnpj'], detail: '12 is not a valid CNPJ' },
      { paths: ['itens[0].valorTotal', 'valorProdutos'], detail: 'the lines add up to R$ 2,00, not R$ 3,00' },
      { paths: ['valorTotal'], detail: 'products is R$ 1,00' },
    ])
  })
})

describe('reaskText', () => {
  it('lists every failed check and says not to fix a value to pass one', () => {
    const text = reaskText([{ paths: ['valor', 'vencimento'], detail: 'the digit line says R$ 1,00' }])
    expect(text).toContain('- valor, vencimento: the digit line says R$ 1,00')
    expect(text).toMatch(/never change a value just to make a check pass/)
  })
})

describe('extractGuarded', () => {
  it('reads again with the failures, and reports what changed', async () => {
    const { model, prompts } = scripted(misread, boleto.data)
    const bodies = guard(valorFails, [])
    const out = await extractGuarded(file, { type: 'boleto', model, guardUrl: 'http://guard', today: new Date('2026-10-27T12:00:00Z') })

    expect(out.doc.data).toEqual(boleto.data)
    expect(out.reask).toEqual({ issues: [{ paths: ['valor'], detail: 'the digit line says R$ 1,00' }], changed: ['valor'], after: [] })
    expect(bodies[0]).toMatchObject({ num_reasks: 0, metadata: { today: '2026-10-27' } })
    expect(JSON.parse(bodies[0].llm_output)).toEqual(misread)
    // The second call sees the first reading as its own answer, then the failures
    const second = prompts[1]
    expect(second.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(JSON.stringify(second[2].content)).toContain(String(misread.valor))
    expect(JSON.stringify(second[3].content)).toContain('valor: the digit line says R$ 1,00')
  })

  it('calls the model once when every check passes', async () => {
    const { model, prompts } = scripted(boleto.data)
    guard([])
    const out = await extractGuarded(file, { type: 'boleto', model, guardUrl: 'http://guard' })
    expect(out).toEqual({ doc: boleto })
    expect(prompts).toHaveLength(1)
  })

  it('starts from a reading it is given, as the eval does', async () => {
    const { model, prompts } = scripted(boleto.data)
    guard(valorFails, [])
    const first: Extracted = { type: 'boleto', data: misread }
    const out = await extractGuarded(file, { model, guardUrl: 'http://guard', first })
    expect(prompts).toHaveLength(1)
    expect(out.reask?.changed).toEqual(['valor'])
  })

  it('returns the first reading when the guard is down', async () => {
    const { model, prompts } = scripted(misread)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await extractGuarded(file, { type: 'boleto', model, guardUrl: 'http://guard' })
    expect(out).toEqual({ doc: { type: 'boleto', data: misread }, guardError: 'fetch failed' })
    expect(prompts).toHaveLength(1)
  })
})
