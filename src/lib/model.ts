// Which model reads the documents. Gemini by default: its free tier takes images and PDFs.
//   GOOGLE_GENERATIVE_AI_API_KEY  the key, from https://aistudio.google.com/apikey
//   AI_MODEL                      overrides the default model
// AI_PROVIDER=mock is a scripted model for the end-to-end tests, which needs no key.

import { google } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { mockModel } from './mock-model'

// Flash Lite: 500 free requests a day, against 20 for the larger Flash models
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

export function modelId(env: Record<string, string | undefined> = process.env): string {
  return env.AI_PROVIDER === 'mock' ? 'mock' : env.AI_MODEL || DEFAULT_MODEL
}

export function getModel(env: Record<string, string | undefined> = process.env): LanguageModel {
  if (env.AI_PROVIDER === 'mock') return mockModel()
  return google(modelId(env))
}
