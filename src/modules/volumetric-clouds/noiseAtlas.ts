const size = 32
const columns = 8
const tileSize = size + 2
let noiseAtlas: HTMLCanvasElement | undefined

function createNoiseLattice(period: number, seed: number) {
  const values = new Float32Array(period ** 3)
  for (let i = 0; i < values.length; i++) {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    values[i] = (seed >>> 0) / 4294967296
  }

  function read(x: number, y: number, z: number) {
    return values[((z % period) * period + (y % period)) * period + (x % period)]!
  }

  const mix = (a: number, b: number, weight: number) => a + (b - a) * weight
  const fade = (t: number) => t * t * (3 - 2 * t)

  return (x: number, y: number, z: number) => {
    const frequency = period / size
    x *= frequency
    y *= frequency
    z *= frequency
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const iz = Math.floor(z)
    const tx = fade(x - ix)
    const ty = fade(y - iy)
    const tz = fade(z - iz)
    const slice = (k: number) =>
      mix(
        mix(read(ix, iy, k), read(ix + 1, iy, k), tx),
        mix(read(ix, iy + 1, k), read(ix + 1, iy + 1, k), tx),
        ty,
      )
    return mix(slice(iz), slice(iz + 1), tz)
  }
}

export function getCloudNoiseAtlas() {
  if (noiseAtlas) return noiseAtlas

  const canvas = document.createElement('canvas')
  canvas.width = columns * tileSize
  canvas.height = (size / columns) * tileSize
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法初始化体积云噪声纹理。')

  const image = context.createImageData(canvas.width, canvas.height)
  const coarse = createNoiseLattice(4, 297590141)
  const medium = createNoiseLattice(8, 924061117)
  const fine = createNoiseLattice(16, 156256417)

  for (let z = 0; z < size; z++) {
    const tileX = (z % columns) * tileSize
    const tileY = Math.floor(z / columns) * tileSize
    for (let y = 0; y < tileSize; y++) {
      for (let x = 0; x < tileSize; x++) {
        // Both edges wrap within the slice so hardware bilinear filtering stays inside the tile.
        const sx = (x + size - 1) % size
        const sy = (y + size - 1) % size
        const a = coarse(sx, sy, z)
        const b = medium(sx, sy, z)
        const c = fine(sx, sy, z)
        const i = ((canvas.height - 1 - tileY - y) * canvas.width + tileX + x) * 4
        image.data[i] = Math.round(255 * (a * 0.61 + b * 0.27 + c * 0.12))
        image.data[i + 1] = Math.round(255 * (b * 0.56 + c * 0.44))
        image.data[i + 3] = 255
      }
    }
  }

  context.putImageData(image, 0, 0)
  noiseAtlas = canvas
  return canvas
}
