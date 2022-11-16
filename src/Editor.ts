import { TConfiguration, TConfigurationClient } from "./@types/Configuration"
import { TEditorOptions } from "./@types/Editor"
import { IGrabber } from "./@types/grabber/Grabber"
import { IModel, TExport, TJIIXExport } from "./@types/model/Model"
import { TPoint } from "./@types/renderer/Point"
import { TPenStyle } from "./@types/style/PenStyle"
import { TTheme } from "./@types/style/Theme"

import { EventType } from "./Constants"
import { BehaviorsManager } from "./behaviors/BehaviorsManager"
import { Configuration } from "./configuration/Configuration"
import { GlobalEvent } from "./event/GlobalEvent"
import { Model } from "./model/Model"
import { StyleManager } from "./style/StyleManager"
import { SmartGuide } from "./smartguide/SmartGuide"

import './iink.css'
import { IBehaviors } from "./@types/Behaviors"
import { TConverstionState } from "./@types/configuration/RecognitionConfiguration"
import { TMarginConfiguration } from "./@types/configuration/recognition/MarginConfiguration"

export enum EditorMode
{
  Mouse = 'mouse',
  Pen = 'pen',
  Touche = 'touch',
  Eraser = 'eraser'
}

export type HTMLEditorElement = HTMLElement &
{
  editor: Editor
}

export class Editor
{
  wrapperHTML: HTMLEditorElement
  #loaderHTML: HTMLDivElement
  #messageHTML: HTMLDivElement
  #configuration: Configuration
  #behaviorsManager: BehaviorsManager
  #styleManager: StyleManager
  #smartGuide: SmartGuide
  #mode: EditorMode
  #initialized = false

  model: IModel
  debug = false

  constructor(wrapperHTML: HTMLElement, options?: TEditorOptions)
  {
    this.wrapperHTML = wrapperHTML as HTMLEditorElement
    this.wrapperHTML.classList.add(options?.globalClassCss || 'ms-editor')

    this.#loaderHTML = document.createElement('div')
    this.#loaderHTML.classList.add('loader')
    this.#loaderHTML = this.wrapperHTML.appendChild(this.#loaderHTML)
    this.#loaderHTML.style.display = 'initial'

    this.#messageHTML = document.createElement('div')
    this.#messageHTML.classList.add('message')
    this.#messageHTML = this.wrapperHTML.appendChild(this.#messageHTML)
    this.#messageHTML.style.display = 'none'

    this.#mode = EditorMode.Pen

    this.#styleManager = new StyleManager(options?.penStyle, options?.theme)

    this.#configuration = new Configuration(options?.configuration)

    this.#smartGuide = new SmartGuide()

    const width = Math.max(this.wrapperHTML.clientWidth, this.configuration.rendering.minWidth)
    const height = Math.max(this.wrapperHTML.clientHeight, this.configuration.rendering.minHeight)
    this.model = new Model(width, height)

    this.#behaviorsManager = new BehaviorsManager(this.configuration, this.model, options?.behaviors)

    this.#initializeSmartGuide()
    this.#initalizeBehaviors()
  }

  get initialized(): boolean
  {
    return this.#initialized
  }

  get configuration(): TConfiguration
  {
    return this.#configuration
  }

