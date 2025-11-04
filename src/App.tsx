import React, { useCallback } from 'react'
import { useFSStore, type FSNode } from './fsStore'

declare global {
  interface Window {
    fsAPI: {
      parseDroppedPaths: (paths: string[]) => Promise<FSNode[]>
    }
  }
  interface File {
    path?: string
  }
}

function generateMarkdown(nodes: FSNode[]): string {
  let md = ''
  function traverse(node: FSNode, parentPath: string) {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name
    if (node.type === 'file') {
      md += `\n/${fullPath}\n\`\`\`${fullPath.split('.').pop() || ''}\n${node.content}\n\`\`\`\n`
    } else if (node.type === 'folder' && node.children) {
      node.children.forEach(child => traverse(child, fullPath))
    }
  }
  nodes.forEach(n => traverse(n, ''))
  return md
}

export default function App() {
  const nodes = useFSStore(s => s.nodes)
  const addNodes = useFSStore(s => s.addNodes)

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const paths = files.map(f => f.path).filter((p): p is string => !!p)
    const newNodes = await window.fsAPI.parseDroppedPaths(paths)
    addNodes(newNodes)
  }, [addNodes])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleCopyMarkdown = useCallback(() => {
    const markdown = generateMarkdown(nodes)
    navigator.clipboard.writeText(markdown)
    alert('Copied to clipboard!')
  }, [nodes])

  return (
    <div
      className="p-4 w-full h-full border-2 border-dashed rounded-lg flex flex-col"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <h2 className="font-bold mb-2">Drag folders/files here</h2>
      <button
        onClick={handleCopyMarkdown}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-2"
      >
        Copy Markdown
      </button>
      <div className="overflow-auto flex-1 border-t mt-2 pt-2">
        {nodes.map(n => (
          <pre key={n.id} className="text-xs font-mono">{n.name} ({n.type})</pre>
        ))}
      </div>
    </div>
  )
}
