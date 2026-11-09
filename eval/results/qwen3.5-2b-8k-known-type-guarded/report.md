# Eval: qwen3.5-2b-8k (type given), guarded

36 synthetic documents, 768 fields. Classified correctly: 36/36. Median time per document: 6.6s.

| | Docs | Field accuracy | Exact match | Flag precision | Flag recall | Silent errors |
|---|---|---|---|---|---|---|
| **All** | 36 | 88.2% | 19.4% | 86.9% | 70.2% | 31 |
| boleto | 12 | 69.4% | 0.0% | 100.0% | 72.7% | 9 |
| nfe | 12 | 86.2% | 0.0% | 81.6% | 66.7% | 20 |
| informe | 12 | 98.2% | 58.3% | 81.8% | 81.8% | 2 |
| Phone photo (JPEG) | 13 | 89.9% | 23.1% | 86.7% | 81.3% | 6 |
| Clean PNG | 10 | 89.7% | 20.0% | 100.0% | 55.6% | 12 |
| PDF | 13 | 84.8% | 15.4% | 82.1% | 71.1% | 13 |

Planted inconsistencies caught: 5/6. 84 of 768 fields were sent to review.

## Guard and second reading

28 of 36 readings failed a check and were read again. 39 fields changed: 38 fixed, 1 broken. 26 still failed a check after it. Of the planted errors read right the first time, 3 were kept as printed and 1 changed to pass the check.

| Document | Checks failed | Changed | Fixed | Broken | Still failing | Planted error |
|---|---|---|---|---|---|---|
| boleto-01 | 4 | beneficiarioDocumento, pagadorDocumento, nossoNumero | beneficiarioDocumento, pagadorDocumento, nossoNumero | - | 2 |  |
| boleto-02 | 3 | beneficiarioDocumento, pagadorDocumento | beneficiarioDocumento, pagadorDocumento | - | 1 |  |
| boleto-03 | 4 | vencimento | vencimento | - | 2 |  |
| boleto-04 | 5 | - | - | - | 5 |  |
| boleto-05 | 4 | beneficiarioDocumento, pagadorDocumento, nossoNumero | beneficiarioDocumento, pagadorDocumento, nossoNumero | - | 2 |  |
| boleto-06 | 5 | nossoNumero | nossoNumero | - | 5 |  |
| boleto-07 | 4 | vencimento | vencimento | - | 2 |  |
| boleto-08 | 3 | beneficiarioDocumento, pagadorDocumento | beneficiarioDocumento, pagadorDocumento | - | 1 |  |
| boleto-09 | 4 | beneficiarioDocumento, pagadorDocumento, vencimento | beneficiarioDocumento, pagadorDocumento, vencimento | - | 0 |  |
| boleto-10 | 5 | nossoNumero | nossoNumero | - | 5 |  |
| boleto-11 | 5 | beneficiarioDocumento, pagadorDocumento | beneficiarioDocumento, pagadorDocumento | - | 3 | misread |
| boleto-12 | 5 | vencimento, valor | vencimento | valor | 2 | **changed** |
| nfe-01 | 5 | numero | numero | - | 4 |  |
| nfe-02 | 4 | itens[0].valorUnitario, itens[2].valorUnitario, itens[3].valorUnitario | itens[0].valorUnitario, itens[2].valorUnitario, itens[3].valorUnitario | - | 1 |  |
| nfe-03 | 5 | itens[0].valorUnitario, itens[1].valorUnitario | itens[0].valorUnitario, itens[1].valorUnitario | - | 3 |  |
| nfe-04 | 7 | numero | numero | - | 6 |  |
| nfe-05 | 3 | - | - | - | 3 |  |
| nfe-06 | 3 | itens[0].valorUnitario, itens[1].valorUnitario, itens[1].valorTotal, itens[2].valorUnitario, itens[2].valorTotal | itens[0].valorUnitario, itens[1].valorUnitario, itens[1].valorTotal, itens[2].valorUnitario, itens[2].valorTotal | - | 1 |  |
| nfe-07 | 1 | - | - | - | 1 |  |
| nfe-08 | 3 | - | - | - | 3 |  |
| nfe-09 | 9 | - | - | - | 9 |  |
| nfe-10 | 8 | itens[0].valorUnitario, itens[1].valorUnitario, itens[2].valorUnitario, itens[3].valorUnitario, itens[4].valorUnitario | itens[0].valorUnitario, itens[1].valorUnitario, itens[2].valorUnitario, itens[3].valorUnitario, itens[4].valorUnitario | - | 3 |  |
| nfe-11 | 4 | - | - | - | 4 | kept |
| nfe-12 | 7 | - | - | - | 7 | misread |
| informe-03 | 1 | - | - | - | 1 |  |
| informe-07 | 1 | isentos[1].valor | isentos[1].valor | - | 0 |  |
| informe-11 | 2 | - | - | - | 2 | kept |
| informe-12 | 2 | - | - | - | 2 | kept |

