<script setup lang="ts">
import { RouterLink } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'

const earthImage = `${import.meta.env.BASE_URL}earth-preview.png`
</script>

<template>
  <main class="welcome">
    <div class="stars" aria-hidden="true"></div>
    <header class="welcome-header">
      <div class="brand">
        <span class="brand-icon"><AppIcon name="globe" /></span>
        <span>寰图</span>
      </div>
    </header>

    <div class="welcome-content">
      <div class="welcome-copy">
        <p class="welcome-kicker">CESIUM WORKSPACE</p>
        <h1>三维地球<br />工作台<span>。</span></h1>
        <p class="welcome-intro">浏览交互式三维地球，管理场景显示，并扩展自己的空间工具。</p>
        <RouterLink class="enter-button" :to="{ name: 'globe' }">
          <AppIcon name="globe" />
          进入工作台
        </RouterLink>
      </div>
      <div class="earth-art" aria-hidden="true">
        <div class="earth-orbit"></div>
        <img :src="earthImage" alt="" width="880" height="880" fetchpriority="high" />
      </div>
    </div>

    <footer class="welcome-footer">
      <span>基于 CesiumJS</span>
      <span>Natural Earth II 影像</span>
    </footer>
  </main>
</template>

<style scoped>
.welcome {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100svh;
  overflow: hidden;
  padding: 30px max(6vw, 26px) 26px;
  background: radial-gradient(ellipse at 75% 49%, #102344 0%, #090f22 46%, #060a14 80%);
}

.stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle, #d5e7ff 0.7px, transparent 1.2px),
    radial-gradient(circle, #82b6ff 0.65px, transparent 1.1px),
    radial-gradient(circle, #a2c4ea 0.55px, transparent 1px);
  background-position:
    27px 12px,
    73px 27px,
    2px 98px;
  background-size:
    127px 193px,
    211px 137px,
    173px 229px;
  mask-image: linear-gradient(104deg, transparent 9%, #000 64%);
  opacity: 0.48;
}

.welcome-header,
.welcome-footer {
  position: relative;
  z-index: 1;
}

.welcome-content {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(0, 6fr);
  align-items: center;
  min-height: 520px;
}

.welcome-copy {
  position: relative;
  z-index: 1;
}

.welcome-kicker {
  margin: 0 0 22px;
  color: #83b5ff;
  font: 650 0.76rem/1.3 var(--mono);
  letter-spacing: 0.2em;
}

h1 {
  margin: 0;
  color: #f5f8ff;
  font-size: clamp(3.6rem, 6.7vw, 7.2rem);
  font-weight: 750;
  line-height: 1.09;
  letter-spacing: -0.065em;
}

h1 span {
  color: #77aaff;
}

.welcome-intro {
  max-width: 24rem;
  margin: 24px 0 32px;
  color: #a8b9d6;
  font-size: 1rem;
  line-height: 1.8;
}

.enter-button {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  padding: 15px 24px;
  border-radius: 10px;
  background: #89b7ff;
  box-shadow: 0 6px 32px #4e88fe44;
  color: #09192e;
  font-weight: 750;
  text-decoration: none;
  transition: background 160ms ease;
}

.enter-button:hover {
  background: #afceff;
}

.enter-button svg {
  width: 20px;
}

.earth-art {
  position: relative;
  width: min(58vw, 76vh, 880px);
  aspect-ratio: 1;
  justify-self: center;
}

.earth-art img {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 0 38px #3977c74d);
}

.earth-orbit {
  position: absolute;
  inset: 1%;
  border: 1px solid #79aeff33;
  border-radius: 50%;
}

.welcome-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid #809bc126;
  padding-top: 16px;
  color: #90a2bf;
  font-size: 0.8rem;
}

@media (max-width: 720px) {
  .welcome-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    min-height: 0;
    padding-block: 64px 24px;
  }

  h1 {
    font-size: clamp(3.1rem, 12vw, 5.3rem);
  }

  .earth-art {
    width: min(94vw, 460px);
    margin-block: 16px;
  }
}
</style>
