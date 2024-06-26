import { EventType, LoggerClass } from "../Constants"
import { LoggerManager } from "../logger"
import { IModel, TExport } from "../model"
import { TUndoRedoContext } from "../undo-redo"

/**
 * @group Event
 */
export class PublicEvent extends EventTarget
{
  #element?: HTMLElement
  #logger = LoggerManager.getLogger(LoggerClass.PUBLIC_EVENT)

  constructor()
  {
    super()
  }

  setElement(el: HTMLElement)
  {
    this.#logger.info("setElement", { el })
    this.#element = el
  }

  #emit(type: string, data?: unknown): void
  {
    const evt = new CustomEvent(type, Object.assign({ bubbles: true, composed: true }, data ? { detail: data } : undefined))
    this.dispatchEvent(evt)
    this.#element?.dispatchEvent(evt)
  }

  emitLoaded(): void
  {
    this.#logger.info("emitLoaded")
    this.#emit(EventType.LOADED)
  }

  emitExported(exports: TExport): void
  {
    this.#logger.info("emitExported", { exports })
    this.#emit(EventType.EXPORTED, exports)
  }

  emitChanged(undoRedoContext: TUndoRedoContext): void
  {
    this.#logger.info("emitChanged", { undoRedoContext })
    this.#emit(EventType.CHANGED, {
      ...undoRedoContext,
      canClear: !undoRedoContext.empty
    })
  }

  emitIdle(idle: boolean): void
  {
    this.#logger.info("emitIdle", { idle })
    this.#emit(EventType.IDLE, idle)
  }

  emitCleared(model?: IModel): void
  {
    this.#logger.info("emitCleared", { model })
    this.#emit(EventType.CLEARED, model)
  }

  emitConverted(exports: TExport): void
  {
    this.#logger.info("emitConverted", { exports })
    this.#emit(EventType.CONVERTED, exports)
  }

  emitImported(exports: TExport): void
  {
    this.#logger.info("emitImported", { exports })
    this.#emit(EventType.IMPORTED, exports)
  }
}
