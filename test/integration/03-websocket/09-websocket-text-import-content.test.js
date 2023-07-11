const { testGesture } = require('../_partials/gesture-test')
const { waitForEditorWebSocket, write, getExportedDatas } = require('../helper')
const { h } = require('../strokesDatas')

describe('Websocket Text', () => {
  beforeAll(async () => {
    await page.goto('/examples/websocket/websocket_text_import_content.html')
  })

  beforeEach(async () => {
    await page.reload({ waitUntil: 'networkidle'})
    await waitForEditorWebSocket(page)
    await page.waitForTimeout(1000)
  })

  test('should have title', async () => {
    const title = await page.title()
    expect(title).toMatch('Import')
  })

  test('should export application/vnd.myscript.jiix', async () => {
    const [exports] = await Promise.all([
      getExportedDatas(page),
      write(page, h.strokes),
    ])
    const jiixExpected = h.exports['application/vnd.myscript.jiix']
    const jiixReceived = JSON.parse(exports['application/vnd.myscript.jiix'])
    expect(jiixReceived).toStrictEqual(jiixExpected)
  })

  test('should import text hello', async () => {
    await Promise.all([
        page.locator("#importContentField").fill("hello"),
        page.locator("#importContent").click(),
        getExportedDatas(page),
    ])

    const prompterText = await page.waitForSelector('.prompter-text')
    const textContent = await prompterText.evaluate((node) => node.textContent)
    expect(textContent).toEqual("hello")
  })

  test('should import text pony', async () => {
    await Promise.all([
        page.locator("#importContentField").fill("pony"),
        page.locator("#importContent").click(),
        getExportedDatas(page),
    ])

    const prompterText = await page.waitForSelector('.prompter-text')
    const textContent = await prompterText.evaluate((node) => node.textContent)
    expect(textContent).toEqual("pony")
  })

  require('../_partials/smart-guide-test')

  testGesture(-100)
})