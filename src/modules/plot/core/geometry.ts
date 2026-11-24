import { Cartesian3, Cartographic, Math as CesiumMath } from 'cesium'

type XY = readonly [number, number]
type Geometry = (points: readonly XY[]) => readonly XY[]

const turn = 2 * Math.PI
const earthRadius = 6_378_137
const minimumSpan = 1e-7

const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]]
const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]]
const scale = (p: XY, n: number): XY => [p[0] * n, p[1] * n]
const length = (p: XY) => Math.hypot(...p)
const dist = (a: XY, b: XY) => length(sub(a, b))
const unit = (p: XY): XY => scale(p, 1 / (length(p) || 1))
const normal = (p: XY): XY => [-p[1], p[0]]
const mix = (a: XY, b: XY, t: number): XY => add(a, scale(sub(b, a), t))
const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0]
const dot = (a: XY, b: XY) => a[0] * b[0] + a[1] * b[1]
const angle = (p: XY) => Math.atan2(p[1], p[0])
const positiveAngle = (radians: number) => (radians + turn) % turn

function geographicPoints(points: readonly Cartesian3[]): XY[] {
  let previousLongitude: number | undefined
  return points.map((point) => {
    const { longitude, latitude } = Cartographic.fromCartesian(point)
    previousLongitude =
      previousLongitude === undefined
        ? longitude
        : previousLongitude + CesiumMath.negativePiToPi(longitude - previousLongitude)
    return [CesiumMath.toDegrees(previousLongitude), CesiumMath.toDegrees(latitude)]
  })
}

