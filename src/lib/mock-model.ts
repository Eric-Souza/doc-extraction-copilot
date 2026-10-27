// A scripted model for the end-to-end tests (AI_PROVIDER=mock). It cannot see the file, so it
// answers from the file name: the type, then the fields of the matching synthetic sample, with
// one value misread so the page has something to flag.

import { MockLanguageModelV3 } from 'ai/test'
import { makeSamples } from './synthetic'

type Options = Parameters<MockLanguageModelV3['doGenerate']>[0]

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
}

function promptText({ prompt }: Options) {
  return prompt
    .flatMap((m) => (m.role === 'user' ? m.content : []))
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join(' ')
}

function answer(options: Options): object {
  const schema = options.responseFormat?.type === 'json' ? JSON.stringify(options.responseFormat.schema ?? {}) : ''
  const kind = schema.includes('linhaDigitavel') ? 'boleto' : schema.includes('chaveAcesso') ? 'nfe' : schema.includes('anoCalendario') ? 'informe' : null
  if (!kind) {
    const name = promptText(options).match(/File: (.*)$/)?.[1] ?? ''
    return { type: /nfe|danfe/i.test(name) ? 'nfe' : /informe/i.test(name) ? 'informe' : /boleto/i.test(name) ? 'boleto' : 'other' }
  }
  const data = structuredClone(makeSamples(3).find((s) => s.doc.type === kind)!.doc.data) as Record<string, unknown>
  if (kind === 'boleto') data.valor = Math.round(((data.valor as number) + 1) * 100) / 100
  if (kind === 'nfe') data.numero = (data.numero as number) + 1
  if (kind === 'informe') data.uncertain = ['beneficiario.nome']
  return data
}

export function mockModel() {
  return new MockLanguageModelV3({
    doGenerate: async (options) => ({
      content: [{ type: 'text', text: JSON.stringify(answer(options)) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  })
}
