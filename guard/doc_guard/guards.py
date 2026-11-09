# One Guard per document type, named like the type, so the app calls /guards/<type>/validate.
# The server looks guards up by id, which is random unless set.

from guardrails import Guard

from .models import Boleto, Informe, Nfe
from .validators import BoletoMatchesLine, InformeTotals, NfeMatchesKey, NfeTotals


def make_guards() -> dict[str, Guard]:
    guards = {
        "boleto": Guard.for_pydantic(Boleto, name="boleto").use(BoletoMatchesLine(), on="$"),
        "nfe": Guard.for_pydantic(Nfe, name="nfe").use(NfeMatchesKey(), NfeTotals(), on="$"),
        "informe": Guard.for_pydantic(Informe, name="informe").use(InformeTotals(), on="$"),
    }
    for name, guard in guards.items():
        guard.id = name
    return guards
