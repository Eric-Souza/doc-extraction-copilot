// Check digits for Brazilian identifiers. These are the checks that need no model: a CPF or CNPJ
// read with one wrong digit almost always fails them.

export const onlyDigits = (s: string) => s.replace(/\D/g, '')

/** Mod 10 with weights 2, 1, 2, 1... from the right, as in boleto digit lines */
export function mod10(digits: string): number {
  let sum = 0
  let weight = 2
  for (let i = digits.length - 1; i >= 0; i--) {
    const product = Number(digits[i]) * weight
    sum += product > 9 ? product - 9 : product
    weight = weight === 2 ? 1 : 2
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Sum of each character times weights 2 to 9, cycling from the right. Characters count as their
 * ASCII code minus 48, so digits keep their value and the letters in new CNPJs get one too.
 */
export function weightedSum11(chars: string): number {
  let sum = 0
  let weight = 2
  for (let i = chars.length - 1; i >= 0; i--) {
    sum += (chars.charCodeAt(i) - 48) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  return sum
}

/** The check digit used by CNPJs and NF-e keys: remainders 0 and 1 give 0 */
export function mod11(chars: string): number {
  const rest = weightedSum11(chars) % 11
  return rest < 2 ? 0 : 11 - rest
}

/** A CPF from its first 9 digits */
export function completeCpf(base9: string): string {
  let cpf = base9
  for (const len of [9, 10]) {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    cpf += rest === 10 ? 0 : rest
  }
  return cpf
}

/**
 * CNPJs issued from July 2026 can have letters in their first 12 characters, so they are
 * compared upper-cased with only letters and digits left.
 */
export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

/** A CNPJ from its first 12 characters */
export function completeCnpj(base12: string): string {
  const first = normalizeCnpj(base12)
  const withOne = first + mod11(first)
  return withOne + mod11(withOne)
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  // All-same-digit numbers pass the arithmetic but are never issued
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  return completeCpf(cpf.slice(0, 9)) === cpf
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false
  return completeCnpj(cnpj.slice(0, 12)) === cnpj
}

/** A CPF or a CNPJ, told apart by length */
export function isValidDocument(value: string): boolean {
  const n = normalizeCnpj(value)
  return n.length === 11 ? isValidCpf(n) : isValidCnpj(n)
}

export function formatCpf(cpf: string): string {
  const d = onlyDigits(cpf)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatCnpj(cnpj: string): string {
  const c = normalizeCnpj(cnpj)
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}
