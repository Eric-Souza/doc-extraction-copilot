# The Guardrails server with this folder's guards: uv run uvicorn serve:app --port 8100
# Not `guardrails start`, which sends a usage ping before it loads config.py.
# With PHOENIX_COLLECTOR_ENDPOINT set, its spans go to Phoenix (doc_guard/tracing.py).

import doc_guard  # noqa: F401  (turns the metrics off before guardrails_api loads)
from doc_guard.tracing import trace_to_phoenix
from guardrails_api.app import create_app

app = create_app(config="config.py")
trace_to_phoenix(app)
