# Eval: qwen3.5-2b-8k (type given)

36 synthetic documents, 768 fields. Classified correctly: 36/36. Median time per document: 8.0s.

| | Docs | Field accuracy | Exact match | Flag precision | Flag recall | Silent errors |
|---|---|---|---|---|---|---|
| **All** | 36 | 89.5% | 16.7% | 95.2% | 60.8% | 38 |
| boleto | 12 | 73.1% | 0.0% | 100.0% | 58.1% | 13 |
| nfe | 12 | 88.3% | 0.0% | 96.7% | 54.7% | 24 |
| informe | 12 | 97.5% | 50.0% | 85.7% | 92.3% | 1 |
| Phone photo (JPEG) | 13 | 91.7% | 23.1% | 100.0% | 71.4% | 8 |
| Clean PNG | 10 | 93.7% | 30.0% | 100.0% | 63.2% | 7 |
| PDF | 13 | 83.3% | 0.0% | 90.0% | 54.0% | 23 |

Planted inconsistencies caught: 6/6. 62 of 768 fields were sent to review.

## Accuracy per field

| Field | Accuracy | Count |
|---|---|---|
| numero | 0.0% | 12 |
| vencimento | 0.0% | 12 |
| destinatario.documento | 16.7% | 12 |
| emitente.cnpj | 33.3% | 12 |
| banco | 41.7% | 12 |
| anoCalendario | 58.3% | 12 |
| destinatario.nome | 66.7% | 12 |
| nossoNumero | 66.7% | 12 |
| chaveAcesso | 75.0% | 12 |
| pagadorDocumento | 75.0% | 12 |
| pagador | 83.3% | 12 |
| serie | 83.3% | 12 |
| fontePagadora.nome | 91.7% | 12 |
| valor | 91.7% | 12 |
| exclusivos[].valor | 95.7% | 23 |
| itens[].quantidade | 96.3% | 54 |
| itens[].valorTotal | 96.3% | 54 |
| itens[].descricao | 98.1% | 54 |
| itens[].valorUnitario | 98.1% | 54 |
| beneficiario | 100.0% | 12 |
| beneficiario.cpf | 100.0% | 12 |
| beneficiario.nome | 100.0% | 12 |
| beneficiarioDocumento | 100.0% | 12 |
| bens[].descricao | 100.0% | 24 |
| bens[].saldoAnterior | 100.0% | 24 |
| bens[].saldoAtual | 100.0% | 24 |
| dataEmissao | 100.0% | 12 |
| emitente.nome | 100.0% | 12 |
| emitente.uf | 100.0% | 12 |
| exclusivos[].descricao | 100.0% | 23 |
| fontePagadora.cnpj | 100.0% | 12 |
| impostoRetido | 100.0% | 12 |
| isentos[].descricao | 100.0% | 31 |
| isentos[].valor | 100.0% | 31 |
| linhaDigitavel | 100.0% | 12 |
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
| boleto-01 | banco | **silent** |
| boleto-01 | vencimento | flagged |
| boleto-02 | vencimento | flagged |
| boleto-03 | banco | **silent** |
| boleto-03 | pagadorDocumento | flagged |
| boleto-03 | vencimento | flagged |
| boleto-03 | valor | flagged |
| boleto-03 | nossoNumero | **silent** |
| boleto-04 | banco | **silent** |
| boleto-04 | vencimento | flagged |
| boleto-05 | banco | **silent** |
| boleto-05 | vencimento | flagged |
| boleto-06 | vencimento | flagged |
| boleto-07 | banco | **silent** |
| boleto-07 | vencimento | flagged |
| boleto-07 | nossoNumero | **silent** |
| boleto-08 | pagador | **silent** |
| boleto-08 | pagadorDocumento | flagged |
| boleto-08 | vencimento | flagged |
| boleto-09 | banco | **silent** |
| boleto-09 | pagador | **silent** |
| boleto-09 | vencimento | flagged |
| boleto-09 | nossoNumero | **silent** |
| boleto-10 | pagadorDocumento | flagged |
| boleto-10 | vencimento | flagged |
| boleto-11 | vencimento | flagged |
| boleto-12 | banco | **silent** |
| boleto-12 | vencimento | flagged |
| boleto-12 | nossoNumero | **silent** |
| nfe-01 | numero | flagged |
| nfe-01 | destinatario.nome | **silent** |
| nfe-01 | destinatario.documento | **silent** |
| nfe-02 | chaveAcesso | flagged |
| nfe-02 | numero | **silent** |
| nfe-03 | numero | flagged |
| nfe-03 | serie | flagged |
| nfe-03 | emitente.cnpj | flagged |
| nfe-03 | destinatario.documento | **silent** |
| nfe-04 | numero | flagged |
| nfe-04 | emitente.cnpj | flagged |
| nfe-04 | destinatario.nome | **silent** |
| nfe-04 | destinatario.documento | **silent** |
| nfe-05 | numero | flagged |
| nfe-05 | emitente.cnpj | flagged |
| nfe-05 | destinatario.nome | **silent** |
| nfe-05 | destinatario.documento | **silent** |
| nfe-06 | numero | flagged |
| nfe-06 | emitente.cnpj | flagged |
| nfe-06 | destinatario.documento | **silent** |
| nfe-07 | numero | flagged |
| nfe-07 | destinatario.documento | **silent** |
| nfe-08 | numero | flagged |
| nfe-08 | emitente.cnpj | flagged |
| nfe-08 | destinatario.documento | **silent** |
| nfe-09 | chaveAcesso | flagged |
| nfe-09 | numero | **silent** |
| nfe-09 | serie | **silent** |
| nfe-09 | emitente.cnpj | flagged |
| nfe-09 | destinatario.nome | **silent** |
| nfe-09 | destinatario.documento | **silent** |
| nfe-09 | itens[3].quantidade | **silent** |
| nfe-09 | itens[3].valorTotal | **silent** |
| nfe-09 | itens[4].descricao | **silent** |
| nfe-09 | itens[4].quantidade | **silent** |
| nfe-09 | itens[4].valorUnitario | **silent** |
| nfe-09 | itens[4].valorTotal | **silent** |
| nfe-10 | numero | flagged |
| nfe-10 | emitente.cnpj | flagged |
| nfe-10 | destinatario.documento | **silent** |
| nfe-11 | chaveAcesso | flagged |
| nfe-11 | numero | **silent** |
| nfe-11 | destinatario.documento | **silent** |
| nfe-12 | numero | flagged |
| nfe-12 | emitente.cnpj | flagged |
| informe-02 | anoCalendario | flagged |
| informe-03 | anoCalendario | flagged |
| informe-03 | exclusivos[0].valor | flagged |
| informe-04 | fontePagadora.nome | **silent** |
| informe-08 | anoCalendario | flagged |
| informe-11 | anoCalendario | flagged |
| informe-12 | anoCalendario | flagged |
