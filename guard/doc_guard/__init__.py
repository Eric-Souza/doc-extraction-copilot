# Guardrails sends anonymous usage metrics to its own servers unless ~/.guardrailsrc says otherwise.
# This service keeps them off without touching the home folder: every Guard and Validator reads
# the setting through RC.load.

from guardrails.classes import rc as _rc

_load = _rc.RC.load.__func__


def _load_without_metrics(cls, logger=None):
    config = _load(cls, logger)
    config.enable_metrics = False
    return config


_rc.RC.load = classmethod(_load_without_metrics)
