const {
    waitForEditorRest,
    waitEditorLoaded,
    getDatasFromExportedEvent,
    write
  } = require('../helper')
  const { h } = require('../strokesDatas')

  describe('Rest customize stroke', () => {
  
    beforeAll(async () => {
      await page.goto('/examples/rest/rest_text_iink_customize_stroke_style.html')
    })

    beforeEach(async () => {
      await page.reload({ waitUntil: 'load' })
      await waitForEditorRest(page)
    })
    
    test('should have title', async () => {
      const title = await page.title()
      expect(title).toMatch('Rest Text Styling')
    })
  
    test('should display text/plain into result', async () => {
      const [exportedDatas] = await Promise.all([
        getDatasFromExportedEvent(page),
        write(page, h.strokes),
      ])
      const resultText = await page.locator('#result').textContent()
      expect(resultText).toStrictEqual(exportedDatas['text/plain'])
      expect(resultText).toStrictEqual(h.exports['text/plain'].at(-1))
    })

    test('should change language', async () => {
      const [exportedDatas] = await Promise.all([
        getDatasFromExportedEvent(page),
        write(page, h.strokes),
      ])

      const resultText = await page.locator('#result').textContent()
      expect(resultText).toStrictEqual(exportedDatas['text/plain'])
      expect(resultText).toStrictEqual(h.exports['text/plain'].at(-1))

      await Promise.all([
        waitEditorLoaded(page),
        page.selectOption('#language', 'fr_FR'),
      ])

      expect(await page.locator('#result').textContent()).toBe('')
    })
   
    test('should draw stroke with penStyleEnabled', async () => {
      await page.click('#penenabled')
  
      const [exportedDatas] = await Promise.all([
        getDatasFromExportedEvent(page),
        write(page, h.strokes),
      ])
      const resultText = await page.locator('#result').textContent()
      expect(resultText).toStrictEqual(exportedDatas['text/plain'])
      expect(resultText).toStrictEqual(h.exports['text/plain'].at(-1))
  
    })
  
    test('should draw stroke with different color and width of ink', async () => {
      await page.click('#penenabled')
      const colorLocator = await page.locator('#pencolor')
      await colorLocator.fill('#1a5fb4')
      const widthLocator = await page.locator('#penwidth')
      await widthLocator.fill('5')
  
      const [exportedDatas] = await Promise.all([
        getDatasFromExportedEvent(page),
        write(page, h.strokes),
      ])
      const style = await page.evaluate('editor.behaviors.styleManager.penStyle')
      expect(style).toEqual({ color: '#1a5fb4', "-myscript-pen-width": '5' })

      const resultText = await page.locator('#result').textContent()
      expect(resultText).toStrictEqual(exportedDatas['text/plain'])
      expect(resultText).toStrictEqual(h.exports['text/plain'].at(-1))
  
    })
  
    test('should draw stroke with default penStyle', async () => {
      expect(await page.locator('#pencolor').isDisabled()).toEqual(true)
      expect(await page.locator('#penwidth').isDisabled()).toEqual(true)
      await page.setChecked('#penenabled', true)
      expect(await page.locator('#pencolor').isDisabled()).toEqual(false)
      expect(await page.locator('#penwidth').isDisabled()).toEqual(false)
  
      await Promise.all([
        getDatasFromExportedEvent(page),
        write(page, h.strokes),
      ])
  
      await page.setChecked('#penenabled', false)
      expect(await page.locator('#pencolor').isDisabled()).toEqual(true)
      expect(await page.locator('#penwidth').isDisabled()).toEqual(true)
    })
  })
  