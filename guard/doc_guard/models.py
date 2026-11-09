# The documents as the app's zod schemas (src/lib/schemas.ts) describe them, with the validators
# on the fields they check. The model's own "uncertain" list is not checked here.

from typing import Optional

from pydantic import BaseModel, Field

from .validators import DigitLine, IsoDate, NfeKey, PastYear, ValidDocumentId


def checked(*validators):
    return Field(json_schema_extra={"validators": list(validators)})


class Boleto(BaseModel):
    banco: Optional[str]
    beneficiario: str
    beneficiarioDocumento: Optional[str] = checked(ValidDocumentId("either"))
    pagador: Optional[str]
    pagadorDocumento: Optional[str] = checked(ValidDocumentId("either"))
    linhaDigitavel: str = checked(DigitLine())
    vencimento: Optional[str] = checked(IsoDate())
    valor: Optional[float]
    nossoNumero: Optional[str]
    uncertain: list[str] = []


class Item(BaseModel):
    descricao: str
    quantidade: float
    valorUnitario: float
    valorTotal: float


class Emitente(BaseModel):
    nome: str
    cnpj: str = checked(ValidDocumentId("cnpj"))
    uf: str


class Destinatario(BaseModel):
    nome: str
    documento: Optional[str] = checked(ValidDocumentId("either"))


class Nfe(BaseModel):
    chaveAcesso: str = checked(NfeKey())
    numero: int
    serie: int
    dataEmissao: str = checked(IsoDate())
    emitente: Emitente
    destinatario: Destinatario
    itens: list[Item]
    valorProdutos: float
    valorFrete: float
    valorDesconto: float
    valorOutros: float
    valorTotal: float
    uncertain: list[str] = []


class Line(BaseModel):
    descricao: str
    valor: float


class FontePagadora(BaseModel):
    nome: str
    cnpj: str = checked(ValidDocumentId("cnpj"))


class Beneficiario(BaseModel):
    nome: str
    cpf: str = checked(ValidDocumentId("cpf"))


class Bem(BaseModel):
    descricao: str
    saldoAnterior: float
    saldoAtual: float


class Informe(BaseModel):
    anoCalendario: int = checked(PastYear())
    fontePagadora: FontePagadora
    beneficiario: Beneficiario
    isentos: list[Line]
    totalIsentos: Optional[float]
    exclusivos: list[Line]
    totalExclusivos: Optional[float]
    impostoRetido: Optional[float]
    bens: list[Bem]
    uncertain: list[str] = []
