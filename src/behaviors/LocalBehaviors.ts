import { Intention, LoggerClass } from "../Constants"
import { Configuration, TConfiguration} from "../configuration"
import { InternalEvent } from "../event"
import { PointerEventGrabber } from "../grabber"
import { LoggerManager } from "../logger"
import { IModel, Model, TExport } from "../model"
import { Stroke, TStroke, TPointer } from "../primitive"
import { CanvasRenderer } from "../renderer"
import { DefaultPenStyle, StyleManager, TPenStyle, TTheme } from "../style"
import { TUndoRedoContext, UndoRedoManager } from "../undo-redo"
import { DeferredPromise, PartialDeep } from "../utils"
import { IBehaviors, TBehaviorOptions } from "./IBehaviors"

/**
 * @group Behavior
 */
export class LocalBehaviors implements IBehaviors
{
  name = "LocalBehaviors"
  #logger = LoggerManager.getLogger(LoggerClass.BEHAVIORS)
  #configuration: TConfiguration
  #model: Model

  grabber: PointerEventGrabber
  renderer: CanvasRenderer
  undoRedoManager: UndoRedoManager
  styleManager: StyleManager
  intention: Intention
  internalEvent: InternalEvent

  constructor(options: PartialDeep<TBehaviorOptions>, internalEvent: InternalEvent)
  {
    this.#logger.info("constructor", { options })
    this.internalEvent = internalEvent
    this.#configuration = new Configuration(options?.configuration)
    this.styleManager = new StyleManager(options?.penStyle, options?.theme)

    this.grabber = new PointerEventGrabber(this.#configuration.grabber)
    this.renderer = new CanvasRenderer(this.#configuration.rendering)

    this.intention = Intention.Write
    this.#model = new Model()
    this.undoRedoManager = new UndoRedoManager(this.#configuration["undo-redo"], this.model, internalEvent)
  }

  protected onPointerDown(evt: PointerEvent, point: TPointer): void
  {
    this.#logger.info("onPointerDown", { intention: this.intention, evt, point })
    const { pointerType } = evt
    const style: TPenStyle = Object.assign({}, this.theme?.ink, this.currentPenStyle)
    switch (this.intention) {
      case Intention.Erase: {
        if (this.model.removeStrokesFromPoint(point).length > 0) {
          this.renderer.drawModel(this.model)
        }
        break
      }
      case Intention.Write:
        this.model.initCurrentStroke(point, evt.pointerId, pointerType, style)
        this.drawCurrentStroke()
        break
      default:
        this.#logger.warn("#onPointerDown", `onPointerDown intention unknow: "${ this.intention }"`)
        break
    }
  }

  protected onPointerMove(_evt: PointerEvent, point: TPointer): void
  {
    this.#logger.info("onPointerMove", { intention: this.intention, point })
    switch (this.intention) {
      case Intention.Erase: {
        if (this.model.removeStrokesFromPoint(point).length > 0) {
          this.renderer.drawModel(this.model)
        }
        break
      }
      case Intention.Write:
        this.model.appendToCurrentStroke(point)
        this.drawCurrentStroke()
        break
      default:
        this.#logger.warn("#onPointerMove", `onPointerMove intention unknow: "${ this.intention }"`)
        break
    }
  }

  protected async onPointerUp(_evt: PointerEvent, point: TPointer): Promise<void>
  {
    this.#logger.info("onPointerUp", { intention: this.intention, point })
    switch (this.intention) {
      case Intention.Erase:
        this.model.removeStrokesFromPoint(point)
        if (this.context.stack.at(-1)?.modificationDate !== this.model.modificationDate) {
          await this.updateModelRendering()
        }
        break
      case Intention.Write:
        this.model.endCurrentStroke(point)
        await this.updateModelRendering()
        break
      default:
        this.#logger.warn("#onPointerUp", `onPointerUp intention unknow: "${ this.intention }"`)
        break
    }
  }

  get model(): Model
  {
    return this.#model
  }

  get context(): TUndoRedoContext
  {
    return this.undoRedoManager.context
  }

  get currentPenStyle(): TPenStyle
  {
    return this.styleManager.currentPenStyle
  }

  get penStyle(): TPenStyle
  {
    return this.styleManager.penStyle
  }
  async setPenStyle(penStyle?: TPenStyle | undefined): Promise<void>
  {
    this.#logger.info("setPenStyle", { penStyle })
    this.styleManager.setPenStyle(penStyle)
    return Promise.resolve()
  }

  get penStyleClasses(): string
  {
    return this.styleManager.penStyleClasses
  }
  async setPenStyleClasses(penStyleClasses?: string | undefined): Promise<void>
  {
    this.#logger.info("setPenStyleClasses", { penStyleClasses })
    this.styleManager.setPenStyleClasses(penStyleClasses)
    return Promise.resolve()
  }

  get theme(): TTheme
  {
    return this.styleManager.theme
  }
  async setTheme(theme?: PartialDeep<TTheme>): Promise<void>
  {
    this.#logger.info("setTheme", { theme })
    this.styleManager.setTheme(theme)
    return Promise.resolve()
  }

  get configuration(): TConfiguration
  {
    return this.#configuration
  }

  async init(domElement: HTMLElement): Promise<void>
  {
    this.#logger.info("init", { domElement })
    this.model.width = Math.max(domElement.clientWidth, this.#configuration.rendering.minWidth)
    this.model.height = Math.max(domElement.clientHeight, this.#configuration.rendering.minHeight)
    this.undoRedoManager.updateModelInStack(this.model)

    this.renderer.init(domElement)

    this.grabber.attach(domElement)
    this.grabber.onPointerDown = this.onPointerDown.bind(this)
    this.grabber.onPointerMove = this.onPointerMove.bind(this)
    this.grabber.onPointerUp = this.onPointerUp.bind(this)
    return Promise.resolve()
  }

  drawCurrentStroke(): void
  {
    this.#logger.debug("drawCurrentStroke", { stroke: this.model.currentSymbol })
    this.renderer.drawPendingStroke(this.model.currentSymbol)
  }

  async updateModelRendering(): Promise<IModel>
  {
    this.#logger.info("updateModelRendering")
    this.renderer.drawModel(this.model)
    const deferred = new DeferredPromise<Model>()
    this.undoRedoManager.addModelToStack(this.model)
    deferred.resolve(this.model)
    await deferred.promise
    this.internalEvent.emitExported(this.model.exports as TExport)
    this.#logger.debug("updateModelRendering", this.model.exports)
    return deferred.promise
  }

  async export(): Promise<IModel>
  {
    return this.model
  }

  async convert(): Promise<IModel>
  {
    return this.model
  }

  async importPointEvents(strokes: PartialDeep<TStroke>[]): Promise<IModel>
  {
    const errors: string[] = []
    strokes.forEach((s, strokeIndex) =>
    {
      let flag = true
      const stroke = new Stroke(s.style || DefaultPenStyle, s.pointerId || 1)
      if (s.id) stroke.id = s.id
      if (!s.pointers?.length) {
        errors.push(`stroke ${strokeIndex + 1} has not pointers`)
        flag = false
        return
      }
      s.pointers?.forEach((pp, pIndex) => {
        if (!pp) {
          errors.push(`stroke ${strokeIndex + 1} has no pointer at ${pIndex}`)
          flag = false
          return
        }
        const pointer: TPointer = {
          p: pp.p || 1,
          t: pp.t || pIndex,
          x: 0,
          y: 0
        }
        if (pp?.x == undefined || pp?.x == null) {
          errors.push(`stroke ${strokeIndex + 1} has no x at pointer at ${pIndex}`)
          flag = false
          return
        }
        else {
          pointer.x = pp.x
        }
        if (pp?.y == undefined || pp?.y == null) {
          errors.push(`stroke ${strokeIndex + 1} has no y at pointer at ${pIndex}`)
          flag = false
          return
        }
        else {
          pointer.y = pp.y
        }
        if (flag) {
          stroke.pointers.push(pointer)
        }
      })
      if (flag) {
        this.model.addStroke(stroke)
      }
    })

    if (errors.length) {
      this.internalEvent.emitError( new Error(errors.join("\n")))
    }
    try {
      const newModel = await this.updateModelRendering()
      Object.assign(this.#model, newModel)
      return this.model
    } catch (error) {
      this.internalEvent.emitError(error as Error)
      throw error as Error
    }
  }

  async resize(height: number, width: number): Promise<IModel>
  {
    this.#logger.info("resize", { height, width })
    const deferredResize = new DeferredPromise<Model>()
    this.model.height = height
    this.model.width = width
    this.renderer.resize(this.model)
    deferredResize.resolve(this.model)
    this.#model = await deferredResize.promise
    this.#logger.debug("resize", { model: this.model })
    this.internalEvent.emitExported(this.model.exports as TExport)
    return this.model
  }

  async undo(): Promise<IModel>
  {
    this.#logger.info("undo")
    this.#model = this.undoRedoManager.undo() as Model
    this.renderer.drawModel(this.#model)
    this.undoRedoManager.updateModelInStack(this.#model)
    this.internalEvent.emitExported(this.#model.exports as TExport)
    this.#logger.debug("undo", this.#model)
    return this.#model
  }

  async redo(): Promise<IModel>
  {
    this.#logger.info("redo")
    this.#model = this.undoRedoManager.redo() as Model
    this.renderer.drawModel(this.#model)
    this.undoRedoManager.updateModelInStack(this.#model)
    this.internalEvent.emitExported(this.#model.exports as TExport)
    this.#logger.debug("redo", this.#model)
    return this.#model
  }

  async clear(): Promise<IModel>
  {
    this.#logger.info("clear")
    this.model.clear()
    this.undoRedoManager.addModelToStack(this.model)
    this.renderer.drawModel(this.model)
    this.internalEvent.emitExported(this.model.exports as TExport)
    this.#logger.debug("clear", this.model)
    return this.model
  }

  async destroy(): Promise<void>
  {
    this.#logger.info("destroy")
    this.grabber.detach()
    this.renderer.destroy()
    return Promise.resolve()
  }
}
