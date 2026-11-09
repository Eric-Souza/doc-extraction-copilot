# The app's checks (src/lib/review.ts) as Guardrails validators. A field validator sits on one
# field, and Guardrails reports the field's path. A document validator sees the whole document and
# writes one line per failed check, "path, path: detail", so the app knows which fields to re-ask.
#
# None of them fix a value: on_fail is "noop", and the app re-asks the model with the messages.
# A value the document really prints wrong (a tampered boleto) must stay as printed.

import math
from datetime import date
from typing import Any

from guardrails.validators import FailResult, PassResult, ValidationResult, Validator, register_validator

from . import br


def cents(n: float) -> int:
    # Math.round in the app rounds halves up, not to even
    return math.floor(n * 100 + 0.5)


def same_money(a: float, b: float) -> bool:
    return abs(cents(a) - cents(b)) <= 1


def brl(n: float) -> str:
    return "R$ " + f"{n:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def num(n: float) -> str:
    """Like String(n) in the app: 2.0 is 2"""
    return str(int(n)) if float(n).is_integer() else str(n)


def today(metadata: dict[str, Any]) -> date:
    """The eval passes the date its digit lines were made around, so due dates decode the same any day"""
    return date.fromisoformat(metadata["today"]) if metadata.get("today") else date.today()


def is_iso_date(s: str) -> bool:
    if len(s) != 10:
        return False
    try:
        return date.fromisoformat(s).isoformat() == s
    except ValueError:
        return False


class Issues:
    """Failed checks of a document validator, one per line"""

    def __init__(self) -> None:
        self.lines: list[str] = []

    def add(self, ok: bool, paths: list[str], detail: str) -> bool:
        if not ok:
            self.lines.append(f"{', '.join(paths)}: {detail}")
        return ok

    def result(self) -> ValidationResult:
        return FailResult(error_message="\n".join(self.lines)) if self.lines else PassResult()

    def total(self, total_path: str, total: float | None, lines: list[tuple[str, float, bool]]) -> None:
        """Lines that should add up to a printed total. Lines that passed their own check are trusted"""
        if total is None or not lines:
            return
        got = sum(value for _, value, _ in lines)
        paths = [total_path, *(path for path, _, trusted in lines if not trusted)]
        self.add(same_money(got, total), paths, f"the lines add up to {brl(got)}, not {brl(total)}")


@register_validator(name="br/document-id", data_type="string")
class ValidDocumentId(Validator):
    """A CPF, a CNPJ (letters allowed since July 2026) or either one, told apart by length"""

    def __init__(self, kind: str = "either", on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, kind=kind, **kwargs)
        self.kind = kind

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        if not value:
            return PassResult()
        valid = {"cpf": br.is_valid_cpf, "cnpj": br.is_valid_cnpj, "either": br.is_valid_document}[self.kind]
        if valid(value):
            return PassResult()
        n = len(br.normalize_cnpj(value))
        what = "CPF or CNPJ" if self.kind == "either" else "CPF" if n == 11 or self.kind == "cpf" else "CNPJ"
        return FailResult(error_message=f"{value} is not a valid {what}")


@register_validator(name="br/iso-date", data_type="string")
class IsoDate(Validator):
    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        return PassResult() if not value or is_iso_date(value) else FailResult(error_message=f"{value} is not a date")


@register_validator(name="br/past-year", data_type="integer")
class PastYear(Validator):
    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        if 2000 <= value < today(metadata).year:
            return PassResult()
        return FailResult(error_message=f"{value} is not a past year")


@register_validator(name="br/digit-line", data_type="string")
class DigitLine(Validator):
    """The boleto's linha digitável: each block's check digit and the barcode's"""

    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        line = br.check_linha_digitavel(value, today(metadata))
        return FailResult(error_message=f"the digit line {'; '.join(line.errors)}") if line.errors else PassResult()


@register_validator(name="br/nfe-key", data_type="string")
class NfeKey(Validator):
    """The NF-e access key: its length, state, month, model and check digit"""

    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        key = br.check_nfe_key(value)
        return FailResult(error_message=f"the access key {'; '.join(key.errors)}") if key.errors else PassResult()


