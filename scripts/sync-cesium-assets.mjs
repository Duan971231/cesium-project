import { cp } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = new URL('../node_modules/cesium/Build/Cesium/', import.meta.url)
const destination = new URL('../public/cesium/', import.meta.url)
const folders = ['Assets', 'ThirdParty', 'Widgets', 'Workers']

await Promise.all(
  folders.map((folder) =>
    cp(fileURLToPath(new URL(folder, source)), fileURLToPath(new URL(folder, destination)), {
      recursive: true,
    }),
  ),
)
