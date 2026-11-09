# The check digits from src/lib/br, ported line for line so the guard and the app agree. The
# parity test (tests/test_parity.py) runs both on the same documents.

import re
from dataclasses import dataclass, field
from datetime import date, timedelta


def only_digits(s: str) -> str:
    return re.sub(r"\D", "", s)


def mod10(digits: str) -> int:
    """Mod 10 with weights 2, 1, 2, 1... from the right, as in boleto digit lines"""
    total, weight = 0, 2
    for ch in reversed(digits):
        product = int(ch) * weight
        total += product - 9 if product > 9 else product
        weight = 1 if weight == 2 else 2
    return (10 - total % 10) % 10


def weighted_sum11(chars: str) -> int:
    """Weights 2 to 9 from the right; characters count as their code minus 48, for letters in new CNPJs"""
    total, weight = 0, 2
    for ch in reversed(chars):
        total += (ord(ch) - 48) * weight
        weight = 2 if weight == 9 else weight + 1
    return total


def mod11(chars: str) -> int:
    rest = weighted_sum11(chars) % 11
    return 0 if rest < 2 else 11 - rest


def complete_cpf(base9: str) -> str:
    cpf = base9
    for length in (9, 10):
        rest = sum(int(cpf[i]) * (length + 1 - i) for i in range(length)) * 10 % 11
        cpf += str(0 if rest == 10 else rest)
    return cpf


def normalize_cnpj(value: str) -> str:
    return re.sub(r"[^0-9A-Z]", "", value.upper())


def complete_cnpj(base12: str) -> str:
    first = normalize_cnpj(base12)
    with_one = first + str(mod11(first))
    return with_one + str(mod11(with_one))


def is_valid_cpf(value: str) -> bool:
    cpf = only_digits(value)
    if len(cpf) != 11 or re.fullmatch(r"(\d)\1{10}", cpf):
        return False
    return complete_cpf(cpf[:9]) == cpf


def is_valid_cnpj(value: str) -> bool:
    cnpj = normalize_cnpj(value)
    if not re.fullmatch(r"[0-9A-Z]{12}\d{2}", cnpj) or re.fullmatch(r"(\d)\1{13}", cnpj):
        return False
    return complete_cnpj(cnpj[:12]) == cnpj


def is_valid_document(value: str) -> bool:
    n = normalize_cnpj(value)
    return is_valid_cpf(n) if len(n) == 11 else is_valid_cnpj(n)


def format_cnpj(cnpj: str) -> str:
    c = normalize_cnpj(cnpj)
    return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}"


# Boletos


@dataclass
class BoletoCheck:
    kind: str
    errors: list[str]
    amount: float | None = None
    due_date: str | None = None
    bank: str | None = None


def _bank_barcode_digit(digits43: str) -> int:
    dv = 11 - weighted_sum11(digits43) % 11
    return 1 if dv in (0, 10, 11) else dv


def due_date_from_factor(factor: int, reference: date) -> str | None:
    """The factor restarted at 1000 on 2025-02-22, so take the date closer to the reference"""
    if factor == 0:
        return None
    old = date(1997, 10, 7) + timedelta(days=factor)
    current = date(2025, 2, 22) + timedelta(days=factor - 1000)
    return (current if abs(current - reference) <= abs(old - reference) else old).isoformat()


def _check_bank(line: str, reference: date) -> BoletoCheck:
    errors = []
    for i, (digits, dv) in enumerate([(line[0:9], line[9]), (line[10:20], line[20]), (line[21:31], line[31])]):
        if mod10(digits) != int(dv):
            errors.append(f"block {i + 1} check digit is {dv}, expected {mod10(digits)}")
    barcode = line[0:4] + line[32] + line[33:47] + line[4:9] + line[10:20] + line[21:31]
    general = _bank_barcode_digit(barcode[:4] + barcode[5:])
    if general != int(line[32]):
        errors.append(f"general check digit is {line[32]}, expected {general}")
    cents = int(line[37:47])
    return BoletoCheck("bank", errors, cents / 100 if cents else None, due_date_from_factor(int(line[33:37]), reference), line[:3])


def _check_utility(line: str) -> BoletoCheck:
    errors = []
    value_id = line[2]
    if value_id not in "6789":
        errors.append(f"value identifier is {value_id}, expected 6, 7, 8 or 9")
    check = mod10 if value_id in "67" else mod11
    barcode = ""
    for i in range(4):
        digits, dv = line[i * 12 : i * 12 + 11], int(line[i * 12 + 11])
        if check(digits) != dv:
            errors.append(f"block {i + 1} check digit is {dv}, expected {check(digits)}")
        barcode += digits
    general = check(barcode[:3] + barcode[4:])
    if general != int(barcode[3]):
        errors.append(f"general check digit is {barcode[3]}, expected {general}")
    cents = int(barcode[4:15])
    return BoletoCheck("utility", errors, cents / 100 if value_id in "68" and cents else None)


def check_linha_digitavel(value: str, reference: date) -> BoletoCheck:
    line = only_digits(value)
    if len(line) == 47:
        return _check_bank(line, reference)
    if len(line) == 48 and line[0] == "8":
        return _check_utility(line)
    kind = "utility" if line[:1] == "8" else "bank"
    return BoletoCheck(kind, [f"has {len(line)} digits, expected {48 if kind == 'utility' else 47}"])


# The largest issuers, for a bank printed as a logo or a name without its code
BANK_CODES = [
    (r"banco do brasil|\bbb\b", "001"),
    (r"bradesco", "237"),
    (r"ita[uú]", "341"),
    (r"caixa", "104"),
    (r"santander", "033"),
    (r"inter\b", "077"),
    (r"nu ?pagamentos|nubank", "260"),
    (r"sicoob", "756"),
    (r"sicredi", "748"),
    (r"btg", "208"),
    (r"\bc6\b", "336"),
]


def bank_code(printed: str) -> str | None:
    m = re.search(r"\b(\d{3})\b", printed)
    if m:
        return m.group(1)
    name = printed.lower()
    return next((code for pattern, code in BANK_CODES if re.search(pattern, name)), None)


# NF-e access keys

UF_CODES = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}  # fmt: skip


@dataclass
class NfeKey:
    errors: list[str] = field(default_factory=list)
    uf: str | None = None
    month: str | None = None
    cnpj: str | None = None
    series: int | None = None
    number: int | None = None


def check_nfe_key(value: str) -> NfeKey:
    key = re.sub(r"[^0-9A-Z]", "", value.upper())
    if len(key) != 44:
        return NfeKey([f"has {len(key)} characters, expected 44"])
    errors = []
    if not re.fullmatch(r"\d{6}[0-9A-Z]{12}\d{26}", key):
        errors.append("has letters outside the CNPJ part")
    dv = mod11(key[:43])
    if not key[43].isdigit() or dv != int(key[43]):
        errors.append(f"check digit is {key[43]}, expected {dv}")
    uf = UF_CODES.get(key[:2])
    if not uf:
        errors.append(f"state code {key[:2]} does not exist")
    if key[4:6].isdigit() and not 1 <= int(key[4:6]) <= 12:
        errors.append(f"month {key[4:6]} does not exist")
    model = key[20:22]
    if model not in ("55", "65"):
        errors.append(f"model is {model}, expected 55 or 65")
    return NfeKey(errors, uf, f"20{key[2:4]}-{key[4:6]}", key[6:20], _int(key[22:25]), _int(key[25:34]))


def _int(s: str) -> int | None:
    """Like Number() in the app: letters give nothing to compare with"""
    return int(s) if s.isdigit() else None