## Accuracy per field

| Field | Accuracy | Count |
|---|---|---|
| numero | 16.7% | 12 |
| emitente.cnpj | 33.3% | 12 |
| vencimento | 33.3% | 12 |
| beneficiarioDocumento | 50.0% | 12 |
| destinatario.nome | 50.0% | 12 |
| pagadorDocumento | 50.0% | 12 |
| chaveAcesso | 58.3% | 12 |
| valor | 58.3% | 12 |
| dataEmissao | 66.7% | 12 |
| destinatario.documento | 66.7% | 12 |
| emitente.nome | 66.7% | 12 |
| nossoNumero | 66.7% | 12 |
| anoCalendario | 83.3% | 12 |
| banco | 83.3% | 12 |
| fontePagadora.nome | 83.3% | 12 |
| pagador | 83.3% | 12 |
| itens[].valorUnitario | 87.0% | 54 |
| exclusivos[].valor | 95.7% | 23 |
| itens[].quantidade | 96.3% | 54 |
| itens[].valorTotal | 96.3% | 54 |
| itens[].descricao | 98.1% | 54 |
| beneficiario | 100.0% | 12 |
| beneficiario.cpf | 100.0% | 12 |
| beneficiario.nome | 100.0% | 12 |
| bens[].descricao | 100.0% | 24 |
| bens[].saldoAnterior | 100.0% | 24 |
| bens[].saldoAtual | 100.0% | 24 |
| emitente.uf | 100.0% | 12 |
| exclusivos[].descricao | 100.0% | 23 |
| fontePagadora.cnpj | 100.0% | 12 |
| impostoRetido | 100.0% | 12 |
| isentos[].descricao | 100.0% | 31 |
| isentos[].valor | 100.0% | 31 |
| linhaDigitavel | 100.0% | 12 |
| serie | 100.0% | 12 |
| totalExclusivos | 100.0% | 12 |
| totalIsentos | 100.0% | 12 |
| valorDesconto | 100.0% | 12 |
| valorFrete | 100.0% | 12 |
| valorOutros | 100.0% | 12 |
| valorProdutos | 100.0% | 12 |
| valorTotal | 100.0% | 12 |

## Every wrong field

