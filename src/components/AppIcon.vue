<script setup lang="ts">
const paths = {
  globe:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c2.2 2.4 3.25 5.4 3.25 9s-1.05 6.6-3.25 9c-2.2-2.4-3.25-5.4-3.25-9s1.05-6.6 3.25-9Z',
  home: 'm3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm6 11v-7h6v7',
  draw: 'm14 5 5 5M4 20l4.6-1 11.1-11a1.9 1.9 0 0 0 0-2.7l-1-1a1.9 1.9 0 0 0-2.7 0L5 15.4Z',
  point: 'M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  line: 'm6 17 12-10M7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM21 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  polygon: 'm5 9 8-5 6 7-3 8H6ZM5 9h.01M13 4h.01M19 11h.01M16 19h.01M6 19h.01',
  layers: 'm12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  cloud: 'M6.5 18a4.5 4.5 0 1 1 .7-8.95A6 6 0 0 1 18.9 11 3.5 3.5 0 0 1 18.5 18Z',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5',
  chevron: 'm6 9 6 6 6-6',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  reset: 'M3 12a9 9 0 1 1 2.65 6.36M3 12V5m0 7h7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  compass: 'm12 3 5 15-5-3-5 3Z',
} as const

defineProps<{ name: keyof typeof paths }>()
</script>

<template>
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path :d="paths[name]" />
  </svg>
</template>
