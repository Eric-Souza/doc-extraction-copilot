// Sends the AI SDK's spans, and the guard's (guard.ts), to Phoenix when PHOENIX_COLLECTOR_ENDPOINT
// is set: http://localhost:6006 for a local Phoenix. The app registers it in instrumentation.ts and
// the eval script itself. Without the variable nothing is registered and every span is a no-op.

import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions'
import { isOpenInferenceSpan, OpenInferenceBatchSpanProcessor } from '@arizeai/openinference-vercel'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { Resource } from '@opentelemetry/resources'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

export const PROJECT = 'doc-extraction-copilot'

let provider: NodeTracerProvider | undefined

export function traceToPhoenix(serviceName: string): boolean {
  const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT
  if (!endpoint || provider) return Boolean(provider)
  provider = new NodeTracerProvider({
    resource: new Resource({ 'service.name': serviceName, [SEMRESATTRS_PROJECT_NAME]: PROJECT }),
    spanProcessors: [
      new OpenInferenceBatchSpanProcessor({
        exporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }),
        // Next's own request and render spans would bury the model calls
        spanFilter: isOpenInferenceSpan,
      }),
    ],
  })
  // Also the async context, so spans nest across awaits, and the W3C propagator for traceparent
  provider.register()
  return true
}

/** Sends the spans still waiting in the batch, for a script that is about to exit */
export async function flushTraces() {
  await provider?.forceFlush()
}
