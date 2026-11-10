# Eval: doc-extraction-2b (type detected)

36 synthetic documents, 768 fields. Classified correctly: 36/36. Median time per document: 4.2s.

| | Docs | Field accuracy | Exact match | Flag precision | Flag recall | Silent errors |
|---|---|---|---|---|---|---|
| **All** | 36 | 99.7% | 94.4% | 100.0% | 100.0% | 0 |
| boleto | 12 | 100.0% | 100.0% | 100.0% | 100.0% | 0 |
| nfe | 12 | 99.5% | 83.3% | 100.0% | 100.0% | 0 |
| informe | 12 | 100.0% | 100.0% | 100.0% | 100.0% | 0 |
| Phone photo (JPEG) | 13 | 99.7% | 92.3% | 100.0% | 100.0% | 0 |
| Clean PNG | 10 | 100.0% | 100.0% | 100.0% | 100.0% | 0 |
| PDF | 13 | 99.6% | 92.3% | 100.0% | 100.0% | 0 |

Planted inconsistencies caught: 6/6. 18 of 768 fields were sent to review.

## Accuracy per field

| Field | Accuracy | Count |
|---|---|---|
| chaveAcesso | 91.7% | 12 |
| numero | 91.7% | 12 |
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
| emitente.cnpj | 100.0% | 12 |
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
| nfe-03 | numero | flagged |
| nfe-04 | chaveAcesso | flagged |
