import { APICallError, LoadAPIKeyError, NoObjectGeneratedError, RetryError } from 'ai'

/** What the page shows when an extraction fails: setup and quota problems as they are, anything else generic */
export function extractErrorMessage(error: unknown): string {
  // The SDK retries failed model calls and wraps the last failure
  if (RetryError.isInstance(error)) error = error.lastError
  if (LoadAPIKeyError.isInstance(error)) return `${error.message} See .env.example.`
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    // Gemini's free tier also caps requests per day, per model
    if (/per ?day/i.test(`${error.message} ${error.responseBody ?? ''}`)) {
      return "The model's free daily quota is used up. Try again tomorrow, or set AI_MODEL to another model."
    }
    return "The model's free-tier rate limit was hit. Wait a minute and try again."
  }
  if (APICallError.isInstance(error) && (error.statusCode === 400 || error.statusCode === 403) && /api key/i.test(error.message)) {
    return 'The Gemini API key was rejected. Check GOOGLE_GENERATIVE_AI_API_KEY.'
  }
  if (APICallError.isInstance(error) && error.statusCode === 503) return 'The model is overloaded right now. Try again in a moment.'
  if (NoObjectGeneratedError.isInstance(error)) return "The model's answer did not match the expected fields. Try again, or with a sharper image."
  if (error instanceof Error && error.name === 'TimeoutError') return 'The model took too long to answer. Try again.'
  console.error('[extract]', error)
  return 'Something went wrong. Try again.'
}