export function geographicGeometry(
  points: readonly Cartesian3[],
  create: Geometry,
  polarFallback = false,
) {
  const outline = create(geographicPoints(points))
  if (
    !outline.every(
      ([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude),
    )
  ) {
    return []
  }
  if (outline.some(([, latitude]) => Math.abs(latitude) > 90)) {
    return polarFallback ? projectGeometry(points, create) : []
  }
  return outline.map(([longitude, latitude]) => Cartesian3.fromDegrees(longitude, latitude))
}

// Azimuthal equidistant projection centered on the first control point.
export function projectGeometry(points: readonly Cartesian3[], create: Geometry) {
  const first = points[0]
  if (!first) return []
  const origin = Cartographic.fromCartesian(first)
  const sinLat = Math.sin(origin.latitude)
  const cosLat = Math.cos(origin.latitude)

  const local = points.map((point): XY => {
    const { latitude, longitude } = Cartographic.fromCartesian(point)
    const delta = longitude - origin.longitude
    const east = Math.cos(latitude) * Math.sin(delta)
    const north = cosLat * Math.sin(latitude) - sinLat * Math.cos(latitude) * Math.cos(delta)
    const up = sinLat * Math.sin(latitude) + cosLat * Math.cos(latitude) * Math.cos(delta)
    const radius = Math.atan2(Math.hypot(east, north), up) * earthRadius
    return scale(unit([east, north]), radius)
  })

  return create(local).map((p) => {
    const radians = Math.min(length(p) / earthRadius, Math.PI)
    const [east, north] = unit(p)
    const sin = Math.sin(radians)
    const cos = Math.cos(radians)
    const latitude = Math.asin(Math.max(-1, Math.min(1, cos * sinLat + north * sin * cosLat)))
    const longitude = origin.longitude + Math.atan2(east * sin, cos * cosLat - north * sin * sinLat)
    return Cartesian3.fromRadians(longitude, latitude)
  })
}

function arc(center: XY, radiusX: number, radiusY: number, start: number, sweep: number) {
  const segments = 100
  const closed = Math.abs(sweep) === turn
  return Array.from({ length: segments + Number(!closed) }, (_, i): XY => {
    const radians = start + (i / segments) * sweep
    return add(center, [radiusX * Math.cos(radians), radiusY * Math.sin(radians)])
  })
}

export const rectangle: Geometry = ([a, b]) =>
  a && b && Math.abs(a[0] - b[0]) > minimumSpan && Math.abs(a[1] - b[1]) > minimumSpan
    ? [a, [b[0], a[1]], b, [a[0], b[1]]]
    : []

// The local projection supplies coordinates in metres.
export const rotatedRectangle: Geometry = ([start, end, side]) => {
  if (!start || !end || !side || dist(start, end) <= 0.01) return []

  const perpendicular = normal(unit(sub(end, start)))
  const width = dot(sub(side, start), perpendicular)
  if (Math.abs(width) <= 0.01) return []

  const offset = scale(perpendicular, width)
  return [start, end, add(end, offset), add(start, offset)]
}

export const ellipse: Geometry = ([a, b]) => {
  if (!a || !b) return []
  const [x, y] = sub(a, b)
  return Math.abs(x) > minimumSpan && Math.abs(y) > minimumSpan
    ? arc(mix(a, b, 0.5), Math.abs(x) / 2, Math.abs(y) / 2, 0, turn)
    : []
}

export const circle: Geometry = ([center, edge]) => {
  if (!center || !edge) return []
  const radius = dist(center, edge)
  return radius > minimumSpan ? arc(center, radius, radius, 0, turn) : []
}

export const sector: Geometry = ([center, a, b]) => {
  if (!center || !a || !b) return []
  const radius = dist(center, a)
  const start = angle(sub(a, center))
  const sweep = positiveAngle(angle(sub(b, center)) - start)
  if (
    dist(center, b) <= minimumSpan ||
    radius <= minimumSpan ||
    sweep <= 1e-6 ||
    turn - sweep <= 1e-6
  )
    return []
  return [center, ...arc(center, radius, radius, start, sweep)]
}

export const lune: Geometry = ([a, b, through]) => {
  if (!a || !b || !through) return []
  const u = sub(b, a)
  const v = sub(through, a)
  const determinant = 2 * cross(u, v)
  if (Math.abs(determinant) <= length(u) * length(v) * 1e-5) return []
  const center = add(
    a,
    scale(sub(scale(normal(u), dot(v, v)), scale(normal(v), dot(u, u))), 1 / determinant),
  )
  const radius = dist(center, a)
  const start = angle(sub(a, center))
  const end = positiveAngle(angle(sub(b, center)) - start)
  const middle = positiveAngle(angle(sub(through, center)) - start)
  return arc(center, radius, radius, start, middle <= end ? end : end - turn)
}

function endpointControl(end: XY, middle: XY, next: XY) {
  const bisector = add(unit(sub(end, middle)), unit(sub(next, middle)))
  return length(bisector) <= 1e-4 ? mix(end, middle, 0.3) : end
}

// Bisector-based cubic interpolation matches the reference curve through its anchors.
export const curve: Geometry = (points) => {
  if (points.length < 3) return points
  const controls = [endpointControl(points[0]!, points[1]!, points[2]!)]
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i]!
    const incoming = sub(current, points[i - 1]!)
    const outgoing = sub(points[i + 1]!, current)
    const bisector = add(unit(scale(incoming, -1)), unit(outgoing))
    if (length(bisector) <= 1e-4) {
      controls.push(sub(current, scale(incoming, 0.3)), add(current, scale(outgoing, 0.3)))
      continue
    }
    const tangent = scale(normal(unit(bisector)), cross(incoming, outgoing) > 0 ? -1 : 1)
    controls.push(
      sub(current, scale(tangent, length(incoming) * 0.3)),
      add(current, scale(tangent, length(outgoing) * 0.3)),
    )
  }
  controls.push(endpointControl(points.at(-1)!, points.at(-2)!, points.at(-3)!))

  const result: XY[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const segment = [points[i]!, controls[2 * i]!, controls[2 * i + 1]!, points[i + 1]!]
    result.push(...sampleBezier(segment, 100).slice(0, -1))
  }
  return [...result, points.at(-1)!]
}

function routeLength(points: readonly XY[]) {
  return points.slice(1).reduce((sum, point, i) => sum + dist(point, points[i]!), 0)
}

