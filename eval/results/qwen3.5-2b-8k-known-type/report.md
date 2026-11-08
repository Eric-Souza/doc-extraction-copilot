# Eval: qwen3.5-2b-8k (type given)

36 synthetic documents, 768 fields. Classified correctly: 36/36. Median time per document: 5.8s.

| | Docs | Field accuracy | Exact match | Flag precision | Flag recall | Silent errors |
|---|---|---|---|---|---|---|
| **All** | 36 | 83.3% | 16.7% | 74.3% | 73.2% | 38 |
| boleto | 12 | 51.9% | 0.0% | 100.0% | 77.4% | 12 |
| nfe | 12 | 81.8% | 0.0% | 62.4% | 68.8% | 24 |
| informe | 12 | 97.8% | 50.0% | 71.4% | 83.3% | 2 |
| Phone photo (JPEG) | 13 | 82.6% | 23.1% | 63.5% | 75.5% | 13 |
| Clean PNG | 10 | 85.7% | 10.0% | 92.0% | 63.9% | 13 |
| PDF | 13 | 82.1% | 15.4% | 78.8% | 77.4% | 12 |

Planted inconsistencies caught: 6/6. 140 of 768 fields were sent to review.

## Accuracy per field

| Field | Accuracy | Count |
|---|---|---|
| beneficiarioDocumento | 0.0% | 12 |
| numero | 0.0% | 12 |
| pagadorDocumento | 0.0% | 12 |
| vencimento | 0.0% | 12 |
| emitente.cnpj | 33.3% | 12 |
| nossoNumero | 33.3% | 12 |
| destinatario.nome | 50.0% | 12 |
| chaveAcesso | 58.3% | 12 |
| itens[].valorUnitario | 63.0% | 54 |
| dataEmissao | 66.7% | 12 |
| destinatario.documento | 66.7% | 12 |
| emitente.nome | 66.7% | 12 |
| valor | 66.7% | 12 |
| anoCalendario | 83.3% | 12 |
| banco | 83.3% | 12 |
| fontePagadora.nome | 83.3% | 12 |
| pagador | 83.3% | 12 |
| itens[].valorTotal | 92.6% | 54 |
| exclusivos[].valor | 95.7% | 23 |
| itens[].quantidade | 96.3% | 54 |
| isentos[].valor | 96.8% | 31 |
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
| boleto-01 | beneficiarioDocumento | flagged |
| boleto-01 | pagadorDocumento | flagged |
| boleto-01 | vencimento | flagged |
| boleto-01 | nossoNumero | **silent** |
| boleto-02 | banco | **silent** |
| boleto-02 | beneficiarioDocumento | flagged |
| boleto-02 | pagadorDocumento | flagged |
| boleto-02 | vencimento | flagged |
| boleto-03 | beneficiarioDocumento | flagged |
| boleto-03 | pagadorDocumento | flagged |
| boleto-03 | vencimento | flagged |
| boleto-03 | nossoNumero | **silent** |
| boleto-04 | beneficiarioDocumento | flagged |
| boleto-04 | pagadorDocumento | flagged |
| boleto-04 | vencimento | flagged |
| boleto-04 | valor | flagged |
| boleto-04 | nossoNumero | **silent** |
| boleto-05 | beneficiarioDocumento | flagged |
| boleto-05 | pagadorDocumento | flagged |
| boleto-05 | vencimento | flagged |
| boleto-05 | nossoNumero | **silent** |
| boleto-06 | beneficiarioDocumento | flagged |
| boleto-06 | pagador | **silent** |
| boleto-06 | pagadorDocumento | flagged |
| boleto-06 | vencimento | flagged |
| boleto-06 | valor | flagged |
| boleto-06 | nossoNumero | **silent** |
| boleto-07 | beneficiarioDocumento | flagged |
| boleto-07 | pagadorDocumento | flagged |
| boleto-07 | vencimento | flagged |
| boleto-08 | banco | **silent** |
| boleto-08 | beneficiarioDocumento | flagged |
| boleto-08 | pagadorDocumento | flagged |
| boleto-08 | vencimento | flagged |
| boleto-09 | beneficiarioDocumento | flagged |
| boleto-09 | pagador | **silent** |
| boleto-09 | pagadorDocumento | flagged |
| boleto-09 | vencimento | flagged |
| boleto-09 | nossoNumero | **silent** |
| boleto-10 | beneficiarioDocumento | flagged |
| boleto-10 | pagadorDocumento | flagged |
| boleto-10 | vencimento | flagged |
| boleto-10 | valor | flagged |
| boleto-10 | nossoNumero | **silent** |
| boleto-11 | beneficiarioDocumento | flagged |
| boleto-11 | pagadorDocumento | flagged |
| boleto-11 | vencimento | flagged |
| boleto-11 | valor | flagged |
| boleto-12 | beneficiarioDocumento | flagged |
| boleto-12 | pagadorDocumento | flagged |
| boleto-12 | vencimento | flagged |
| boleto-12 | nossoNumero | **silent** |
| nfe-01 | numero | flagged |
| nfe-01 | emitente.nome | **silent** |
| nfe-01 | emitente.cnpj | flagged |
| nfe-01 | destinatario.nome | **silent** |
| nfe-01 | destinatario.documento | flagged |
| nfe-02 | chaveAcesso | flagged |
| nfe-02 | numero | **silent** |
| nfe-02 | itens[0].valorUnitario | flagged |
| nfe-02 | itens[2].valorUnitario | flagged |
| nfe-02 | itens[3].valorUnitario | flagged |
| nfe-03 | chaveAcesso | flagged |
| nfe-03 | numero | **silent** |
| nfe-03 | dataEmissao | flagged |
| nfe-03 | emitente.cnpj | flagged |
| nfe-03 | itens[0].valorUnitario | flagged |
| nfe-03 | itens[1].valorUnitario | flagged |
| nfe-04 | numero | flagged |
| nfe-04 | dataEmissao | flagged |
| nfe-04 | emitente.nome | **silent** |
| nfe-04 | emitente.cnpj | flagged |
| nfe-04 | destinatario.nome | **silent** |
| nfe-04 | destinatario.documento | flagged |
| nfe-05 | numero | flagged |
| nfe-05 | emitente.cnpj | flagged |
| nfe-05 | destinatario.nome | **silent** |
| nfe-06 | numero | flagged |
| nfe-06 | itens[0].valorUnitario | flagged |
| nfe-06 | itens[1].valorUnitario | **silent** |
| nfe-06 | itens[1].valorTotal | **silent** |
| nfe-06 | itens[2].valorUnitario | **silent** |
| nfe-06 | itens[2].valorTotal | **silent** |
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
| nfe-10 | itens[0].valorUnitario | flagged |
| nfe-10 | itens[1].valorUnitario | flagged |
| nfe-10 | itens[2].valorUnitario | flagged |
| nfe-10 | itens[3].valorUnitario | flagged |
| nfe-10 | itens[4].valorUnitario | flagged |
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
| informe-07 | isentos[1].valor | flagged |
| informe-11 | anoCalendario | flagged |
| informe-12 | anoCalendario | flagged |