@register_validator(name="br/boleto-matches-line", data_type="object")
class BoletoMatchesLine(Validator):
    """The amount, due date and bank printed on the boleto against the ones its digit line encodes"""

    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        line = br.check_linha_digitavel(value["linhaDigitavel"], today(metadata))
        issues = Issues()
        # A digit line that fails its own check digits has nothing reliable to compare with
        if line.errors:
            return issues.result()
        if value.get("valor") is not None and line.amount is not None:
            issues.add(same_money(value["valor"], line.amount), ["valor"], f"the digit line says {brl(line.amount)}")
        if value.get("vencimento") and line.due_date:
            issues.add(value["vencimento"] == line.due_date, ["vencimento"], f"the digit line says {line.due_date}")
        code = br.bank_code(value["banco"]) if value.get("banco") else None
        if code and line.bank:
            issues.add(code == line.bank, ["banco"], f"the digit line is from bank {line.bank}")
        return issues.result()


@register_validator(name="br/nfe-matches-key", data_type="object")
class NfeMatchesKey(Validator):
    """The issuer, number, series, month and state against the ones in the access key"""

    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        key = br.check_nfe_key(value["chaveAcesso"])
        issues = Issues()
        if key.errors:
            return issues.result()
        cnpj = br.normalize_cnpj(value["emitente"]["cnpj"])
        issues.add(cnpj == key.cnpj, ["emitente.cnpj"], f"the access key says {br.format_cnpj(key.cnpj or '')}")
        issues.add(value["numero"] == key.number, ["numero"], f"the access key says {key.number}")
        issues.add(value["serie"] == key.series, ["serie"], f"the access key says {key.series}")
        issues.add(value["dataEmissao"][:7] == key.month, ["dataEmissao"], f"the access key says {key.month}")
        issues.add(value["emitente"]["uf"].upper() == key.uf, ["emitente.uf"], f"the access key says {key.uf}")
        return issues.result()


@register_validator(name="br/nfe-totals", data_type="object")
class NfeTotals(Validator):
    """Quantity × unit price on each line, the lines against the products total, and the invoice total"""

    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        issues = Issues()
        trusted = []
        for i, item in enumerate(value["itens"]):
            got = item["quantidade"] * item["valorUnitario"]
            p = f"itens[{i}]"
            # Unit prices can have more decimals than the printed total, so allow a cent of rounding
            trusted.append(
                issues.add(
                    abs(got - item["valorTotal"]) <= 0.011,
                    [f"{p}.quantidade", f"{p}.valorUnitario", f"{p}.valorTotal"],
                    f"{num(item['quantidade'])} × {brl(item['valorUnitario'])} is {brl(got)}, not {brl(item['valorTotal'])}",
                )
            )
        lines = [(f"itens[{i}].valorTotal", item["valorTotal"], trusted[i]) for i, item in enumerate(value["itens"])]
        issues.total("valorProdutos", value["valorProdutos"], lines)
        expected = value["valorProdutos"] + value["valorFrete"] + value["valorOutros"] - value["valorDesconto"]
        issues.add(
            same_money(expected, value["valorTotal"]),
            ["valorTotal", "valorProdutos", "valorFrete", "valorOutros", "valorDesconto"],
            f"products + freight + other − discount is {brl(expected)}, not {brl(value['valorTotal'])}",
        )
        return issues.result()


@register_validator(name="br/informe-totals", data_type="object")
class InformeTotals(Validator):
    """The exempt and exclusive taxation lines against their printed totals"""

    def __init__(self, on_fail: str = "noop", **kwargs):
        super().__init__(on_fail=on_fail, **kwargs)

    def _validate(self, value: Any, metadata: dict[str, Any]) -> ValidationResult:
        issues = Issues()
        for section, total in (("isentos", "totalIsentos"), ("exclusivos", "totalExclusivos")):
            lines = [(f"{section}[{i}].valor", line["valor"], False) for i, line in enumerate(value[section])]
            issues.total(total, value.get(total), lines)
        return issues.result()
