// HTML for the synthetic documents, laid out like the real ones: a boleto's ficha de
// compensação, a DANFE and a broker's informe de rendimentos. scripts/make-dataset.ts renders
// them to PNG, JPEG and PDF with a headless browser.

import { checkLinhaDigitavel } from './br/boleto'
import type { Boleto, Informe, Nfe } from './schemas'
import type { Sample } from './synthetic'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const br = (iso: string) => iso.split('-').reverse().join('/')

// Interleaved 2 of 5, the barcode on boletos: n is a narrow element, w a wide one
const I25 = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn']

/** The barcode as SVG bars: pairs of digits, the first drawn in bars and the second in spaces */
export function barcodeSvg(digits: string, height = 50): string {
  const narrow = 1
  const wide = 3
  const widths: number[] = [narrow, narrow, narrow, narrow]
  for (let i = 0; i < digits.length; i += 2) {
    const bars = I25[Number(digits[i])]
    const spaces = I25[Number(digits[i + 1])]
    for (let k = 0; k < 5; k++) widths.push(bars[k] === 'w' ? wide : narrow, spaces[k] === 'w' ? wide : narrow)
  }
  widths.push(wide, narrow, narrow)
  let x = 0
  let rects = ''
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="${height}"/>`
    x += w
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}" fill="#000">${rects}</svg>`
}

