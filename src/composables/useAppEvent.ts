import type { Handler } from 'mitt'
import { onScopeDispose } from 'vue'

import { appEmitter, type AppEvents } from '@/events'

export function useAppEvent<EventName extends keyof AppEvents>(
  eventName: EventName,
  handler: Handler<AppEvents[EventName]>,
) {
  appEmitter.on(eventName, handler)
  onScopeDispose(() => appEmitter.off(eventName, handler))
}
