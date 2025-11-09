import fs from 'fs'
import { existsSync } from 'fs'
import path from 'path'

// Map of file paths to their watchers and callbacks
const watchers = new Map()

export function watchFile(filePath, callback) {
  // Normalize the path for consistent comparison (use forward slashes)
  const normalizedPath = filePath.replace(/\\/g, '/')
  
  // If already watching, update the callback
  if (watchers.has(normalizedPath)) {
    const watcherData = watchers.get(normalizedPath)
    watcherData.callback = callback
    return
  }
  
  // Use original path format for fs.watch (works better on Windows)
  const watchPath = path.normalize(filePath)
  
  if (!existsSync(watchPath)) {
    console.warn(`Cannot watch file that doesn't exist: ${watchPath}`)
    return
  }
  
  try {
    const watcher = fs.watch(watchPath, { persistent: true }, (eventType, filename) => {
      if (eventType === 'change') {
        const watcherData = watchers.get(normalizedPath)
        if (watcherData && watcherData.callback) {
          // Debounce rapid changes
          clearTimeout(watcherData.debounceTimer)
          watcherData.debounceTimer = setTimeout(() => {
            watcherData.callback(normalizedPath)
          }, 100)
        }
      }
    })
    
    watchers.set(normalizedPath, {
      watcher,
      callback,
      debounceTimer: null
    })
  } catch (error) {
    console.error(`Error watching file ${normalizedPath}:`, error)
  }
}

export function unwatchFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const watcherData = watchers.get(normalizedPath)
  if (watcherData) {
    if (watcherData.debounceTimer) {
      clearTimeout(watcherData.debounceTimer)
    }
    watcherData.watcher.close()
    watchers.delete(normalizedPath)
  }
}

export function unwatchAll() {
  for (const [filePath, watcherData] of watchers.entries()) {
    if (watcherData.debounceTimer) {
      clearTimeout(watcherData.debounceTimer)
    }
    watcherData.watcher.close()
  }
  watchers.clear()
}