| Document | Field | Review |
|---|---|---|
| boleto-01 | vencimento | flagged |
| boleto-02 | banco | **silent** |
| boleto-02 | vencimento | flagged |
| boleto-03 | beneficiarioDocumento | flagged |
| boleto-03 | pagadorDocumento | flagged |
| boleto-03 | nossoNumero | **silent** |
| boleto-04 | beneficiarioDocumento | flagged |
| boleto-04 | pagadorDocumento | flagged |
| boleto-04 | vencimento | flagged |
| boleto-04 | valor | flagged |
| boleto-04 | nossoNumero | **silent** |
| boleto-05 | vencimento | flagged |
| boleto-06 | beneficiarioDocumento | flagged |
| boleto-06 | pagador | **silent** |
| boleto-06 | pagadorDocumento | flagged |
| boleto-06 | vencimento | flagged |
| boleto-06 | valor | flagged |
| boleto-07 | beneficiarioDocumento | flagged |
| boleto-07 | pagadorDocumento | flagged |
| boleto-08 | banco | **silent** |
| boleto-08 | vencimento | flagged |
| boleto-09 | pagador | **silent** |
| boleto-09 | nossoNumero | **silent** |
| boleto-10 | beneficiarioDocumento | flagged |
| boleto-10 | pagadorDocumento | flagged |
| boleto-10 | vencimento | flagged |
| boleto-10 | valor | flagged |
| boleto-11 | vencimento | flagged |
| boleto-11 | valor | flagged |
| boleto-12 | beneficiarioDocumento | flagged |
| boleto-12 | pagadorDocumento | flagged |
| boleto-12 | valor | **silent** |
| boleto-12 | nossoNumero | **silent** |
| nfe-01 | emitente.nome | **silent** |
| nfe-01 | emitente.cnpj | flagged |
| nfe-01 | destinatario.nome | **silent** |
| nfe-01 | destinatario.documento | flagged |
| nfe-02 | chaveAcesso | flagged |
| nfe-02 | numero | **silent** |
| nfe-03 | chaveAcesso | flagged |
| nfe-03 | numero | **silent** |
| nfe-03 | dataEmissao | flagged |
| nfe-03 | emitente.cnpj | flagged |
| nfe-04 | dataEmissao | flagged |
| nfe-04 | emitente.nome | **silent** |
| nfe-04 | emitente.cnpj | flagged |
| nfe-04 | destinatario.nome | **silent** |
| nfe-04 | destinatario.documento | flagged |
| nfe-05 | numero | flagged |
| nfe-05 | emitente.cnpj | flagged |
| nfe-05 | destinatario.nome | **silent** |
| nfe-06 | numero | flagged |
| nfe-07 | chaveAcesso | flagged |
| nfe-07 | numero | **silent** |
| nfe-08 | chaveAcesso | flagged |
| nfe-08 | numero | **silent** |
| nfe-08 | emitente.nome | **silent** |
| nfe-08 | emitente.cnpj | flagged |
| nfe-08 | destinatario.nome | **silent** |
| nfe-08 | destinatario.documento | flagged |
| nfe-09 | numero | flagged |
| nfe-09 | dataEmissao | flagged |
| nfe-09 | emitente.cnpj | flagged |
| nfe-09 | destinatario.nome | **silent** |
| nfe-09 | itens[0].valorUnitario | flagged |
| nfe-09 | itens[1].valorUnitario | flagged |
| nfe-09 | itens[3].quantidade | flagged |
| nfe-09 | itens[3].valorUnitario | flagged |
| nfe-09 | itens[3].valorTotal | flagged |
| nfe-09 | itens[4].descricao | **silent** |
| nfe-09 | itens[4].quantidade | **silent** |
| nfe-09 | itens[4].valorUnitario | **silent** |
| nfe-09 | itens[4].valorTotal | **silent** |
| nfe-10 | numero | flagged |
| nfe-10 | dataEmissao | flagged |
| nfe-11 | chaveAcesso | flagged |
| nfe-11 | numero | **silent** |
| nfe-11 | emitente.nome | **silent** |
| nfe-11 | emitente.cnpj | flagged |
| nfe-11 | destinatario.nome | **silent** |
| nfe-11 | destinatario.documento | **silent** |
| nfe-12 | numero | flagged |
| nfe-12 | emitente.cnpj | flagged |
| nfe-12 | itens[0].valorUnitario | flagged |
| nfe-12 | itens[1].valorUnitario | flagged |
| nfe-12 | itens[3].valorUnitario | flagged |
| informe-03 | exclusivos[0].valor | flagged |
| informe-04 | fontePagadora.nome | **silent** |
| informe-05 | fontePagadora.nome | **silent** |
| informe-11 | anoCalendario | flagged |
| informe-12 | anoCalendario | flagged |
