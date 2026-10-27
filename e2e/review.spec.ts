import { expect, test } from '@playwright/test'

test('flags a misread amount, and clears it once corrected', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Boleto', exact: true }).click()
  await expect(page.getByTestId('summary')).toHaveText('1 field to review')
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled()

  const amount = page.locator('[data-field="valor"]')
  const detail = await amount.getByText(/^Amount: the digit line says/).textContent()
  const right = detail!.match(/R\$\s?([\d.,]+)/)![1]
  await amount.getByRole('textbox').fill(right)
  await amount.getByRole('textbox').press('Enter')

  await expect(page.getByTestId('summary')).toHaveText('Nothing left to review')
  await expect(amount.getByText('Checked')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeEnabled()
})

test('cross-checks a DANFE with its access key, and lets the user confirm a field', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'DANFE', exact: true }).click()
  await expect(page.getByTestId('summary')).toHaveText('1 field to review')
  const number = page.locator('[data-field="numero"]')
  await expect(number.getByText(/Number in key: the access key says \d+/)).toBeVisible()
  await expect(page.getByTestId('checks')).toContainText('Products total')

  await number.getByRole('button', { name: "It's right" }).click()
  await expect(number.getByText('Confirmed')).toBeVisible()
  await expect(page.getByTestId('summary')).toHaveText('Nothing left to review')
})

test('sends the fields the model was unsure of to review', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Informe', exact: true }).click()
  await expect(page.getByTestId('summary')).toHaveText('1 field to review')
  await expect(page.locator('[data-field="beneficiario.nome"]')).toContainText('The model was not sure it read this right')
  await expect(page.getByRole('heading', { name: 'Exempt income (isentos)' })).toBeVisible()
})

test('rejects files that are not images or PDFs', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveText('Use a PNG, JPEG or WebP image, or a PDF.')
})