export function openArrow(points: readonly XY[], curved: boolean) {
  const path = curved ? curve(points) : points
  const tip = path.at(-1)
  const previous = path.at(-2)
  if (!tip || !previous) return path
  const direction = unit(sub(tip, previous))
  const size = routeLength(points) * 0.1
  const base = sub(tip, scale(direction, size * Math.cos(Math.PI / 6)))
  const wing = scale(normal(direction), size * 0.5)
  return [...path, add(base, wing), tip, sub(base, wing)]
}

export function filledStraightArrow([start, tip]: readonly XY[], wideHead: boolean) {
  if (!start || !tip) return []
  const size = dist(start, tip) ** 0.99 * (wideHead ? 1.5 : 1)
  const forward = unit(sub(tip, start))
  const sideways = normal(forward)
  const fromTip = (radians: number, radius: number, side: number) =>
    add(
      tip,
      add(
        scale(forward, -size * radius * Math.cos(radians)),
        scale(sideways, side * size * radius * Math.sin(radians)),
      ),
    )
  const headAngle = wideHead ? Math.PI / 4 : Math.PI / 8.5
  const neckAngle = wideHead ? Math.PI * 0.17741 : Math.PI / 13
  const headSize = wideHead ? 0.13 : 0.25
  const neckSize = wideHead ? 0.1 : 0.2
  const tail = scale(sideways, size * (wideHead ? 0.08 : 0.1))
  return [
    add(start, tail),
    fromTip(neckAngle, neckSize, 1),
    fromTip(headAngle, headSize, 1),
    tip,
    fromTip(headAngle, headSize, -1),
    fromTip(neckAngle, neckSize, -1),
    sub(start, tail),
  ]
}

function quadraticSpline(points: readonly XY[]): XY[] {
  if (points.length <= 2) return [...points]
  const result = [points[0]!]
  for (let i = 0; i < points.length - 2; i++) {
    const [a, b, c] = [points[i]!, points[i + 1]!, points[i + 2]!]
    for (let j = 0; j < 20; j++) {
      const t = j / 20
      const t2 = t * t
      result.push(add(add(scale(a, (1 - t) ** 2 / 2), scale(b, 0.5 + t - t2)), scale(c, t2 / 2)))
    }
  }
  result.push(points.at(-1)!)
  return result
}

function arrowSides(
  path: readonly XY[],
  left: XY,
  right: XY,
  halfWidth: number,
  limitCorners: boolean,
) {
  const previous = path.at(-2)!
  const tip = path.at(-1)!
  const heading = unit(sub(tip, previous))
  const sideways = normal(heading)
  const total = routeLength(path)
  const finalSegmentLength = dist(tip, previous)
  const referenceScale = Math.min(total ** 0.99 * 0.18, dist(left, right) * 0.8)
  const headScale = limitCorners
    ? Math.min(referenceScale, finalSegmentLength * 0.65)
    : referenceScale
  const headLength = Math.min(headScale, finalSegmentLength)
  if (headLength <= minimumSpan) return undefined

  const headBase = add(tip, scale(heading, -headLength))
  const neck = add(tip, scale(heading, -headLength * 0.85))
  const wings = scale(sideways, headScale * 0.3)
  const neckWidth = headScale * 0.15
  const leftBank: XY[] = [left]
  const rightBank: XY[] = [right]
  let traveled = 0

  for (let i = 1; i < path.length - 1; i++) {
    const vertex = path[i]!
    const before = path[i - 1]!
    const after = path[i + 1]!
    const incomingLength = dist(vertex, before)
    const outgoingLength = dist(after, vertex)
    traveled += incomingLength
    const incoming = unit(sub(vertex, before))
    const outgoing = unit(sub(after, vertex))
    const bisector = unit(add(normal(incoming), normal(outgoing)))
    const miter = dot(bisector, normal(incoming))
    if (miter <= 1e-6) return undefined
    const width = halfWidth + (neckWidth - halfWidth) * (traveled / total)
    const offsetDistance = limitCorners
      ? Math.min(width / miter, Math.min(incomingLength, outgoingLength) * 0.45)
      : width / miter
    const offset = scale(bisector, offsetDistance)
    leftBank.push(add(vertex, offset))
    rightBank.push(sub(vertex, offset))
  }
  leftBank.push(add(neck, scale(sideways, neckWidth)))
  rightBank.push(sub(neck, scale(sideways, neckWidth)))
  return {
    left: quadraticSpline(leftBank),
    right: quadraticSpline(rightBank),
    head: [add(headBase, wings), tip, sub(headBase, wings)],
  }
}

