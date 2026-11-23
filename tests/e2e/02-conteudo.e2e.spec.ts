import { expect, type Page, test } from '@playwright/test'

/**
 * Passo 2: cria tag, categoria, página e post pelo admin.
 * Roda depois do 01-smoke (que garante o primeiro usuário). Usa sufixo único
 * pra poder rodar de novo no mesmo banco descartável de dev/CI.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const shotsDir = process.env.SHOTS_DIR
const run = Date.now().toString(36)

test.describe.configure({ mode: 'serial' })

const shot = async (page: Page, name: string) => {
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}.png` })
}

async function login(page: Page) {
  await page.goto('/admin/login')
  await expect(page.locator('#field-email')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.fill('#field-email', email!)
  await page.fill('#field-password', password!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 })
}

async function openCreate(page: Page, collection: string) {
  await page.goto(`/admin/collections/${collection}/create`)
  await expect(page.locator('#field-name, #field-title').first()).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
}

async function typeInEditor(page: Page, text: string) {
  const editor = page.locator('[data-lexical-editor="true"]').first()
  await editor.click()
  await page.keyboard.type(text)
}

async function pickRelationship(page: Page, fieldId: string, optionText: string) {
  const field = page.locator(`#${fieldId}`)
  await field.locator('.rs__control').click()
  await field.locator('input').first().fill(optionText.slice(0, 12))
  await page.locator('.rs__option', { hasText: optionText }).first().click()
}

async function expectSaved(page: Page, collection: string) {
  await expect(page).toHaveURL(new RegExp(`/admin/collections/${collection}/[a-f0-9]{24}`), {
    timeout: 30_000,
  })
}

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, 'defina E2E_EMAIL e E2E_PASSWORD')
  // Viewport alto em vez de fullPage: o header fixo do admin não se repete no print.
  await page.setViewportSize({ width: 1440, height: 1500 })
  await login(page)
})

test('dashboard mostra as collections e globals do passo 2', async ({ page }) => {
  for (const label of ['Posts', 'Páginas', 'Mídias', 'Tags', 'Categorias', 'Usuários']) {
    await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible()
  }
  await shot(page, 'p2-01-dashboard')
})

test('cria uma tag', async ({ page }) => {
  await openCreate(page, 'tags')
  await page.fill('#field-name', `Inteligência Artificial ${run}`)
  await page.fill('#field-description', 'Posts sobre IA, modelos locais e ferramentas.')
  await shot(page, 'p2-02-tag-preenchida')
  await page.click('#action-save')
  await expectSaved(page, 'tags')
  await expect(page.locator('#field-slug')).toHaveValue(`inteligencia-artificial-${run}`)
  await shot(page, 'p2-03-tag-salva')
})

test('cria uma categoria', async ({ page }) => {
  await openCreate(page, 'categories')
  await page.fill('#field-name', `Opinião ${run}`)
  await page.fill('#field-description', 'O que eu penso, sem rodeios.')
  await page.fill('#field-color', '#D9480F')
  await page.click('#action-save')
  await expectSaved(page, 'categories')
  await expect(page.locator('#field-slug')).toHaveValue(`opiniao-${run}`)
  await shot(page, 'p2-04-categoria-salva')
})

test('cria e publica uma página', async ({ page }) => {
  await openCreate(page, 'pages')
  await page.fill('#field-title', `Sobre ${run}`)
  await typeInEditor(page, 'Página de teste do passo 2. A bio de verdade entra depois.')
  await shot(page, 'p2-05-pagina-preenchida')
  await expect(async () => {
    await page.click('#action-save')
    await expect(page.getByText('Publicado', { exact: true }).first()).toBeVisible({
      timeout: 5_000,
    })
  }).toPass({ timeout: 45_000 })
  await expectSaved(page, 'pages')
  await expect(page.locator('#field-slug')).toHaveValue(`sobre-${run}`)
  await shot(page, 'p2-06-pagina-publicada')
})

test('cria e publica um post com síntese, tag e categoria', async ({ page }) => {
  await openCreate(page, 'posts')
  await page.fill('#field-title', `Meu primeiro post ${run}`)
  await page.fill('#field-subtitle', 'Linha fina do post de teste.')
  await typeInEditor(
    page,
    'Este é o texto do post de teste. Ele serve pra verificar o editor Lexical, o cálculo do tempo de leitura e a publicação com síntese.',
  )
  await pickRelationship(page, 'field-category', `Opinião ${run}`)
  await pickRelationship(page, 'field-tags', `Inteligência Artificial ${run}`)
  await shot(page, 'p2-07-post-conteudo')

  // Publicar sem síntese é recusado. (Repete o clique se cair durante um autosave.)
  await expect(async () => {
    await page.click('#action-save')
    await expect(
      page.locator('.tabs-field__tab-button--has-error', { hasText: 'Síntese' }),
    ).toBeVisible({ timeout: 4_000 })
  }).toPass({ timeout: 45_000 })
  await shot(page, 'p2-08-post-erro-sem-sintese')

  await page
    .getByRole('tab', { name: 'Síntese' })
    .or(page.locator('button', { hasText: 'Síntese' }))
    .first()
    .click()
  await page.fill(
    '#field-summary',
    'Post de teste do passo 2: verifica o editor, a síntese obrigatória, os pontos-chave, a categoria e as tags, e o cálculo automático de palavras e tempo de leitura ao publicar.',
  )
  for (const [i, text] of [
    'Síntese obrigatória pra publicar.',
    'De 3 a 5 pontos-chave.',
    'Tempo de leitura calculado no hook.',
  ].entries()) {
    await page
      .locator('#field-keyPoints')
      .getByRole('button', { name: /Adicionar/i })
      .last()
      .click()
    await page.fill(`#field-keyPoints__${i}__text`, text)
  }
  await shot(page, 'p2-09-post-sintese')

  await expect(async () => {
    await page.click('#action-save')
    await expect(page.locator('#field-readingTime')).toHaveValue('1', { timeout: 5_000 })
  }).toPass({ timeout: 45_000 })
  await expectSaved(page, 'posts')
  await expect(page.locator('#field-slug')).toHaveValue(`meu-primeiro-post-${run}`)
  // Recarrega: confere que ficou salvo e limpa os avisos da tentativa anterior.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#field-readingTime')).toHaveValue('1')
  await expect(page.locator('#field-wordCount')).not.toHaveValue('0')
  await shot(page, 'p2-10-post-publicado')

  await page.goto('/admin/collections/posts')
  await expect(page.getByText(`Meu primeiro post ${run}`).first()).toBeVisible()
  await shot(page, 'p2-11-lista-posts')
})

test('globals de configuração abrem', async ({ page }) => {
  await page.goto('/admin/globals/site-settings')
  await expect(page.locator('#field-siteName')).toHaveValue('Pronto, Falei!')
  await shot(page, 'p2-12-configuracoes-site')
  await page.goto('/admin/globals/navigation')
  await expect(page.locator('#field-header, [id^="field-header"]').first()).toBeVisible()
  await shot(page, 'p2-13-navegacao')
})
