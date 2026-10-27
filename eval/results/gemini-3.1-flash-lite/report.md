# Eval: gemini-3.1-flash-lite (type detected)

36 synthetic documents, 768 fields. Classified correctly: 36/36. Median time per document: 6.6s.

| | Docs | Field accuracy | Exact match | Flag precision | Flag recall | Silent errors |
|---|---|---|---|---|---|---|
| **All** | 36 | 99.5% | 91.7% | 87.0% | 100.0% | 0 |
| boleto | 12 | 100.0% | 100.0% | 40.0% | 100.0% | 0 |
| nfe | 12 | 99.0% | 75.0% | 100.0% | 100.0% | 0 |
| informe | 12 | 100.0% | 100.0% | 100.0% | 100.0% | 0 |
| Phone photo (JPEG) | 13 | 99.3% | 84.6% | 75.0% | 100.0% | 0 |
| Clean PNG | 10 | 100.0% | 100.0% | 83.3% | 100.0% | 0 |
| PDF | 13 | 99.2% | 92.3% | 100.0% | 100.0% | 0 |

Planted inconsistencies caught: 6/6. 23 of 768 fields were sent to review.

## Accuracy per field

| Field | Accuracy | Count |
|---|---|---|
| chaveAcesso | 75.0% | 12 |
| emitente.cnpj | 91.7% | 12 |
| anoCalendario | 100.0% | 12 |
| banco | 100.0% | 12 |
| beneficiario | 100.0% | 12 |
| beneficiario.cpf | 100.0% | 12 |
| beneficiario.nome | 100.0% | 12 |
| beneficiarioDocumento | 100.0% | 12 |
| bens[].descricao | 100.0% | 24 |
| bens[].saldoAnterior | 100.0% | 24 |
| bens[].saldoAtual | 100.0% | 24 |
| dataEmissao | 100.0% | 12 |
| destinatario.documento | 100.0% | 12 |
| destinatario.nome | 100.0% | 12 |
| emitente.nome | 100.0% | 12 |
| emitente.uf | 100.0% | 12 |
| exclusivos[].descricao | 100.0% | 23 |
| exclusivos[].valor | 100.0% | 23 |
| fontePagadora.cnpj | 100.0% | 12 |
| fontePagadora.nome | 100.0% | 12 |
| impostoRetido | 100.0% | 12 |
| isentos[].descricao | 100.0% | 31 |
| isentos[].valor | 100.0% | 31 |
| itens[].descricao | 100.0% | 54 |
| itens[].quantidade | 100.0% | 54 |
| itens[].valorTotal | 100.0% | 54 |
| itens[].valorUnitario | 100.0% | 54 |
| linhaDigitavel | 100.0% | 12 |
| nossoNumero | 100.0% | 12 |
| numero | 100.0% | 12 |
| pagador | 100.0% | 12 |
| pagadorDocumento | 100.0% | 12 |
| serie | 100.0% | 12 |
| totalExclusivos | 100.0% | 12 |
| totalIsentos | 100.0% | 12 |
| valor | 100.0% | 12 |
| valorDesconto | 100.0% | 12 |
| valorFrete | 100.0% | 12 |
| valorOutros | 100.0% | 12 |
| valorProdutos | 100.0% | 12 |
| valorTotal | 100.0% | 12 |
| vencimento | 100.0% | 12 |

## Every wrong field

| Document | Field | Review |
|---|---|---|
| nfe-03 | chaveAcesso | flagged |
| nfe-03 | emitente.cnpj | flagged |
| nfe-06 | chaveAcesso | flagged |
| nfe-12 | chaveAcesso | flagged |
