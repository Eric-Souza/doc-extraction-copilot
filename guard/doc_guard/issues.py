# Turns a guard's outcome into the failed checks, each with the fields it covers: a field
# validator's path comes from Guardrails, a document validator's from the start of each line.
#
# Go by these, not by validation_passed. Guardrails 0.11 leaves null fields out of its output, and
# when the output then differs from the input it counts a "noop" failure on the whole document
# ("$") as fixed: a boleto with no nossoNumero and the wrong amount passes.

from guardrails.classes.validation_outcome import ValidationOutcome


def failed_checks(outcome: ValidationOutcome) -> list[tuple[list[str], str]]:
    checks = []
    for summary in outcome.validation_summaries or []:
        if summary.validator_status != "fail":
            continue
        path = (summary.property_path or "$").removeprefix("$").removeprefix(".")
        for line in (summary.failure_reason or "").splitlines():
            if path:
                checks.append(([path], line))
            else:
                paths, _, detail = line.partition(": ")
                checks.append((paths.split(", "), detail))
    return checks
