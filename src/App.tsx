import React, { useCallback, useState } from 'react'
import { useFSStore, type FSNode } from './fsStore'

declare global {
  interface Window {
    fsAPI: {
      parseDroppedPaths: (paths: string[]) => Promise<FSNode[]>
      getFilePath: (file: File) => string
    }
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
  const [isDragging, setIsDragging] = useState(false)
  const [fsAPIAvailable, setFsAPIAvailable] = useState(false)

  // Check if fsAPI is available on mount
  React.useEffect(() => {
    const checkAPI = () => {
      if (window.fsAPI) {
        setFsAPIAvailable(true)
      } else {
        setTimeout(checkAPI, 100)
      }
    }
    checkAPI()
  }, [])
  
  const handleDrop = async(e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (!window.fsAPI) {
      console.error('fsAPI is not available. Make sure the preload script is loaded.')
      return
    }

    const items = e.dataTransfer?.items;
    const files = e.dataTransfer?.files;
    
    if (items && items.length > 0) {
      try {
        const file = files?.[0] as File;
        if (!file) return;
        
        const filepath = window.fsAPI.getFilePath(file);
        console.log("filepath: ", filepath);
        const dataSource = await window.fsAPI.parseDroppedPaths([filepath]);
        addNodes(dataSource)
      } catch (error) {
        console.error('Error processing dropped file:', error)
      }
    } else if (files && files.length > 0) {
      try {
        const filepath = window.fsAPI.getFilePath(files[0] as File);
        console.log("filepath: ", filepath);
        const dataSource = await window.fsAPI.parseDroppedPaths([filepath]);
        addNodes(dataSource)
      } catch (error) {
        console.error('Error processing dropped file:', error)
      }
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, [])

  // const handleCopyMarkdown = useCallback(() => {
  //   const markdown = generateMarkdown(nodes)
  //   navigator.clipboard.writeText(markdown)
  //   alert('Copied to clipboard!')
  // }, [nodes])

  return (
    <div
      className="mx-auto my-8 p-4 w-[85vw] h-[calc(100vh-4rem)] border-2 border-dashed rounded-lg flex flex-col items-center justify-center"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <h2 className="text-xl text-center font-[350] mb-2">Drag files here</h2>
      <div className="overflow-auto flex-1 mt-2 pt-2">
        {nodes.map(n => (
          <pre key={n.id} className="text-xs font-mono">{n.name} ({n.type})</pre>
        ))}
      </div>
    </div>
  )
}
