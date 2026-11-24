import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  Entity,
  HeightReference,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium'

import { PlotPrimitiveRenderer } from './PlotPrimitiveRenderer'
import {
  canDraw,
  createPlotGraphics,
  defaultPlotStyle,
  plotShapes,
  type PlotStyle,
  type PlotType,
} from './shapes'

interface PlotFeature {
  id: string
  order: number
  type: PlotType
  points: Cartesian3[]
  entity: Entity | undefined
  style: PlotStyle
  text: string
}

export type PlotState =
  | { mode: 'idle' }
  | {
      mode: 'drawing'
      type: PlotType
      pointCount: number
      canFinish: boolean
      invalid: boolean
      style: Readonly<PlotStyle>
      text: string
    }
  | { mode: 'editing'; type: PlotType; style: Readonly<PlotStyle>; text: string }
  | { mode: 'deleting' }

const samePoint = (a: Cartesian3, b: Cartesian3) => Cartesian3.equalsEpsilon(a, b, 0, 0.01)
const hasContent = (plot: PlotFeature) => plot.type !== 'text' || plot.text.trim().length > 0
const overlapPickLimit = 8

export class PlotController {
  private readonly handler: ScreenSpaceEventHandler
  private readonly renderer: PlotPrimitiveRenderer
  private readonly plots = new Map<string, PlotFeature>()
  private readonly handles: Entity[] = []
  private latestPlotOrder = 0
  private draft: PlotFeature | undefined
  private selected: PlotFeature | undefined
  private textBeforeEditing = ''
  private preview: Cartesian3[] | undefined
  private lastFreehandPosition: Cartesian2 | undefined
  private rejectedPoint = false
  private deleting = false
  private drag: { index: number; cameraInputsEnabled: boolean } | undefined

  constructor(
    private readonly viewer: Viewer,
    private readonly onStateChange: (state: PlotState) => void = () => {},
  ) {
    this.renderer = new PlotPrimitiveRenderer(viewer.scene)
    this.handler = new ScreenSpaceEventHandler(viewer.canvas)
    this.handler.setInputAction(this.onClick, ScreenSpaceEventType.LEFT_CLICK)
    this.handler.setInputAction(this.onDown, ScreenSpaceEventType.LEFT_DOWN)
    this.handler.setInputAction(this.onMove, ScreenSpaceEventType.MOUSE_MOVE)
    this.handler.setInputAction(this.endDrag, ScreenSpaceEventType.LEFT_UP)
    this.handler.setInputAction(() => {
      if (this.deleting) this.stop()
      else this.finish()
    }, ScreenSpaceEventType.RIGHT_CLICK)
    viewer.canvas.addEventListener('pointercancel', this.endDrag)
    viewer.canvas.ownerDocument.addEventListener('keydown', this.onKeyDown)
    viewer.canvas.ownerDocument.defaultView?.addEventListener('blur', this.endDrag)
  }

  start(type: PlotType, style: Readonly<PlotStyle> = defaultPlotStyle) {
    this.clearInteraction()
    const entity = this.viewer.entities.add(new Entity())
    this.draft = {
      id: entity.id,
      order: 0,
      type,
      entity,
      points: [],
      style: { ...style },
      text: '',
    }
    this.applyShape(this.draft, true)
    this.publishState()
  }

  finish() {
    if (this.draft) {
      if (!hasContent(this.draft) || !canDraw(this.draft.type, this.draft.points)) return
      const plot = this.draft
      this.draft = undefined
      plot.order = ++this.latestPlotOrder
      this.plots.set(plot.id, plot)
      this.completePlot(plot)
    } else if (!this.selected || !hasContent(this.selected)) return

    this.stop()
  }

  undoLastPoint() {
    if (!this.draft?.points.length) return
    this.draft.points = this.draft.points.slice(0, -1)
    const handle = this.handles.pop()
    if (handle) this.viewer.entities.remove(handle)
    if (!this.draft.points.length) this.lastFreehandPosition = undefined
    this.preview = undefined
    this.rejectedPoint = false
    this.publishState()
  }

  startDeleting() {
    this.clearInteraction()
    this.deleting = true
    this.publishState()
  }

  updateStyle(style: Partial<PlotStyle>) {
    const plot = this.draft ?? this.selected
    if (!plot) return
    plot.style = { ...plot.style, ...style }
    this.applyShape(plot, true)
    this.publishState()
  }

  updateText(text: string) {
    const plot = this.draft ?? this.selected
    if (plot?.type !== 'text' || plot.text === text) return
    plot.text = text
    this.applyShape(plot, true)
    this.publishState()
  }

