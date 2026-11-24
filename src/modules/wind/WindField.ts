interface WindHeader {
  parameterCategory: number
  parameterNumber: number
  parameterUnit: string
  nx: number
  ny: number
  lo1: number
  la1: number
  dx: number
  dy: number
  scanMode: number
  refTime: string
  forecastTime: number
  surface1Type: number
  surface1Value: number
}

interface WindRecord {
  header: WindHeader
  data: number[]
}

export class WindField {
  readonly header: WindHeader
  readonly validTime: string
  private readonly u: number[]
  private readonly v: number[]

  constructor(input: unknown) {
    if (!Array.isArray(input)) throw new Error('风场文件必须包含 U/V 两个分量')
    const records = input as WindRecord[]
    const u = records.find(
      (r) => r?.header?.parameterCategory === 2 && r.header.parameterNumber === 2,
    )
    const v = records.find(
      (r) => r?.header?.parameterCategory === 2 && r.header.parameterNumber === 3,
    )
    if (!u || !v) throw new Error('风场缺少 U/V 分量')
    const h = u.header
    const keys = [
      'nx',
      'ny',
      'lo1',
      'la1',
      'dx',
      'dy',
      'scanMode',
      'refTime',
      'forecastTime',
      'surface1Type',
      'surface1Value',
      'parameterUnit',
    ] as const
    if (keys.some((key) => h[key] !== v.header[key])) throw new Error('U/V 网格、时间或单位不一致')
    if (
      !Number.isInteger(h.nx) ||
      !Number.isInteger(h.ny) ||
      h.nx < 2 ||
      h.ny < 2 ||
      !Number.isFinite(h.lo1) ||
      !Number.isFinite(h.la1) ||
      !(h.dx > 0) ||
      !(h.dy > 0) ||
      h.scanMode !== 0 ||
      Math.abs(h.nx * h.dx - 360) > 0.001 ||
      !['m.s-1', 'm/s'].includes(h.parameterUnit) ||
      !Number.isFinite(h.forecastTime)
    )
      throw new Error('仅支持全球规则经纬度网格、从北到南扫描及 m/s 风速')
    for (const record of [u, v]) {
      if (
        !Array.isArray(record.data) ||
        record.data.length !== h.nx * h.ny ||
        !record.data.every((value) => typeof value === 'number' && Number.isFinite(value))
      ) {
        throw new Error('风场网格数据不完整')
      }
    }
    const time = Date.parse(h.refTime) + h.forecastTime * 3_600_000
    if (!Number.isFinite(time)) throw new Error('风场数据时间无效')
    this.validTime = new Date(time).toISOString()
    this.header = h
    this.u = u.data
    this.v = v.data
  }

  sample(longitude: number, latitude: number) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
    const { nx, ny, lo1, la1, dx, dy } = this.header
    const x = ((((longitude - lo1) % 360) + 360) % 360) / dx
    const y = (la1 - latitude) / dy
    if (y < 0 || y > ny - 1) return null
    const x0 = Math.floor(x)
    const x1 = (x0 + 1) % nx
    const y0 = Math.min(Math.floor(y), ny - 2)
    const fx = x - x0
    const fy = y - y0
    const interpolate = (data: number[]) =>
      (data[y0 * nx + x0]! * (1 - fx) + data[y0 * nx + x1]! * fx) * (1 - fy) +
      (data[(y0 + 1) * nx + x0]! * (1 - fx) + data[(y0 + 1) * nx + x1]! * fx) * fy
    const u = interpolate(this.u)
    const v = interpolate(this.v)
    return { u, v, speed: Math.hypot(u, v) }
  }

  createTextureData() {
    const values = new Float32Array(this.u.length * 4)
    for (let index = 0; index < this.u.length; index++) {
      values[index * 4] = this.u[index]!
      values[index * 4 + 1] = this.v[index]!
    }
    return values
  }
}
