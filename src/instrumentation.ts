// Next runs this once per server start: tracing to Phoenix, when PHOENIX_COLLECTOR_ENDPOINT is set
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { traceToPhoenix } = await import('./lib/tracing')
  traceToPhoenix('doc-extraction-copilot')
}
