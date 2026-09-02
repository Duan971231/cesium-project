import mitt from 'mitt'

export interface AppEvents extends Record<string | symbol, unknown> {
  'counter:incremented': { count: number }
  'notification:show': {
    level: 'info' | 'success' | 'warning' | 'error'
    message: string
  }
}

export const appEmitter = mitt<AppEvents>()
