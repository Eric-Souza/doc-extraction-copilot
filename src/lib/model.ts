// Which model reads the documents. Gemini by default: its free tier takes images and PDFs.
//   GOOGLE_GENERATIVE_AI_API_KEY  the key, from https://aistudio.google.com/apikey
//   AI_MODEL                      overrides the default model
// AI_PROVIDER=mock is a scripted model for the end-to-end tests, which needs no key.
// AI_PROVIDER=local is a model behind an OpenAI-compatible server, such as the fine-tune served by
// Ollama or vLLM:
//   AI_BASE_URL                   the server, http://localhost:11434/v1 (Ollama) by default
//   AI_MODEL                      the model name on that server
//   AI_SCHEMA_IN_PROMPT=1         also writes the JSON schema, with its descriptions, into the system
//                                 prompt. The server only turns it into a grammar, so otherwise the
//                                 model sees the field names but never what they mean

import { google } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from 'ai'
import { mockModel } from './mock-model'
import { imagesOnly } from './pdf-images'

// Flash Lite: 500 free requests a day, against 20 for the larger Flash models
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_LOCAL_URL = 'http://localhost:11434/v1'

export function modelId(env: Record<string, string | undefined> = process.env): string {
  if (env.AI_PROVIDER === 'local' && !env.AI_MODEL) throw new Error('AI_PROVIDER=local needs AI_MODEL, the model name on the server')
  return env.AI_PROVIDER === 'mock' ? 'mock' : env.AI_MODEL || DEFAULT_MODEL
}

const schemaInPrompt: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    if (params.responseFormat?.type !== 'json' || !params.responseFormat.schema) return params
    const schema = `Reply with JSON that follows this schema:
${JSON.stringify(params.responseFormat.schema)}`
    const prompt = params.prompt.map((m) => (m.role === 'system' ? { ...m, content: `${m.content}

${schema}` } : m))
    return { ...params, prompt }
  },
}

export function getModel(env: Record<string, string | undefined> = process.env): LanguageModel {
  if (env.AI_PROVIDER === 'mock') return mockModel()
  if (env.AI_PROVIDER === 'local') {
    const provider = createOpenAICompatible({
      name: 'local',
      baseURL: env.AI_BASE_URL || DEFAULT_LOCAL_URL,
      supportsStructuredOutputs: true,
      // Qwen3.5 thinks before it answers unless told not to: Ollama reads reasoning_effort, vLLM
      // chat_template_kwargs. Greedy decoding, so a rerun of the eval reads the same
      transformRequestBody: (body) => ({
        ...body,
        temperature: body.temperature ?? 0,
        reasoning_effort: 'none',
        chat_template_kwargs: { enable_thinking: false },
      }),
    })
    const middleware = env.AI_SCHEMA_IN_PROMPT ? [imagesOnly, schemaInPrompt] : [imagesOnly]
    return wrapLanguageModel({ model: provider(modelId(env)), middleware })
  }
  return google(modelId(env))
}
