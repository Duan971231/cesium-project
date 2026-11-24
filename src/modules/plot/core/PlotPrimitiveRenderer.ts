import {
  type Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  GroundPrimitive,
  type Label,
  LabelCollection,
  PerInstanceColorAppearance,
  type PointPrimitive,
  PointPrimitiveCollection,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineColorAppearance,
  PrimitiveCollection,
  type Scene,
  ShowGeometryInstanceAttribute,
} from 'cesium'

import {
  createPlotLabel,
  plotPointOutline,
  plotShapes,
  type PlotStyle,
  type PlotType,
} from './shapes'

interface StaticPlot {
  id: string
  type: PlotType
  points: readonly Cartesian3[]
  style: Readonly<PlotStyle>
  text: string
}

interface BatchItem {
  points: readonly Cartesian3[]
  positions: readonly Cartesian3[]
  area: boolean
  style: Readonly<PlotStyle>
  visible: boolean
  onReady: (() => void) | undefined
}

interface BatchGeometry {
  items: Map<string, BatchItem>
  fill: GroundPrimitive | undefined
  lines: GroundPolylinePrimitive
}

interface Batch {
  items: Map<string, BatchItem>
  active: BatchGeometry | undefined
  pending: BatchGeometry | undefined
  dirty: boolean
}

const batchCapacity = 64
// Label glyphs are queued in one frame, uploaded in the next and available on the third.
const labelUploadFrames = 3

export class PlotPrimitiveRenderer {
  private readonly points = new PointPrimitiveCollection()
  private readonly labels: LabelCollection
  private readonly fills = new PrimitiveCollection()
  private readonly lines = new PrimitiveCollection()
  private readonly pointById = new Map<string, PointPrimitive>()
  private readonly labelById = new Map<string, Label>()
  private readonly pendingLabels = new Map<string, { label: Label; onReady: () => void }>()
  private labelFramesRemaining = 0
  private readonly batchById = new Map<string, Batch>()
  private readonly batches = new Set<Batch>()
  private readonly updates = new Set<Batch>()
  private readonly removePostRender: () => void

  constructor(private readonly scene: Scene) {
    scene.primitives.add(this.points)
    this.labels = scene.primitives.add(new LabelCollection({ scene }))
    scene.groundPrimitives.add(this.fills)
    scene.groundPrimitives.add(this.lines)
    this.removePostRender = scene.postRender.addEventListener(() => this.flush())
  }

  show(plot: StaticPlot, onReady: () => void) {
    const { id, type, points, style, text } = plot
    const kind = plotShapes[type].kind
    if (kind === 'point') {
      const position = points[0]
      if (!position) return
      const point = this.pointById.get(id) ?? this.points.add({ id, position })
      point.position = position
      point.color = Color.fromCssColorString(style.strokeColor)
      point.outlineColor = plotPointOutline.color
      point.outlineWidth = plotPointOutline.width
      point.pixelSize = style.pointSize
      point.show = true
      this.pointById.set(id, point)
      onReady()
      return
    }

    if (kind === 'text') {
      const position = points[0]
      if (!position) return
      const options = { position, ...createPlotLabel(text, style), show: false }
      const label = this.labelById.get(id) ?? this.labels.add({ id, ...options })
      Object.assign(label, options)
      this.labelById.set(id, label)
      this.pendingLabels.set(id, { label, onReady })
      this.labelFramesRemaining = labelUploadFrames
      this.scene.requestRender()
      return
    }

    if (!GroundPolylinePrimitive.isSupported(this.scene)) return
    if (kind === 'area' && !GroundPrimitive.isSupported(this.scene)) return
    let batch = this.batchById.get(id)
    const existing = batch?.items.get(id)
    if (batch && existing && existing.points === points && existing.style === style) {
      existing.visible = true
      if (batch.active?.items.get(id) === existing) {
        this.setVisible(batch.active, id, true)
        onReady()
      } else {
        existing.onReady = onReady
      }
      return
    }

    const positions = plotShapes[type].geometry(points)
    if (positions.length < (kind === 'area' ? 3 : 2)) return
    if (!batch) {
      for (const candidate of this.batches) {
        if (candidate.items.size < batchCapacity) {
          batch = candidate
          break
        }
      }
      if (!batch) {
        batch = { items: new Map(), active: undefined, pending: undefined, dirty: false }
        this.batches.add(batch)
      }
      this.batchById.set(id, batch)
    }
    batch.items.set(id, { points, positions, style, area: kind === 'area', visible: true, onReady })
    this.queue(batch)
  }

  hide(id: string) {
    this.pendingLabels.delete(id)
    const point = this.pointById.get(id)
    if (point) point.show = false
    const label = this.labelById.get(id)
    if (label) label.show = false

    const batch = this.batchById.get(id)
    const item = batch?.items.get(id)
    if (!batch || !item) return
    item.visible = false
    item.onReady = undefined
    if (batch.active?.items.has(id)) this.setVisible(batch.active, id, false)
  }

