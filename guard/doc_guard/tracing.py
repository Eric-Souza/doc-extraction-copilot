# Sends the guard's spans to Phoenix when PHOENIX_COLLECTOR_ENDPOINT is set (http://localhost:6006
# for a local Phoenix). Guardrails traces each guard call and each validator itself, as OpenInference
# GUARDRAIL spans, through whatever tracer provider is global. FastAPI's instrumentation reads the
# app's traceparent header, so a validate call shows up inside the extraction that made it.

import os

from fastapi import FastAPI

PROJECT = "doc-extraction-copilot"


def trace_to_phoenix(app: FastAPI) -> bool:
    endpoint = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT")
    if not endpoint:
        return False
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    resource = Resource.create({"service.name": "doc-guard", "openinference.project.name": PROJECT})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint.rstrip('/')}/v1/traces")))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="health-check,docs,openapi.json", exclude_spans=["receive", "send"])
    return True