  stop() {
    this.clearInteraction()
    this.publishState()
  }

  destroy() {
    const { canvas } = this.viewer
    canvas.removeEventListener('pointercancel', this.endDrag)
    canvas.ownerDocument.removeEventListener('keydown', this.onKeyDown)
    canvas.ownerDocument.defaultView?.removeEventListener('blur', this.endDrag)
    this.handler.destroy()
    this.clearInteraction(false)
    this.renderer.destroy()
    for (const plot of this.plots.values()) this.removeEntity(plot)
    this.plots.clear()
    this.viewer.scene.requestRender()
  }

  private applyShape(plot: PlotFeature, dynamic: boolean) {
    plot.entity ??= this.viewer.entities.add(new Entity({ id: plot.id }))
    const points = () => (dynamic && plot === this.draft && this.preview) || plot.points
    const text = hasContent(plot) ? plot.text : plot === this.selected ? this.textBeforeEditing : ''
    Object.assign(plot.entity, createPlotGraphics(plot.type, points, plot.style, dynamic, text))
  }

  private completePlot(plot: PlotFeature) {
    this.applyShape(plot, false)
    const entity = plot.entity
    this.renderer.show(plot, () => {
      if (plot.entity === entity && this.selected !== plot) this.removeEntity(plot)
    })
  }

  private removeEntity(plot: PlotFeature) {
    if (!plot.entity) return
    this.viewer.entities.remove(plot.entity)
    plot.entity = undefined
  }

  private clearInteraction(completeSelection = true) {
    this.endDrag()
    for (const handle of this.handles) this.viewer.entities.remove(handle)
    this.handles.length = 0

    if (this.draft) this.removeEntity(this.draft)
    const selected = this.selected
    this.draft = undefined
    this.selected = undefined
    this.preview = undefined
    this.lastFreehandPosition = undefined
    this.rejectedPoint = false
    this.deleting = false
    if (selected && completeSelection) {
      if (!hasContent(selected)) selected.text = this.textBeforeEditing
      this.completePlot(selected)
    }
    this.textBeforeEditing = ''
  }

  private publishState() {
    if (this.draft) {
      const { type, points, style, text } = this.draft
      const validGeometry = canDraw(type, points)
      this.onStateChange({
        mode: 'drawing',
        type,
        pointCount: points.length,
        canFinish: validGeometry && hasContent(this.draft),
        invalid:
          this.rejectedPoint || (points.length >= plotShapes[type].minimumPoints && !validGeometry),
        style,
        text,
      })
    } else if (this.selected) {
      const { type, style, text } = this.selected
      this.onStateChange({ mode: 'editing', type, style, text })
    } else {
      this.onStateChange({ mode: this.deleting ? 'deleting' : 'idle' })
    }
    this.viewer.scene.requestRender()
  }

  private surfacePoint(position: Cartesian2) {
    const { camera, scene } = this.viewer
    const ray = camera.getPickRay(position)
    return ray && scene.globe.pick(ray, scene)
  }

  private pickedId(position: Cartesian2) {
    const picked = this.viewer.scene.pick(position) as { id?: unknown } | undefined
    return picked?.id
  }

  private findPickedPlot(picked: unknown) {
    const id = picked instanceof Entity ? picked.id : picked
    return typeof id === 'string' ? this.plots.get(id) : undefined
  }

  private pickOverlappingPlot(position: Cartesian2, plot: PlotFeature | undefined) {
    if (!plot || this.plots.size < 2 || plot.order === this.latestPlotOrder) return plot
    const kind = plotShapes[plot.type].kind
    if (kind !== 'line' && kind !== 'area') return plot

    // Depth ties between clamped geometries follow the Primitive batches, not creation order.
    const hits = this.viewer.scene.drillPick(position, overlapPickLimit) as { id?: unknown }[]
    let newest = plot
    for (const { id } of hits) {
      const candidate = this.findPickedPlot(id)
      if (!candidate || candidate.order <= newest.order) continue
      const candidateKind = plotShapes[candidate.type].kind
      if (candidateKind === 'line' || candidateKind === 'area') newest = candidate
    }
    return newest
  }

