import type { PlotType } from '../core/shapes'

interface PlotTool {
  label: string
  path: string
  hint?: string
  filled?: boolean
}

export const plotTools = {
  point: { label: '点', path: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', filled: true },
  text: { label: '文本', path: 'M4 8V5h16v3m-8-3v14m-4 0h8' },
  line: { label: '折线', path: 'm3 17 6-8 6 5 6-8' },
  polygon: { label: '多边形', path: 'm4 10 7-6 8 2 2 9-8 5-8-3Z', filled: true },
  rectangle: { label: '矩形', path: 'M4 6h16v12H4Z', filled: true, hint: '依次点击两个对角点。' },
  rotatedRectangle: {
    label: '三点矩形',
    path: 'm3 10 12-6 5 10-12 6Z',
    filled: true,
    hint: '先点同一条边的两个端点，再点对边上的任意位置，确定宽度和展开方向。',
  },
  triangle: { label: '三角形', path: 'm12 4 9 16H3Z', filled: true, hint: '依次点击三个顶点。' },
  circle: {
    label: '圆形',
    path: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    filled: true,
    hint: '先点圆心，再点圆周。',
  },
  ellipse: {
    label: '椭圆',
    path: 'M22 12a10 6 0 1 1-20 0 10 6 0 0 1 20 0Z',
    filled: true,
    hint: '点击椭圆外接矩形的两个对角点。',
  },
  sector: {
    label: '扇形',
    path: 'M12 12 4 6a10 10 0 0 1 16 0Z',
    filled: true,
    hint: '先点圆心，再点弧线起点和终点。',
  },
  lune: {
    label: '弓形',
    path: 'M3 15a10 10 0 0 1 18 0Z',
    filled: true,
    hint: '先点弧线两端，再点弧线经过的位置。',
  },
  curve: { label: '曲线', path: 'M3 17c4 0 4-9 9-9s5 5 9-2' },
  freehandLine: { label: '自由线', path: 'M3 16c3-8 5 4 8 1s0-10 4-9 3 4 6 0' },
  freehandPolygon: {
    label: '自由面',
    path: 'M3 15c-1-8 5-7 7-10 4-3 8 1 8 4 0 4 5 2 3 7-2 4-8 1-11 4-3 2-7-1-7-5Z',
    filled: true,
  },
  straightArrow: { label: '细直箭头', path: 'M3 12h17m-5-5 5 5-5 5' },
  curvedArrow: { label: '曲线箭头', path: 'M4 19c8 0 11-4 14-13m-6 3 6-3 3 6' },
  fineArrow: { label: '直箭头', path: 'm3 15 11-6-1-3 8 1-4 7-1-3-11 7Z', filled: true },
  assaultDirection: { label: '突击方向', path: 'M3 10h10V5l8 7-8 7v-5H3Z', filled: true },
  attackArrow: {
    label: '进攻箭头',
    path: 'M3 19c5 0 11-1 13-9l-3-1 7-5 1 9-3-2c-2 6-6 9-15 11Z',
    filled: true,
    hint: '先点箭尾两端，再沿中心线取点，最后一点为箭头。',
  },
  swallowtailAttackArrow: {
    label: '燕尾进攻',
    path: 'M3 15c6 2 10-2 13-6l-3-1 7-4 1 8-3-2c-3 6-8 10-15 11l3-3Z',
    filled: true,
    hint: '先点箭尾两端，再沿中心线取点，最后一点为箭头。',
  },
  squadCombat: {
    label: '分队方向',
    path: 'M3 14c6 3 10 1 13-4l-3-1 7-5 1 8-3-1C13 19 7 20 3 18Z',
    filled: true,
    hint: '从箭尾中心沿路径取点，最后一点为箭头。',
  },
  swallowtailSquadCombat: {
    label: '燕尾分队',
    path: 'M3 12c5 3 10 2 13-3l-3-1 7-4 1 8-3-2C14 18 8 20 3 19l3-3Z',
    filled: true,
    hint: '从箭尾中心沿路径取点，最后一点为箭头。',
  },
  doubleArrow: {
    label: '双箭头',
    path: 'M4 20c0-6 2-9 3-12L3 9l5-5 3 6-3-1c0 4 1 7 4 8 3-1 4-4 4-8l-3 1 3-6 5 5-4-1c1 3 3 6 3 12Z',
    filled: true,
    hint: '先点底边两端，再在底边同一侧选两个箭头尖端。',
  },
} satisfies Record<PlotType, PlotTool>

export const plotToolEntries = Object.entries(plotTools) as [PlotType, PlotTool][]