  remove(id: string) {
    const point = this.pointById.get(id)
    if (point) {
      this.points.remove(point)
      this.pointById.delete(id)
      return
    }
    const label = this.labelById.get(id)
    if (label) {
      this.labels.remove(label)
      this.labelById.delete(id)
      this.pendingLabels.delete(id)
      return
    }

    const batch = this.batchById.get(id)
    if (!batch) return
    this.batchById.delete(id)
    batch.items.delete(id)
    if (!batch.items.size) {
      this.removeGeometry(batch.active)
      this.removeGeometry(batch.pending)
      this.batches.delete(batch)
      this.updates.delete(batch)
      return
    }

    if (batch.active?.items.has(id)) this.setVisible(batch.active, id, false)
    this.queue(batch)
  }

  destroy() {
    this.removePostRender()
    this.scene.primitives.remove(this.points)
    this.scene.primitives.remove(this.labels)
    this.scene.groundPrimitives.remove(this.fills)
    this.scene.groundPrimitives.remove(this.lines)
    this.pointById.clear()
    this.labelById.clear()
    this.pendingLabels.clear()
    this.batchById.clear()
    this.batches.clear()
    this.updates.clear()
  }

  private queue(batch: Batch) {
    batch.dirty = true
    this.updates.add(batch)
    this.scene.requestRender()
  }

  private flush() {
    if (this.pendingLabels.size) {
      if (--this.labelFramesRemaining === 0) {
        for (const [id, { label, onReady }] of this.pendingLabels) {
          this.pendingLabels.delete(id)
          label.show = true
          onReady()
          if (this.labelFramesRemaining > 0) break
        }
      }
      this.scene.requestRender()
    }

    for (const batch of this.updates) {
      const { pending } = batch
      if (pending) {
        if (!pending.lines.ready || (pending.fill && !pending.fill.ready)) continue
        this.removeGeometry(batch.active)
        batch.active = pending
        batch.pending = undefined

        // Stale entries can still finish building after an edit or deletion.
        for (const [id, item] of pending.items) {
          if (batch.items.get(id) !== item || !item.visible) continue
          this.setVisible(pending, id, true)
          item.onReady?.()
          item.onReady = undefined
        }
        this.scene.requestRender()
      }

      if (batch.dirty) {
        batch.pending = this.build(batch.items)
        batch.dirty = false
      } else {
        this.updates.delete(batch)
      }
    }
    if (this.updates.size) this.scene.requestRender()
  }

  private build(liveItems: ReadonlyMap<string, BatchItem>): BatchGeometry {
    const items = new Map(liveItems)
    const fills: GeometryInstance[] = []
    const lines: GeometryInstance[] = []
    for (const [id, { positions, area, style }] of items) {
      lines.push(
        new GeometryInstance({
          id,
          geometry: new GroundPolylineGeometry({
            positions: [...positions],
            loop: area,
            width: style.strokeWidth,
          }),
          attributes: {
            show: new ShowGeometryInstanceAttribute(false),
            color: ColorGeometryInstanceAttribute.fromColor(
              Color.fromCssColorString(style.strokeColor),
            ),
          },
        }),
      )

      if (area) {
        fills.push(
          new GeometryInstance({
            id,
            geometry: new PolygonGeometry({
              polygonHierarchy: new PolygonHierarchy(positions.map((position) => position.clone())),
              vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
            }),
            attributes: {
              show: new ShowGeometryInstanceAttribute(false),
              color: ColorGeometryInstanceAttribute.fromColor(
                Color.fromCssColorString(style.fillColor).withAlpha(style.fillOpacity),
              ),
            },
          }),
        )
      }
    }

    return {
      items,
      fill: fills.length
        ? this.fills.add(
            new GroundPrimitive({
              geometryInstances: fills,
              appearance: new PerInstanceColorAppearance({ flat: true }),
            }),
          )
        : undefined,
      lines: this.lines.add(
        new GroundPolylinePrimitive({
          geometryInstances: lines,
          appearance: new PolylineColorAppearance(),
        }),
      ),
    }
  }

  private setVisible(geometry: BatchGeometry, id: string, visible: boolean) {
    const attrs = geometry.lines.getGeometryInstanceAttributes(id)
    if (attrs) attrs.show = ShowGeometryInstanceAttribute.toValue(visible)
    if (geometry.items.get(id)?.area) {
      const fillAttrs = geometry.fill?.getGeometryInstanceAttributes(id)
      if (fillAttrs) fillAttrs.show = ShowGeometryInstanceAttribute.toValue(visible)
    }
  }

  private removeGeometry(geometry: BatchGeometry | undefined) {
    if (!geometry) return
    this.lines.remove(geometry.lines)
    if (geometry.fill) this.fills.remove(geometry.fill)
  }
}
