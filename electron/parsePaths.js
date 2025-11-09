import fs from 'fs/promises'
import { existsSync, statSync } from 'fs'
import path from 'path'

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export async function parsePath(filePath) {
  const stats = statSync(filePath)
  const name = path.basename(filePath)
  const id = generateId()
  // Store the absolute normalized path for files
  const absolutePath = path.resolve(filePath)

  if (stats.isDirectory()) {
    const children = []
    try {
      const entries = await fs.readdir(filePath)
      for (const entry of entries) {
        const fullPath = path.join(filePath, entry)
        try {
          const child = await parsePath(fullPath)
          children.push(child)
        } catch (err) {
          // Skip files/folders we can't read (permissions, etc.)
          console.error(`Error reading ${fullPath}:`, err)
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${filePath}:`, err)
    }
    return { id, name, type: 'folder', children }
  } else {
    let content = ''
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch (err) {
      console.error(`Error reading file ${filePath}:`, err)
    }
    return { id, name, type: 'file', content, filePath: absolutePath }
  }
}

export async function parsePaths(paths) {
  const results = []
  for (const filePath of paths) {
    // Normalize the path to handle both forward and backslashes
    const normalizedPath = path.normalize(filePath)
    if (existsSync(normalizedPath)) {
      try {
        const node = await parsePath(normalizedPath)
        results.push(node)
      } catch (err) {
        console.error(`Error parsing path ${normalizedPath}:`, err)
      }
    } else {
      console.warn(`Path does not exist: ${normalizedPath}`)
    }
  }
  return results
}
