export default {
  '*.{ts,mts,tsx,vue}': ['oxlint --fix', 'eslint --fix --cache', 'prettier --write'],
  '*.{js,mjs,cjs,json,jsonc,yml,yaml,md,css,scss,html}': ['prettier --write'],
}
