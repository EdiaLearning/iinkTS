import { LoggerClass } from "../../Constants"
import { TRenderingConfiguration } from "../../configuration"
import { LoggerManager } from "../../logger"
import { IModel } from "../../model"
import { Stroke, TSymbol } from "../../primitive"
import { CanvasRendererShape } from "./CanvasRendererShape"
import { CanvasRendererStroke } from "./CanvasRendererStroke"
import { CanvasRendererText } from "./CanvasRendererText"

/**
 * @group Renderer
 */
export class CanvasRenderer
{
  #logger = LoggerManager.getLogger(LoggerClass.RENDERER)
  #transform: {x: number, y: number, zoom: number}
  configuration: TRenderingConfiguration
  strokeRenderer: CanvasRendererStroke
  shapeRenderer: CanvasRendererShape
  textRenderer: CanvasRendererText
  context!: {
    parent: HTMLElement
    renderingCanvas: HTMLCanvasElement
    renderingCanvasContext: CanvasRenderingContext2D
    capturingCanvas: HTMLCanvasElement
    capturingCanvasContext: CanvasRenderingContext2D
  }

  constructor(config: TRenderingConfiguration)
  {
    this.#logger.info("constructor", { config })
    this.configuration = config
    this.strokeRenderer = new CanvasRendererStroke()
    this.shapeRenderer = new CanvasRendererShape()
    this.textRenderer = new CanvasRendererText()
    this.#transform = {x: 0, y: 0, zoom: 1}
  }

  protected createCanvas(type: string): HTMLCanvasElement
  {
    this.#logger.debug("createCanvas", { type })
    const canvas: HTMLCanvasElement = document.createElement("canvas")
    canvas.id = type
    canvas.classList.add(type)
    canvas.classList.add("ms-canvas")
    return canvas
  }

  protected clearCanvas(context: CanvasRenderingContext2D): void
  {
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    context.restore()
  }

  protected resizeContent(): void
  {
    const pixelRatio: number = window.devicePixelRatio
    const elements: HTMLCanvasElement[] = [this.context.renderingCanvas, this.context.capturingCanvas]
    elements.forEach((canvas) =>
    {
      const domElement = canvas.parentNode as HTMLElement
      const width = Math.max(this.configuration.minWidth, domElement.clientWidth)
      const height = Math.max(this.configuration.minHeight, domElement.clientHeight)
      canvas.width = width * pixelRatio
      canvas.height = height * pixelRatio
      canvas.style.width = `${ width }px`
      canvas.style.height = `${ height }px`
    })
    this.applyTransform(this.#transform)
  }

  protected drawSymbol(context2D: CanvasRenderingContext2D, symbol: TSymbol)
  {
    this.#logger.debug("drawSymbol", { symbol })
    if (symbol.type === "stroke") {
      const stroke = symbol as Stroke
      if (stroke.pointerType !== "eraser") {
        this.strokeRenderer.draw(context2D, stroke)
      }
    } else if (Object.keys(this.textRenderer.symbols).includes(symbol.type)) {
      this.textRenderer.draw(context2D, symbol)
    } else if (Object.keys(this.shapeRenderer.symbols).includes(symbol.type)) {
      this.shapeRenderer.draw(context2D, symbol)
    } else {
      this.#logger.warn("drawSymbol", `symbol type unknow: ${symbol.type}`)
    }
  }

  init(element: HTMLElement): void
  {
    this.#logger.info("init", { element })
    const renderingCanvas: HTMLCanvasElement = this.createCanvas("ms-rendering-canvas")
    element.appendChild(renderingCanvas)

    const capturingCanvas: HTMLCanvasElement = this.createCanvas("ms-capture-canvas")
    element.appendChild(capturingCanvas)

    this.context = {
      parent: element,
      renderingCanvas,
      renderingCanvasContext: renderingCanvas.getContext("2d") as CanvasRenderingContext2D,
      capturingCanvas,
      capturingCanvasContext: capturingCanvas.getContext("2d") as CanvasRenderingContext2D
    }

    this.resizeContent()
  }

  drawModel(model: IModel): void
  {
    this.#logger.info("drawModel", { model })
    this.clearCanvas(this.context.renderingCanvasContext)
    model.symbols.forEach(symbol => this.drawSymbol(this.context.renderingCanvasContext, symbol))
    this.clearCanvas(this.context.capturingCanvasContext)
  }

  drawPendingStroke(stroke: Stroke | undefined): void
  {
    this.#logger.info("drawPendingStroke", { stroke })
    this.clearCanvas(this.context.capturingCanvasContext)
    if (stroke && stroke?.pointerType !== "eraser") {
      this.strokeRenderer.draw(this.context.capturingCanvasContext, stroke)
    }
  }

  resize(model: IModel): void
  {
    this.#logger.info("resize", { model })
    this.resizeContent()
    this.drawModel(model)
  }

  applyTransform(transform: {x: number, y: number, zoom: number}): void
  {
    this.#transform = transform
    const x = transform.x * window.devicePixelRatio
    const y = transform.y * window.devicePixelRatio
    const zoom = transform.zoom * window.devicePixelRatio;
    [this.context.renderingCanvasContext, this.context.capturingCanvasContext].forEach(context => {
      context.setTransform(zoom, 0, 0, zoom, x, y)
    })
  }

  destroy(): void
  {
    this.#logger.info("destroy")
    if (this.context.parent) {
      this.context.parent.innerHTML = ""
    }
  }
}