  set configuration(config: TConfigurationClient)
  {
    this.model.clear()
    this.#configuration.overrideDefaultConfiguration(config)

    this.model.height = Math.max(this.wrapperHTML.clientHeight, this.#configuration.rendering.minHeight)
    this.model.width = Math.max(this.wrapperHTML.clientWidth, this.#configuration.rendering.minWidth)

    this.#initializeSmartGuide()

    this.#behaviorsManager.overrideDefaultBehaviors(this.#configuration, this.model)
    this.#initalizeBehaviors()
  }

  get mode(): EditorMode
  {
    return this.#mode
  }

  get events(): GlobalEvent
  {
    return GlobalEvent.getInstance()
  }

  get #behaviors(): IBehaviors
  {
    return this.#behaviorsManager.behaviors
  }

  get #grabber(): IGrabber
  {
    return this.#behaviorsManager.behaviors.grabber
  }

  get #theme(): TTheme
  {
    return this.#styleManager.theme
  }

  get #penStyle(): TPenStyle
  {
    return this.#styleManager.penStyle
  }

  #initializeSmartGuide(): void
  {
    if (this.configuration.rendering.smartGuide.enable) {
      let margin
      switch (this.configuration.recognition.type) {
        case "TEXT":
          margin = this.configuration.recognition.text.margin
          break
        case "MATH":
          margin = this.configuration.recognition.math.margin
          break
        default:
          margin = {
            top: 20,
            left: 10,
            right: 10,
            bottom: 10
          }
          break
      }
      this.#smartGuide.init(this.wrapperHTML, margin as TMarginConfiguration, this.configuration.rendering)
    } else {
      this.#smartGuide.clear()
    }
  }

  #initalizeBehaviors(): void
  {
    this.#behaviorsManager.init(this.wrapperHTML)
      .then(async () =>
      {
        this.#addListeners()
        this.#initialized = true
        this.wrapperHTML.editor = this
        this.events.emitLoaded()
      })
      .catch((e: Error) =>
      {
        this.#initialized = false
        this.#showError(e)
        this.events.emitError(e)
      })
      .finally(() =>
      {
        this.#loaderHTML.style.display = 'none'
      })
  }

  #showError(err: Error)
  {
    this.#messageHTML.style.display = 'initial'
    this.#messageHTML.classList.add('error-msg')
    this.#messageHTML.classList.remove('info-msg')
    this.#messageHTML.innerText = err.message
    if (this.debug) {
      const pName = document.createElement('p')
      pName.innerHTML = err.name
      this.#messageHTML.prepend(pName)

      const pStack = document.createElement('p')
      pStack.style.width = '50vw'
      pStack.style.marginLeft = 'calc(-25vw + 100px)'
      pStack.innerHTML = err.stack || ''
      this.#messageHTML.appendChild(pStack)
    }
  }

  #showNotif(message: string, timeout = 1000)
  {
    console.log('timeout: ', timeout);
    this.#messageHTML.style.display = 'initial'
    this.#messageHTML.classList.add('info-msg')
    this.#messageHTML.classList.remove('error-msg')
    this.#messageHTML.innerText = message
    setTimeout(() => {
      this.#messageHTML.style.display = 'none'
    }, timeout)
  }

  #addListeners(): void
  {
    this.#grabber.onPointerDown = (evt: PointerEvent, point: TPoint) => this.#onPointerDown(evt, point)
    this.#grabber.onPointerMove = (evt: PointerEvent, point: TPoint) => this.#onPointerMove(evt, point)
    this.#grabber.onPointerUp = (evt: PointerEvent, point: TPoint) => this.#onPointerUp(evt, point)

    this.events.addEventListener(EventType.CONVERT, () => this.convert({ conversionState: "DIGITAL_EDIT" }))
    this.events.addEventListener(EventType.CLEAR, () => this.clear())
    this.events.addEventListener(EventType.ERROR, (evt: Event) => this.#onError(evt))
    this.events.addEventListener(EventType.IMPORT, (evt: Event) => this.#onImport(evt))
    this.events.addEventListener(EventType.EXPORTED, (evt: Event) => this.#onExport(evt))
    this.events.addEventListener(EventType.NOTIF, (evt: Event) => this.#onNotif(evt))
  }

  #onNotif(evt: Event): void
  {
    const payload = (evt as CustomEvent).detail as { message: string, timeout: number }
    this.#showNotif(payload.message, payload.timeout)
  }


  #onExport(evt: Event): void
  {
    if (this.configuration.rendering.smartGuide.enable) {
      const exports = (evt as CustomEvent).detail as TExport
      if (exports['application/vnd.myscript.jiix']) {
        const jjix = (exports['application/vnd.myscript.jiix'] as unknown) as string
        this.#smartGuide.update(JSON.parse(jjix))
      }
    }
  }

  #onImport(evt: Event): void
  {
    const customEvent = evt as CustomEvent
    const jiix: string = customEvent.detail.jiix
    const mimeType: string = customEvent.detail.mimeType
    this.import(new Blob([JSON.stringify(jiix)], { type: mimeType }), mimeType)
  }

  #onError(evt: Event)
  {
    const customEvent = evt as CustomEvent
    const err = customEvent?.detail as Error
    this.#showError(err)
  }

  #onPointerDown(evt: PointerEvent, point: TPoint): void
  {
    const target: Element = (evt.target as Element)
    const pointerDownOnEditor = target?.id === this.wrapperHTML.id || target?.classList?.contains('ms-canvas')
    if (pointerDownOnEditor) {
      let { pointerType } = evt
      if (this.#mode === EditorMode.Eraser) {
        pointerType = EditorMode.Eraser
      }
      const style: TPenStyle = Object.assign({}, this.#theme?.ink, this.#penStyle)
      this.model.initCurrentStroke(point, evt.pointerId, pointerType, style)
      this.#behaviors.drawCurrentStroke(this.model)
    }
  }

  #onPointerMove(_evt: PointerEvent, point: TPoint): void
  {
    this.model.appendToCurrentStroke(point)
    this.#behaviors.drawCurrentStroke(this.model)
  }

  #onPointerUp(_evt: PointerEvent, point: TPoint): void
  {
    this.model.endCurrentStroke(point, this.#penStyle)
    this.#behaviors.updateModelRendering(this.model)
      .then(model => this.model = model)
      .catch(error => this.#showError(error as Error))
  }

  setMode(mode: EditorMode): void
  {
    this.#mode = mode
    if (this.#mode === EditorMode.Eraser) {
      this.wrapperHTML.classList.add('erasing')
    } else {
      document.body.style.cursor = 'initial'
      this.wrapperHTML.classList.remove('erasing')
    }
  }

  async undo(): Promise<IModel>
  {
    this.model = await this.#behaviors.undo()
    return this.model
  }

  async redo(): Promise<IModel>
  {
    this.model = await this.#behaviors.redo()
    return this.model
  }

  async clear(): Promise<IModel>
  {
    this.model = await this.#behaviors.clear(this.model)
    return this.model
  }

  async resize(): Promise<IModel>
  {
    this.#smartGuide.resize()
    this.model.height = Math.max(this.wrapperHTML.clientHeight, this.configuration.rendering.minHeight)
    this.model.width = Math.max(this.wrapperHTML.clientWidth, this.configuration.rendering.minWidth)
    this.model = await this.#behaviors.resize(this.model)
    return this.model
  }

  async export(mimeTypes: string[]): Promise<IModel>
  {
    this.model = await this.#behaviors.export(this.model, mimeTypes)
    this.events.emitExported(this.model.exports as TExport)
    return this.model
  }

  async convert(params?: { conversionState?: TConverstionState, mimeTypes?: string[] }): Promise<IModel | never>
  {
    this.model = await this.#behaviors.convert(this.model, params?.conversionState, params?.mimeTypes)
    this.events.emitConverted(this.model.converts as TExport)
    return this.model
  }

  async import(data: Blob, mimeType?: string): Promise<IModel | never>
  {
    if (this.#behaviors.import) {
      this.model = await this.#behaviors.import(this.model, data, mimeType)
      this.events.emitImported(this.model.exports?.["application/vnd.myscript.jiix"] as TJIIXExport)
      return this.model
    }
    return Promise.reject('Import impossible, behaviors has no import function')
  }
}