const BASE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; }
.page { width: 820px; padding: 28px; background: #fff; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #333; padding: 3px 6px; vertical-align: top; font-size: 12px; }
.l { display: block; font-size: 9px; color: #444; text-transform: uppercase; }
.v { display: block; font-size: 13px; font-weight: bold; margin-top: 1px; }
.r { text-align: right; }
h1 { font-size: 18px; margin: 0 0 4px; }
h2 { font-size: 12px; margin: 14px 0 4px; text-transform: uppercase; background: #e8e8e8; padding: 4px 6px; border: 1px solid #333; }
`

const cell = (label: string, value: string, extra = '') => `<td ${extra}><span class="l">${label}</span><span class="v">${value}</span></td>`

function boletoHtml(d: Boleto): string {
  const line = checkLinhaDigitavel(d.linhaDigitavel)
  const bank = d.banco ? esc(d.banco.replace(/ (\d{3}-\d)$/, '')) : esc(d.beneficiario)
  const code = d.banco?.match(/\d{3}-\d$/)?.[0] ?? ''
  const head =
    `<div style="display:flex;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:4px;gap:14px;">` +
    `<div style="font-size:20px;font-weight:bold;">${bank}</div>` +
    (code ? `<div style="font-size:20px;font-weight:bold;border-left:2px solid #111;border-right:2px solid #111;padding:0 10px;">${code}</div>` : '') +
    `<div style="flex:1;text-align:right;font-size:15px;font-weight:bold;letter-spacing:.5px;">${esc(d.linhaDigitavel)}</div></div>`
  const receipt =
    `<div style="font-size:10px;color:#444;margin-bottom:6px;">RECIBO DO PAGADOR</div>` +
    `<table><tr>${cell('Beneficiário', esc(d.beneficiario), 'colspan="2"')}${cell('Vencimento', d.vencimento ? br(d.vencimento) : 'Contra apresentação')}</tr>` +
    `<tr>${cell('CPF/CNPJ do beneficiário', esc(d.beneficiarioDocumento ?? ''))}${cell('Pagador', esc(d.pagador ?? ''))}${cell('(=) Valor do documento', d.valor !== null ? `R$ ${brl(d.valor)}` : '', 'class="r"')}</tr></table>` +
    `<div style="border-top:1px dashed #666;margin:18px 0;"></div>`
  const ficha =
    `<table style="margin-top:6px;">` +
    `<tr>${cell('Local de pagamento', 'Pagável em qualquer banco até o vencimento', 'colspan="3"')}${cell('Vencimento', d.vencimento ? br(d.vencimento) : '', 'class="r"')}</tr>` +
    `<tr>${cell('Beneficiário', esc(d.beneficiario), 'colspan="2"')}${cell('CPF/CNPJ', esc(d.beneficiarioDocumento ?? ''))}${cell('Nosso número', esc(d.nossoNumero ?? ''), 'class="r"')}</tr>` +
    `<tr>${cell('Data do documento', '27/09/2026')}${cell('Espécie doc.', 'DM')}${cell('Aceite', 'N')}${cell('(=) Valor do documento', d.valor !== null ? brl(d.valor) : '', 'class="r"')}</tr>` +
    `<tr><td colspan="3" rowspan="3" style="height:90px;"><span class="l">Instruções</span><div style="font-size:12px;margin-top:4px;line-height:1.5;">Após o vencimento cobrar multa de 2% e juros de 1% ao mês.<br>Não receber após 30 dias do vencimento.</div></td>${cell('(-) Desconto', '', 'class="r"')}</tr>` +
    `<tr>${cell('(+) Mora / multa', '', 'class="r"')}</tr><tr>${cell('(=) Valor cobrado', '', 'class="r"')}</tr>` +
    `<tr><td colspan="4"><span class="l">Pagador</span><span class="v">${esc(d.pagador ?? '')} &nbsp; CPF: ${esc(d.pagadorDocumento ?? '')}</span></td></tr>` +
    `</table>`
  const bars = line.barcode ? `<div style="margin-top:12px;">${barcodeSvg(line.barcode)}</div>` : ''
  return receipt + head + ficha + bars + `<div style="font-size:10px;text-align:right;color:#444;">Autenticação mecânica - Ficha de compensação</div>`
}

function nfeHtml(d: Nfe): string {
  const rows = d.itens
    .map(
      (it, i) =>
        `<tr><td>${String(i + 1).padStart(3, '0')}</td><td>${esc(it.descricao)}</td><td>UN</td><td class="r">${it.quantidade.toLocaleString('pt-BR')}</td>` +
        `<td class="r">${brl(it.valorUnitario)}</td><td class="r">${brl(it.valorTotal)}</td></tr>`,
    )
    .join('')
  return (
    `<table><tr><td style="width:46%;"><div style="font-size:16px;font-weight:bold;">${esc(d.emitente.nome)}</div>` +
    `<div style="font-size:11px;margin-top:4px;">Rua das Flores, 120 - Centro<br>${d.emitente.uf} - CEP 01000-000</div></td>` +
    `<td style="width:18%;text-align:center;"><div style="font-size:18px;font-weight:bold;">DANFE</div><div style="font-size:9px;">Documento Auxiliar da Nota Fiscal Eletrônica</div>` +
    `<div style="font-size:11px;margin-top:6px;">1 - SAÍDA</div><div style="font-size:12px;font-weight:bold;margin-top:6px;">Nº ${String(d.numero).padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')}<br>SÉRIE ${d.serie}</div></td>` +
    `<td><span class="l">Chave de acesso</span><span class="v" style="font-size:13px;letter-spacing:.3px;">${esc(d.chaveAcesso)}</span>` +
    `<div style="font-size:10px;margin-top:8px;">Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal</div></td></tr></table>` +
    `<table style="margin-top:4px;"><tr>${cell('Natureza da operação', 'Venda de mercadoria', 'style="width:60%"')}${cell('CNPJ do emitente', esc(d.emitente.cnpj))}</tr></table>` +
    `<h2>Destinatário / remetente</h2>` +
    `<table><tr>${cell('Nome / razão social', esc(d.destinatario.nome), 'style="width:60%"')}${cell('CNPJ / CPF', esc(d.destinatario.documento ?? ''))}${cell('Data da emissão', br(d.dataEmissao))}</tr></table>` +
    `<h2>Cálculo do imposto</h2>` +
    `<table><tr>${cell('Valor total dos produtos', brl(d.valorProdutos), 'class="r"')}${cell('Valor do frete', brl(d.valorFrete), 'class="r"')}` +
    `${cell('Desconto', brl(d.valorDesconto), 'class="r"')}${cell('Outras despesas', brl(d.valorOutros), 'class="r"')}${cell('Valor total da nota', brl(d.valorTotal), 'class="r"')}</tr></table>` +
    `<h2>Dados dos produtos / serviços</h2>` +
    `<table><tr><th>Cód.</th><th>Descrição</th><th>Un.</th><th>Qtd.</th><th>Valor unit.</th><th>Valor total</th></tr>${rows}</table>` +
    `<h2>Dados adicionais</h2><table><tr><td style="height:50px;font-size:11px;">Documento emitido por ME ou EPP optante pelo Simples Nacional.</td></tr></table>`
  )
}

function informeHtml(d: Informe): string {
  const lines = (xs: { descricao: string; valor: number }[], total: number | null) =>
    `<table>${xs.map((l, i) => `<tr><td style="width:6%;">${String(i + 1).padStart(2, '0')}</td><td>${esc(l.descricao)}</td><td class="r" style="width:22%;">${brl(l.valor)}</td></tr>`).join('')}` +
    (total !== null ? `<tr><td></td><td><b>Total</b></td><td class="r"><b>${brl(total)}</b></td></tr>` : '') +
    `</table>`
  return (
    `<div style="text-align:center;margin-bottom:10px;"><h1>Comprovante de Rendimentos</h1><div style="font-size:12px;">Informe de rendimentos financeiros - Ano-calendário ${d.anoCalendario}</div>` +
    `<div style="font-size:11px;color:#444;">Imposto sobre a renda da pessoa física - Exercício ${d.anoCalendario + 1}</div></div>` +
    `<h2>1. Fonte pagadora</h2><table><tr>${cell('Nome empresarial', esc(d.fontePagadora.nome), 'style="width:65%"')}${cell('CNPJ', esc(d.fontePagadora.cnpj))}</tr></table>` +
    `<h2>2. Pessoa física beneficiária dos rendimentos</h2><table><tr>${cell('Nome completo', esc(d.beneficiario.nome), 'style="width:65%"')}${cell('CPF', esc(d.beneficiario.cpf))}</tr></table>` +
    `<h2>3. Rendimentos isentos e não tributáveis (valores em reais)</h2>${lines(d.isentos, d.totalIsentos)}` +
    `<h2>4. Rendimentos sujeitos à tributação exclusiva / definitiva (valores em reais)</h2>${lines(d.exclusivos, d.totalExclusivos)}` +
    (d.impostoRetido !== null
      ? `<table style="margin-top:4px;"><tr><td>Imposto de renda retido na fonte sobre os rendimentos acima</td><td class="r" style="width:22%;"><b>${brl(d.impostoRetido)}</b></td></tr></table>`
      : '') +
    `<h2>5. Bens e direitos - saldos em 31/12</h2>` +
    `<table><tr><th>Discriminação</th><th class="r">31/12/${d.anoCalendario - 1}</th><th class="r">31/12/${d.anoCalendario}</th></tr>` +
    d.bens.map((b) => `<tr><td>${esc(b.descricao)}</td><td class="r">${brl(b.saldoAnterior)}</td><td class="r">${brl(b.saldoAtual)}</td></tr>`).join('') +
    `</table>` +
    `<div style="font-size:10px;color:#444;margin-top:14px;">Documento fictício gerado para testes. Informações prestadas conforme a Instrução Normativa RFB vigente.</div>`
  )
}

/** The full page for a sample, with its photo effects for JPEGs */
export function sampleHtml(s: Sample): string {
  const body = s.doc.type === 'boleto' ? boletoHtml(s.doc.data) : s.doc.type === 'nfe' ? nfeHtml(s.doc.data) : informeHtml(s.doc.data)
  const { rotate, blur, contrast } = s.look
  const photo = s.look.format === 'jpeg'
  const wrap = photo
    ? `body { background: #8c8478; padding: 40px; display: inline-block; } .page { transform: rotate(${rotate}deg); filter: blur(${blur}px) contrast(${contrast}) brightness(0.97) sepia(0.12); box-shadow: 0 6px 18px rgba(0,0,0,.45); }`
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${wrap}</style></head><body><div class="page">${body}</div></body></html>`
}