  private addHandle(position: Cartesian3) {
    this.handles.push(
      this.viewer.entities.add({
        position,
        point: {
          pixelSize: 15,
          color: Color.WHITE,
          outlineColor: Color.fromCssColorString('#2463aa'),
          outlineWidth: 3,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      }),
    )
  }

  private onClick: ScreenSpaceEventHandler.PositionedEventCallback = ({ position }) => {
    const draft = this.draft
    if (draft) {
      if (!hasContent(draft)) return
      const point = this.surfacePoint(position)
      if (!point) return
      const { input, minimumPoints } = plotShapes[draft.type]
      const duplicate = draft.points.some((other) => samePoint(other, point))
      if (input === 'freehand') {
        if (!duplicate) draft.points = [...draft.points, point]
        this.lastFreehandPosition = Cartesian2.clone(position)
        if (canDraw(draft.type, draft.points)) this.finish()
        else this.publishState()
        return
      }
      if (duplicate) return

      const points = [...draft.points, point]
      const autoFinish = input === 'fixed' && points.length === minimumPoints
      if (autoFinish && !canDraw(draft.type, points)) {
        this.rejectedPoint = true
        this.publishState()
        return
      }
      this.rejectedPoint = false
      draft.points = points
      this.preview = undefined
      if (autoFinish) this.finish()
      else {
        this.addHandle(point)
        this.publishState()
      }
      return
    }

    const picked = this.pickedId(position)
    if (picked instanceof Entity && this.handles.includes(picked)) return
    const plot = this.pickOverlappingPlot(position, this.findPickedPlot(picked))
    if (this.deleting) {
      if (plot) {
        this.plots.delete(plot.id)
        this.renderer.remove(plot.id)
        this.removeEntity(plot)
        this.viewer.scene.requestRender()
      }
      return
    }
    if (plot === this.selected) return

    this.clearInteraction()
    if (plot) {
      this.selected = plot
      this.textBeforeEditing = plot.text
      this.renderer.hide(plot.id)
      this.applyShape(plot, true)
      for (const point of plot.points) this.addHandle(point)
    }
    this.publishState()
  }

  private onDown: ScreenSpaceEventHandler.PositionedEventCallback = ({ position }) => {
    if (!this.selected || this.drag) return
    const entity = this.pickedId(position)
    let index = entity instanceof Entity ? this.handles.indexOf(entity) : -1
    if (entity === this.selected.entity) {
      const hits = this.viewer.scene.drillPick(position, 2) as { id?: unknown }[]
      index = this.handles.findIndex((handle) => hits.some((hit) => hit.id === handle))
    }
    if (index < 0) return

    const cameraController = this.viewer.scene.screenSpaceCameraController
    this.drag = { index, cameraInputsEnabled: cameraController.enableInputs }
    cameraController.enableInputs = false
  }

  private onMove: ScreenSpaceEventHandler.MotionEventCallback = ({ endPosition }) => {
    if (this.draft) {
      this.moveDraft(this.draft, endPosition)
      return
    }
    if (!this.drag || !this.selected) return
    const { index } = this.drag
    const point = this.surfacePoint(endPosition)
    const handle = this.handles[index]
    if (!point || !handle) return
    if (this.selected.points.some((other) => samePoint(other, point))) return
    const points = [...this.selected.points]
    points[index] = point
    if (!canDraw(this.selected.type, points)) return

    this.selected.points = points
    handle.position = new ConstantPositionProperty(point)
    this.viewer.scene.requestRender()
  }

  private moveDraft(draft: PlotFeature, position: Cartesian2) {
    const last = draft.points.at(-1)
    if (!last && (draft.type !== 'text' || !hasContent(draft))) return
    const point = this.surfacePoint(position)
    const { input } = plotShapes[draft.type]

    if (input === 'freehand') {
      const sample = this.lastFreehandPosition
      if (
        !last ||
        !point ||
        !sample ||
        Cartesian2.distance(sample, position) < 9 ||
        samePoint(last, point)
      )
        return
      const previousCount = draft.points.length
      const points = previousCount < 240 ? draft.points : draft.points.filter((_, i) => i % 2 === 0)
      draft.points = [...points, point]
      this.lastFreehandPosition = Cartesian2.clone(position)
      this.publishState()
      return
    } else {
      this.preview =
        point && !draft.points.some((other) => samePoint(other, point))
          ? [...draft.points, point]
          : undefined
    }
    this.viewer.scene.requestRender()
  }

  private endDrag = () => {
    if (!this.drag) return
    this.viewer.scene.screenSpaceCameraController.enableInputs = this.drag.cameraInputsEnabled
    this.drag = undefined
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (
      !event.defaultPrevented &&
      !event.isComposing &&
      event.key === 'Escape' &&
      (this.draft || this.selected || this.deleting)
    ) {
      this.stop()
    }
  }
}
