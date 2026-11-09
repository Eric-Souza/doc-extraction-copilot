# The Guards the server loads: guardrails start --config config.py

from doc_guard.guards import make_guards

guards = make_guards()
boleto, nfe, informe = guards["boleto"], guards["nfe"], guards["informe"]
