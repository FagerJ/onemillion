import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, transformWithOxc, type Logger, type Plugin } from 'vite'

// Dev only: a browser pane that is open but not on screen paints no animation
// frames, so every motion stays frozen at its first frame. With ?raf-shim in the URL,
// timers drive requestAnimationFrame instead. It runs before any module, because
// motion captures requestAnimationFrame when it loads. Never part of a build.
const rafShim = (): Plugin => ({
  name: 'raf-shim',
  apply: 'serve',
  transformIndexHtml: () => [
    {
      tag: 'script',
      injectTo: 'head-prepend',
      children:
        "if (location.search.includes('raf-shim')) window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16)",
    },
  ],
})

// Not precached: the worker itself, the .woff fallbacks no current browser downloads (each
// font ships a .woff2 beside it), and the screenshots only Chrome's install sheet shows.
const NOT_PRECACHED = [/^sw\.js$/, /\.woff$/, /\.map$/, /^screenshots\//]

// D49: after the build, list dist/, check it's installable, and write dist/sw.js with this
// build's file list on its first line. VITE_SW_OFF=1 writes the kill switch instead.
const serviceWorker = (off: boolean): Plugin => {
  let outDir = ''
  let logger: Logger
  return {
    name: 'omb-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      logger = config.logger
    },
    async closeBundle() {
      const all = await walk(outDir)
      await checkInstallable(outDir, all)
      const files = all.filter((f) => !NOT_PRECACHED.some((re) => re.test(f))).sort()
      const html = await readFile(join(outDir, 'index.html'), 'utf8')
      for (const [, path] of html.matchAll(/(?:href|src)="\/([^"#?]+)"/g))
        if (!files.includes(path)) throw new Error(`sw: index.html needs /${path}, which isn't precached`)
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(await readFile(join(outDir, f)))
      const build = { version: hash.digest('hex').slice(0, 12), files: files.map((f) => `/${f}`) }
      const src = await readFile(fileURLToPath(new URL(off ? './sw/off.ts' : './sw/sw.ts', import.meta.url)), 'utf8')
      const { code } = await transformWithOxc(src, 'sw.ts')
      const out = `const BUILD = ${JSON.stringify(build)};\n${code}`
      new Function(out) // parses, doesn't run: a classic script with no import/export, or register() fails on every phone
      await writeFile(join(outDir, 'sw.js'), out)
      logger.info(`sw.js ${off ? 'KILL SWITCH' : build.version}: ${files.length} files precached`)
    },
  }
}

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p, base)))
    else out.push(relative(base, p).split(sep).join('/'))
  }
  return out
}

const pngSize = (b: Buffer) => `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` // IHDR width, height

// Chrome won't offer to install without these, and a wrong size fails silently on a phone.
async function checkInstallable(outDir: string, files: string[]) {
  const m = JSON.parse(await readFile(join(outDir, 'manifest.webmanifest'), 'utf8'))
  for (const key of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color'])
    if (!m[key]) throw new Error(`manifest: ${key} is missing`)
  const have = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes} ${i.purpose ?? 'any'}`)
  for (const want of ['192x192 any', '512x512 any', '512x512 maskable'])
    if (!have.includes(want)) throw new Error(`manifest: no ${want} icon`)
  for (const { src, sizes } of [...m.icons, ...(m.screenshots ?? [])]) {
    const file = src.replace(/^\//, '')
    if (!files.includes(file)) throw new Error(`manifest: ${src} is not in the build`)
    if (file.endsWith('.png') && pngSize(await readFile(join(outDir, file))) !== sizes)
      throw new Error(`manifest: ${src} is not ${sizes}`)
  }
  if (pngSize(await readFile(join(outDir, 'icons/apple-touch-icon.png'))) !== '180x180')
    throw new Error('apple-touch-icon.png must be 180x180')
}

// Vite bakes VITE_* variables into the bundle at build time. Without these the app
// builds fine and then shows a blank page, so refuse to build at all. On Vercel they
// are project environment variables (docs/DEPLOY.md); locally, app/.env.local.
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')
  if (command === 'build') {
    const missing = REQUIRED_ENV.filter((key) => !env[key])
    if (missing.length) throw new Error(`Missing ${missing.join(' and ')}. See docs/DEPLOY.md.`)
  }

  return {
    plugins: [react(), tailwindcss(), rafShim(), serviceWorker(env.VITE_SW_OFF === '1')],
    define: {
      // Which deploy a phone is running, shown on Me. Vercel exposes the commit to the build.
      'import.meta.env.VITE_APP_BUILD': JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // Listen on the LAN too, so a phone on the same Wi-Fi can open the dev app.
      host: true,
      port: 5173,
      strictPort: true,
    },
    // The service worker runs only in a build, so test it here. Never on 5173: a worker
    // registered there would serve a stale build to the dev server (`/?sw-reset` undoes it).
    preview: {
      port: 4173,
      strictPort: true,
    },
  }
})
