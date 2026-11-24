export const cloudQualityPresets = {
  performance: { label: '性能优先', resolution: 0.25, steps: 18, movingSteps: 12, detail: false },
  balanced: { label: '均衡', resolution: 0.375, steps: 28, movingSteps: 18, detail: true },
  high: { label: '高画质', resolution: 0.5, steps: 40, movingSteps: 26, detail: true },
} as const

export type CloudQuality = keyof typeof cloudQualityPresets

export interface VolumetricCloudOptions {
  quality: CloudQuality
  coverage: number
  density: number
  baseHeight: number
  thickness: number
  windSpeed: number
  cloudScale: number
  detailStrength: number
  brightness: number
  baseLight: number
  sunlightInfluence: number
  sunHighlight: number
  dayColor: string
  nightColor: string
}

export const cloudOptionLimits = {
  coverage: { min: 0, max: 1, step: 0.01 },
  density: { min: 0.1, max: 2, step: 0.05 },
  baseHeight: { min: 500, max: 12000, step: 100 },
  thickness: { min: 500, max: 8000, step: 100 },
  windSpeed: { min: 0, max: 120, step: 1 },
  cloudScale: { min: 0.35, max: 3, step: 0.05 },
  detailStrength: { min: 0, max: 2, step: 0.05 },
  brightness: { min: 0.25, max: 2.5, step: 0.05 },
  baseLight: { min: 0.15, max: 0.9, step: 0.01 },
  sunlightInfluence: { min: 0, max: 1, step: 0.01 },
  sunHighlight: { min: 0, max: 0.45, step: 0.01 },
} as const

export const defaultCloudOptions: Readonly<VolumetricCloudOptions> = Object.freeze({
  quality: 'balanced',
  coverage: 0.56,
  density: 0.85,
  baseHeight: 1800,
  thickness: 2800,
  windSpeed: 24,
  cloudScale: 1,
  detailStrength: 1,
  brightness: 1,
  baseLight: 0.56,
  sunlightInfluence: 1,
  sunHighlight: 0.14,
  dayColor: '#f0f7ff',
  nightColor: '#526b8c',
})

export function normalizeCloudOptions(options: VolumetricCloudOptions): VolumetricCloudOptions {
  const normalized = { ...options }
  if (!Object.hasOwn(cloudQualityPresets, options.quality)) {
    normalized.quality = defaultCloudOptions.quality
  }
  for (const key of Object.keys(cloudOptionLimits) as (keyof typeof cloudOptionLimits)[]) {
    const { min, max } = cloudOptionLimits[key]
    const value = options[key]
    normalized[key] = Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : defaultCloudOptions[key]
  }
  for (const key of ['dayColor', 'nightColor'] as const) {
    const color = options[key]
    normalized[key] =
      typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
        ? color.toLowerCase()
        : defaultCloudOptions[key]
  }
  return normalized
}