export function routeArrow(points: readonly XY[], explicitTail: boolean, swallowtail: boolean) {
  const a = points[0]
  const b = points[1]
  if (!a || !b) return []
  const start = explicitTail ? mix(a, b, 0.5) : a
  const path = explicitTail ? [start, ...points.slice(2)] : points
  const next = path[1]
  if (!next || dist(start, next) <= minimumSpan) return []

  const heading = unit(sub(next, start))
  const size = routeLength(path) ** 0.99 * 0.1
  const offset = scale(normal(heading), size)
  const aIsLeft = cross(heading, sub(a, start)) > 0
  const left = explicitTail ? (aIsLeft ? a : b) : add(start, offset)
  const right = explicitTail ? (aIsLeft ? b : a) : sub(start, offset)
  const halfWidth = dist(left, right) * (explicitTail ? 0.5 : 0.25)

  for (const limitCorners of [false, true]) {
    const sides = arrowSides(path, left, right, halfWidth, limitCorners)
    if (!sides) return []
    const depth = limitCorners ? Math.min(size, dist(start, next) * 0.75) : size
    const outline = [...sides.left, ...sides.head, ...sides.right.reverse()]
    if (swallowtail) outline.push(add(start, scale(heading, depth)))
    if (isSimpleRing(outline)) return outline
  }
  return []
}

function orientation(a: XY, b: XY, c: XY) {
  const edge = sub(b, a)
  const offset = sub(c, a)
  const turn = cross(edge, offset)
  return Math.abs(turn) <= 1e-9 * length(edge) * length(offset) ? 0 : Math.sign(turn)
}

function edgesIntersect(a: XY, b: XY, c: XY, d: XY) {
  if (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
    Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
    Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
    Math.max(c[1], d[1]) < Math.min(a[1], b[1])
  )
    return false

  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  const between = (start: XY, end: XY, point: XY) => dot(sub(point, start), sub(point, end)) <= 0
  return (
    (abC * abD < 0 && cdA * cdB < 0) ||
    (abC === 0 && between(a, b, c)) ||
    (abD === 0 && between(a, b, d)) ||
    (cdA === 0 && between(c, d, a)) ||
    (cdB === 0 && between(c, d, b))
  )
}

function isSimpleRing(ring: readonly XY[]) {
  const origin = ring[0]
  if (!origin || ring.length < 3) return false
  let area = 0
  let areaScale = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    const c = ring[(i + 2) % ring.length]!
    if (dist(a, b) < 1e-10) return false
    if (orientation(a, b, c) === 0 && dot(sub(a, b), sub(c, b)) > 0) return false
    const p = sub(a, origin)
    const q = sub(b, origin)
    area += cross(p, q)
    areaScale += length(p) * length(q)

    for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue
      if (edgesIntersect(a, b, ring[j]!, ring[(j + 1) % ring.length]!)) return false
    }
  }
  return Math.abs(area) > areaScale * 1e-10
}

export function isSimpleArea(points: readonly Cartesian3[]) {
  if (points.length < 3) return false
  const ring = geographicPoints(points)
  const longitudes = ring.map(([longitude]) => longitude)
  if (Math.max(...longitudes) - Math.min(...longitudes) < 180) return isSimpleRing(ring)

  let valid = false
  projectGeometry(points, (local) => {
    valid = isSimpleRing(local)
    return []
  })
  return valid
}

