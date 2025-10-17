import {copyFile, constants, access} from 'node:fs/promises'
import {resolve} from 'node:path'

const appDir = resolve('.next', 'server', 'app')
const rootManifest = resolve(appDir, 'page_client-reference-manifest.js')
const marketingManifest = resolve(appDir, '(marketing)', 'page_client-reference-manifest.js')

async function ensureMarketingManifest() {
  try {
    await access(marketingManifest, constants.F_OK)
    return
  } catch {
    // noop
  }

  try {
    await copyFile(rootManifest, marketingManifest)
    console.log('[postbuild] Copied page_client-reference-manifest.js into (marketing) segment')
  } catch (error) {
    console.warn('[postbuild] Failed to copy marketing manifest:', error)
  }
}

ensureMarketingManifest()
