import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian2,
  type Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  type Entity,
  HeightReference,
  LabelStyle,
  PolygonHierarchy,
  VerticalOrigin,
} from 'cesium'

import {
  circle,
  curve,
  doubleArrow,
  ellipse,
  filledStraightArrow,
  geographicGeometry,
  isSimpleArea,
  lune,
  openArrow,
  projectGeometry,
  rectangle,
  rotatedRectangle,
  routeArrow,
  sector,
} from './geometry'

export interface PlotStyle {
  strokeColor: string
  strokeWidth: number
  fillColor: string
  fillOpacity: number
  pointSize: number
  textColor?: string
  textSize?: number
}

export const defaultPlotStyle: Readonly<Required<PlotStyle>> = {
  strokeColor: '#65d9ff',
  strokeWidth: 3,
  fillColor: '#65d9ff',
  fillOpacity: 0.28,
  pointSize: 12,
  textColor: '#ffffff',
  textSize: 18,
}

export const plotPointOutline = { color: Color.fromCssColorString('#102740'), width: 2 }

type ReadPoints = () => readonly Cartesian3[]
type PlotGraphics = Pick<
  Entity.ConstructorOptions,
  'position' | 'point' | 'label' | 'polyline' | 'polygon'
>

interface PlotShape {
  kind: 'point' | 'text' | 'line' | 'area'
  minimumPoints: number
  input: 'fixed' | 'vertices' | 'freehand'
  geometry: (points: readonly Cartesian3[]) => readonly Cartesian3[]
}

const identity: PlotShape['geometry'] = (points) => points

function shape(
  kind: PlotShape['kind'],
  minimumPoints: number,
  input: PlotShape['input'],
  planar?: Parameters<typeof projectGeometry>[1],
  projection = geographicGeometry,
): PlotShape {
  return {
    kind,
    minimumPoints,
    input,
    geometry(points) {
      const positions = planar ? projection(points, planar, kind === 'area') : identity(points)
      return kind === 'area' && !isSimpleArea(positions) ? [] : positions
    },
  }
}

export const plotShapes = {
  point: shape('point', 1, 'fixed'),
  text: shape('text', 1, 'fixed'),
  line: shape('line', 2, 'vertices'),
  polygon: shape('area', 3, 'vertices'),
  rectangle: shape('area', 2, 'fixed', rectangle),
  rotatedRectangle: shape('area', 3, 'fixed', rotatedRectangle, projectGeometry),
  triangle: shape('area', 3, 'fixed'),
  circle: shape('area', 2, 'fixed', circle),
  ellipse: shape('area', 2, 'fixed', ellipse),
  sector: shape('area', 3, 'fixed', sector),
  lune: shape('area', 3, 'fixed', lune),
  curve: shape('line', 2, 'vertices', curve),
  freehandLine: shape('line', 2, 'freehand'),
  freehandPolygon: shape('area', 3, 'freehand'),
  straightArrow: shape('line', 2, 'fixed', (points) => openArrow(points, false)),
  curvedArrow: shape('line', 2, 'vertices', (points) => openArrow(points, true)),
  fineArrow: shape('area', 2, 'fixed', (points) => filledStraightArrow(points, false)),
  assaultDirection: shape('area', 2, 'fixed', (points) => filledStraightArrow(points, true)),
  attackArrow: shape('area', 3, 'vertices', (points) => routeArrow(points, true, false)),
  swallowtailAttackArrow: shape('area', 3, 'vertices', (points) => routeArrow(points, true, true)),
  squadCombat: shape('area', 2, 'vertices', (points) => routeArrow(points, false, false)),
  swallowtailSquadCombat: shape('area', 2, 'vertices', (points) => routeArrow(points, false, true)),
  doubleArrow: shape('area', 4, 'fixed', doubleArrow, projectGeometry),
} satisfies Record<string, PlotShape>

export type PlotType = keyof typeof plotShapes

export function canDraw(type: PlotType, points: readonly Cartesian3[]) {
  const shape = plotShapes[type]
  return (
    points.length >= shape.minimumPoints && shape.geometry(points).length >= shape.minimumPoints
  )
}

function property<T>(read: () => T, dynamic: boolean) {
  return dynamic ? new CallbackProperty(read, false) : new ConstantProperty(read())
}

export function createPlotLabel(text: string, style: Readonly<PlotStyle>) {
  return {
    text,
    font: `${style.textSize ?? defaultPlotStyle.textSize}px sans-serif`,
    fillColor: Color.fromCssColorString(style.textColor ?? defaultPlotStyle.textColor),
    outlineColor: plotPointOutline.color,
    outlineWidth: plotPointOutline.width,
    style: LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cartesian2(0, -12),
    verticalOrigin: VerticalOrigin.BOTTOM,
    heightReference: HeightReference.CLAMP_TO_GROUND,
  }
}

export function createPlotGraphics(
  type: PlotType,
  readPoints: ReadPoints,
  style: Readonly<PlotStyle>,
  dynamic: boolean,
  text = '',
): PlotGraphics {
  const shape = plotShapes[type]
  if (shape.kind === 'point' || shape.kind === 'text') {
    const position = () => readPoints()[0]
    const positionProperty = dynamic
      ? new CallbackPositionProperty(position, false)
      : new ConstantPositionProperty(position())
    if (shape.kind === 'text') {
      return { position: positionProperty, label: createPlotLabel(text, style) }
    }
    return {
      position: positionProperty,
      point: {
        color: Color.fromCssColorString(style.strokeColor),
        outlineColor: plotPointOutline.color,
        outlineWidth: plotPointOutline.width,
        pixelSize: style.pointSize,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    }
  }

  const stroke = Color.fromCssColorString(style.strokeColor)
  let lastPoints: readonly Cartesian3[] | undefined
  let fill: PolygonHierarchy | undefined
  let outline: readonly Cartesian3[] = []
  function updateGeometry() {
    const points = readPoints()
    if (points === lastPoints) return
    lastPoints = points
    const geometry = points.length >= shape.minimumPoints ? shape.geometry(points) : []
    const first = geometry[0]
    if (shape.kind === 'area' && first && geometry.length >= 3) {
      fill = new PolygonHierarchy([...geometry])
      outline = [...geometry, first]
    } else {
      fill = undefined
      outline = geometry.length >= 2 ? geometry : points
    }
  }

  const polyline = {
    width: style.strokeWidth,
    material: stroke,
    clampToGround: true,
    positions: property(() => {
      updateGeometry()
      return outline
    }, dynamic),
  }
  if (shape.kind === 'line') return { polyline }

  return {
    polyline,
    polygon: {
      material: Color.fromCssColorString(style.fillColor).withAlpha(style.fillOpacity),
      hierarchy: property(() => {
        updateGeometry()
        return fill
      }, dynamic),
    },
  }
}
