// The Guardrails AI server in guard/, which runs the same checks as review.ts as validators. When
// GUARD_URL is set, a reading that fails one goes back to the model once, with what failed.
// The guard decides whether to re-ask; review.ts still decides what the person reviews.

import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api'
import type { Extracted } from './schemas'

const tracer = trace.getTracer('doc-extraction-copilot')

export interface GuardIssue {
  /** The fields the failed check covers, like "valor" or "itens[0].valorTotal" */
  paths: string[]
  detail: string
}

interface Summary {
  validatorName: string
  validatorStatus: string
  propertyPath?: string
  failureReason?: string | null
}

/**
 * The failed checks in a validate response. A field validator's path comes from Guardrails; a
 * document validator ("$") writes one "path, path: detail" line per failed check. validationPassed
 * is not used: Guardrails 0.11 calls a failure on "$" fixed whenever the document has a null field.
 */
export function issuesFrom(summaries: Summary[]): GuardIssue[] {
  return summaries
    .filter((s) => s.validatorStatus === 'fail')
    .flatMap((s) => {
      const path = (s.propertyPath ?? '$').replace(/^\$\.?/, '')
      return (s.failureReason ?? '').split('\n').map((line) => {
        if (path) return { paths: [path], detail: line }
        const at = line.indexOf(': ')
        return { paths: line.slice(0, at).split(', '), detail: line.slice(at + 2) }
      })
    })
}

export async function guardDocument(
  doc: Extracted,
  opts: { url: string; today?: Date; signal?: AbortSignal },
): Promise<GuardIssue[]> {
  const input = JSON.stringify(doc.data)
  const attributes = { 'openinference.span.kind': 'GUARDRAIL', 'input.value': input, 'input.mime_type': 'application/json' }
  return tracer.startActiveSpan(`guard ${doc.type}`, { attributes }, async (span) => {
    try {
      // The trace context, so the server's validator spans sit under this one in Phoenix
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      propagation.inject(context.active(), headers)
      const res = await fetch(`${opts.url.replace(/\/$/, '')}/guards/${doc.type}/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          llm_output: input,
          num_reasks: 0,
          metadata: opts.today ? { today: opts.today.toISOString().slice(0, 10) } : {},
        }),
        signal: opts.signal ?? AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`The guard answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const body = (await res.json()) as { validationSummaries?: Summary[] }
      const issues = issuesFrom(body.validationSummaries ?? [])
      span.setAttributes({ 'output.value': JSON.stringify(issues), 'output.mime_type': 'application/json', 'guard.failed_checks': issues.length })
      return issues
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
      throw error
    } finally {
      span.end()
    }
  })
}

/** What the model is told when its reading fails a check */
export function reaskText(issues: GuardIssue[]): string {
  const list = issues.map((i) => `- ${i.paths.join(', ')}: ${i.detail}`).join('\n')
  return `Code checked your reading and these checks failed:
${list}

Look at the document again and read those fields once more, digit by digit. A failed check often means a misread, but documents can also be printed wrong (a typo by the issuer, or a tampered boleto). If the document really shows what you wrote, keep it exactly as printed: never change a value just to make a check pass. Return the whole document again, every field.`
}
