export interface PageCaptureOptions {
  signal?: AbortSignal
  /** Optional adapter for canvases whose drawing buffers must be refreshed before copying. */
  prepareCanvas?: (canvas: HTMLCanvasElement) => void
}

/** Snapshot the visible webpage, including DOM controls and canvas content. No live DOM is changed. */
export async function capturePage(options: PageCaptureOptions = {}): Promise<HTMLCanvasElement> {
  const { signal, prepareCanvas } = options
  signal?.throwIfAborted()
  const width = window.innerWidth
  const height = window.innerHeight
  const assets = new Map<string, Promise<string>>()
  const pending: (() => Promise<void>)[] = []
  const pseudoRules: { selector: string; style: CSSStyleDeclaration }[] = []
  let sequence = 0

  function embedUrl(value: string): Promise<string> {
    if (/^(data:|#)/.test(value)) return Promise.resolve(value)
    const url = new URL(value, document.baseURI).href
    let task = assets.get(url)
    if (!task) {
      task = fetch(url, { signal: signal ?? null }).then(async (response) => {
        if (!response.ok) throw new Error('无法加载页面截图所需的图片资源。')
        const blob = await response.blob()
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('无法读取页面图片资源。'))
          reader.readAsDataURL(blob)
        })
      })
      assets.set(url, task)
    }
    return task
  }

  async function embedStyle(value: string): Promise<string> {
    const matches = [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
    for (const match of matches) {
      const url = match[1]
      if (url && !url.startsWith('#'))
        value = value.replace(match[0], `url("${await embedUrl(url)}")`)
    }
    return value
  }

  function copyStyle(source: CSSStyleDeclaration, target: CSSStyleDeclaration) {
    for (let index = 0; index < source.length; index++) {
      const name = source.item(index)
      const value = source.getPropertyValue(name)
      target.setProperty(name, value, source.getPropertyPriority(name))
      if (value.includes('url('))
        pending.push(async () => target.setProperty(name, await embedStyle(value)))
    }
    target.setProperty('animation', 'none', 'important')
    target.setProperty('transition', 'none', 'important')
    target.setProperty('caret-color', 'transparent', 'important')
  }

  function clone(node: Node): Node | null {
    if (!(node instanceof Element)) return node.cloneNode(false)
    if (node.matches('script, style, link, noscript, [data-screenshot-ignore]')) return null
    const style = window.getComputedStyle(node)
    if (style.display === 'none') return null
    signal?.throwIfAborted()

    let result: Element
    if (node instanceof HTMLCanvasElement || node instanceof HTMLVideoElement) {
      let canvas: HTMLCanvasElement
      if (node instanceof HTMLCanvasElement) {
        prepareCanvas?.(node)
        canvas = node
      } else {
        canvas = document.createElement('canvas')
        canvas.width = node.videoWidth || node.clientWidth
        canvas.height = node.videoHeight || node.clientHeight
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法创建视频截图画布。')
        if (node.readyState >= 2) context.drawImage(node, 0, 0)
      }
      const image = document.createElement('img')
      // Copy synchronously after the optional render adapter, before WebGL clears its buffer.
      image.src = canvas.toDataURL('image/png')
      result = image
    } else result = node.cloneNode(false) as Element

    // Inline computed styles so scoped styles, CSS variables and SVG icons survive serialization.
    if (result instanceof HTMLElement || result instanceof SVGElement)
      copyStyle(style, result.style)
    for (const attribute of Array.from(result.attributes)) {
      if (/^on/i.test(attribute.name)) result.removeAttribute(attribute.name)
    }

    if (node instanceof HTMLImageElement && result instanceof HTMLImageElement) {
      result.removeAttribute('srcset')
      const image = result
      const url = node.currentSrc || node.src
      if (url)
        pending.push(async () => {
          image.src = await embedUrl(url)
        })
    }
    if (node instanceof HTMLTextAreaElement) result.textContent = node.value
    else if (node instanceof HTMLInputElement) {
      if (node.type !== 'file')
        result.setAttribute('value', node.type === 'password' ? '' : node.value)
      result.toggleAttribute('checked', node.checked)
    } else {
      for (const child of node.childNodes) {
        const copied = clone(child)
        if (copied) result.appendChild(copied)
      }
    }
    if (node instanceof HTMLSelectElement && result instanceof HTMLSelectElement) {
      for (let index = 0; index < node.options.length; index++)
        result.options[index]?.toggleAttribute('selected', !!node.options[index]?.selected)
    }

    if (node instanceof HTMLElement) {
      for (const pseudo of ['::before', '::after']) {
        const pseudoStyle = window.getComputedStyle(node, pseudo)
        if (!pseudoStyle.content || ['none', 'normal'].includes(pseudoStyle.content)) continue
        const id = `page-capture-${sequence++}`
        result.classList.add(id)
        const declarations = document.createElement('span').style
        copyStyle(pseudoStyle, declarations)
        // Some pseudo-elements contain asset URLs; serialize after resources are embedded.
        pseudoRules.push({ selector: `.${id}${pseudo}`, style: declarations })
      }
    }

    // Freeze scrollable panel contents at the currently visible scroll offset.
    if (node !== document.body && (node.scrollTop || node.scrollLeft) && result.firstChild) {
      const content = document.createElement('div')
      content.style.transform = `translate(${-node.scrollLeft}px, ${-node.scrollTop}px)`
      while (result.firstChild) content.appendChild(result.firstChild)
      result.appendChild(content)
    }
    return result
  }

  const bounds = document.body.getBoundingClientRect()
  const root = clone(document.body) as HTMLElement
  root.style.position = 'absolute'
  root.style.left = `${bounds.left}px`
  root.style.top = `${bounds.top}px`
  root.style.margin = '0'
  root.style.width = `${bounds.width}px`
  root.style.transform = 'none'
  await Promise.all(pending.map((task) => task()))
  signal?.throwIfAborted()
  const rules = document.createElement('style')
  rules.textContent = pseudoRules
    .map(({ selector, style }) => `${selector}{${style.cssText}}`)
    .join('\n')
  root.prepend(rules)

  const markup = new XMLSerializer().serializeToString(root)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    function cleanup() {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      image.onload = null
      image.onerror = null
    }
    function abort() {
      cleanup()
      image.src = ''
      reject(signal?.reason)
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('页面截图生成超时，请重试。'))
    }, 15_000)
    signal?.addEventListener('abort', abort, { once: true })
    image.onload = () => {
      cleanup()
      resolve()
    }
    image.onerror = () => {
      cleanup()
      reject(new Error('无法生成页面截图，请检查图片跨域设置。'))
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  signal?.throwIfAborted()
  const ratio = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建页面截图画布。')
  context.fillStyle = window.getComputedStyle(document.documentElement).backgroundColor
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}