function sampleBezier(points: readonly XY[], segments: number) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments
    const work = [...points]
    for (let end = work.length - 1; end > 0; end--) {
      for (let i = 0; i < end; i++) work[i] = mix(work[i]!, work[i + 1]!, t)
    }
    return work[0]!
  })
}

function doubleArrowWing(edge: XY, center: XY, tip: XY, forward: XY) {
  const root = mix(edge, center, 0.5)
  const axis = sub(tip, root)
  const side = cross(axis, sub(edge, root)) > 0 ? 1 : -1
  const bulge = scale(normal(axis), side)
  const firstBend = add(mix(root, tip, 0.3), scale(bulge, 0.2))
  const secondBend = add(mix(root, tip, 0.5), scale(bulge, 0.25))
  const centerline = [root, firstBend, secondBend, tip]
  const pathLength = routeLength(centerline)
  const lastSegment = sub(tip, secondBend)
  const heading = unit(lastSegment)
  const outward = scale(normal(heading), side)
  const headLength = Math.min(pathLength * 0.25, length(lastSegment) * 0.8)
  const headBase = sub(tip, scale(heading, headLength))
  const neckBase = sub(tip, scale(heading, headLength * 0.85))
  const headOffset = scale(outward, headLength * 0.3)
  const neckWidth = headLength * 0.15
  const neckOffset = scale(outward, neckWidth)
  const tailWidth = dist(edge, center) * 0.25
  const clearance = dot(sub(tip, center), forward) * 0.04
  const aboveTail = (point: XY) => {
    const height = dot(sub(point, center), forward)
    return add(point, scale(forward, Math.max(0, clearance - height)))
  }

  const outer = [edge]
  const inner = [center]
  let traveled = 0
  for (const [before, bend, after] of [
    [root, firstBend, secondBend],
    [firstBend, secondBend, tip],
  ] as const) {
    traveled += dist(before, bend)
    const incoming = unit(sub(bend, before))
    const outgoing = unit(sub(after, bend))
    const bisector = unit(add(normal(incoming), normal(outgoing)))
    const width = tailWidth + (neckWidth - tailWidth) * (traveled / pathLength)
    const offset = scale(bisector, (side * width) / Math.max(0.5, dot(bisector, normal(incoming))))
    outer.push(aboveTail(add(bend, offset)))
    inner.push(aboveTail(sub(bend, offset)))
  }
  outer.push(aboveTail(add(neckBase, neckOffset)))
  inner.push(aboveTail(sub(neckBase, neckOffset)))

  return {
    outer,
    head: [aboveTail(add(headBase, headOffset)), tip, aboveTail(sub(headBase, headOffset))],
    inner,
  }
}

export const doubleArrow: Geometry = ([a, b, firstTip, secondTip]) => {
  if (!a || !b || !firstTip || !secondTip) return []
  const baseline = sub(b, a)
  const center = mix(a, b, 0.5)
  const perpendicular = normal(unit(baseline))
  const firstHeight = dot(sub(firstTip, center), perpendicular)
  const secondHeight = dot(sub(secondTip, center), perpendicular)
  if (
    firstHeight * secondHeight <= 0 ||
    Math.min(Math.abs(firstHeight), Math.abs(secondHeight)) < 0.01
  ) {
    return []
  }

  const forward = scale(perpendicular, Math.sign(firstHeight))
  const [tipA, tipB] =
    dot(sub(secondTip, firstTip), baseline) >= 0 ? [firstTip, secondTip] : [secondTip, firstTip]
  const first = doubleArrowWing(a, center, tipA, forward)
  const second = doubleArrowWing(b, center, tipB, forward)

  // Trace the outer banks and a single inner bank. Joining complete wing rings
  // would send the outline through the tail midpoint and split the fill.
  const inner = sampleBezier([...first.inner.reverse(), ...second.inner.slice(1)], 48)
  return [
    ...sampleBezier(first.outer, 32),
    ...first.head,
    ...inner,
    ...second.head.reverse(),
    ...sampleBezier(second.outer.reverse(), 32),
  ]
}
