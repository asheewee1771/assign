import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Project pages are served from /assign/, not the domain root.
  base: process.env.GITHUB_ACTIONS ? '/assign/' : '/',
  test: {
    // .claude/worktrees holds full copies of this project. Without this,
    // vitest runs every test twice — once here, once in the copy — and a
    // stale copy would report passes for code that is no longer current.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
})
