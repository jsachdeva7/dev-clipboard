import React, { useCallback, useState, useEffect } from 'react'
import { useFSStore, type FSNode } from './fsStore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderPlus, faRotateRight, faChevronDown, faChevronUp, faTrash, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons'
import ConfirmDialog from './components/ConfirmDialog'
import { getFileIconPath } from './utils/fileIcons'
import Switch from 'react-switch'

declare global {
  interface Window {
    fsAPI: {
      parseDroppedPaths: (paths: string[]) => Promise<FSNode[]>
      getFilePath: (file: File) => string
      watchFile: (filePath: string) => Promise<void>
      unwatchFile: (filePath: string) => Promise<void>
      onFileChanged: (callback: (data: { filePath: string, content: string }) => void) => void
      removeFileChangedListener: () => void
    }
  }
}

function FileIcon({ fileName, isFolder, isExpanded }: { fileName: string, isFolder: boolean, isExpanded?: boolean }) {
  const iconPath = getFileIconPath(fileName, isFolder, isExpanded)
  
  return (
    <img 
      src={iconPath} 
      alt="" 
      className="w-4 h-4 flex-shrink-0"
      style={{ imageRendering: 'crisp-edges' }}
    />
  )
}

function FileNode({ node, onDragStart, onDragOver, dragOverFolderId, onDrop, updateNodeName, deleteNode, setNodeEditing, isSelected, onSelect, selectedIds, dropPosition, setDropPosition, draggedNodeId, siblingNodes, isDraggingExternal }: { 
  node: FSNode
  onDragStart: (id: string) => void
  onDragOver: (id: string | null) => void
  dragOverFolderId: string | null
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  updateNodeName: (id: string, name: string) => void
  deleteNode: (id: string) => void
  setNodeEditing: (id: string, isEditing: boolean) => void
  isSelected: boolean
  onSelect: (id: string, e: React.MouseEvent) => void
  selectedIds: Set<string>
  dropPosition: { nodeId: string, position: 'before' | 'after' } | null
  setDropPosition: (position: { nodeId: string, position: 'before' | 'after' } | null) => void
  draggedNodeId: string | null
  siblingNodes?: FSNode[]
  isDraggingExternal?: boolean
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [editingName, setEditingName] = React.useState(node.name)
  const [clickTimer, setClickTimer] = React.useState<number | null>(null)
  
  React.useEffect(() => {
    if (node.isEditing) {
      setEditingName(node.name)
    }
  }, [node.isEditing, node.name])
  
  React.useEffect(() => {
    return () => {
      if (clickTimer !== null) {
        clearTimeout(clickTimer)
      }
    }
  }, [clickTimer])
  
  const handleDragStart = (e: React.DragEvent) => {
    if (node.isEditing) {
      e.preventDefault()
      return
    }
    // Add CSS class IMMEDIATELY - before any other operations
    document.body.classList.add('dragging')
    
    e.dataTransfer.setData('application/x-node-id', node.id)
    e.dataTransfer.effectAllowed = 'move'
    
    onDragStart(node.id)
  }
  
  const handleMouseDown = () => {
    // Add dragging class on mousedown to prepare cursor BEFORE drag starts
    // This prevents any brief moment where cursor might flicker
    if (!node.isEditing) {
      document.body.classList.add('dragging')
    }
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault() // Always prevent default to maintain consistent cursor
    
    // Handle both internal node drags and external file drags
    const isInternalDrag = draggedNodeId && draggedNodeId !== node.id
    const isExternalDrag = isDraggingExternal
    
    if (!isInternalDrag && !isExternalDrag) {
      e.dataTransfer.dropEffect = 'move'
      return
    }
    
    e.dataTransfer.dropEffect = 'move'
    e.stopPropagation()
    
    // For folders, we need to distinguish between:
    // 1. Dropping INTO the folder (center area) - show folder highlight, no line
    // 2. Inserting BETWEEN folders (top/bottom edges) - show line indicator
    
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseY = e.clientY
    const itemCenterY = rect.top + rect.height / 2
    const threshold = 4 // 4px threshold to prevent oscillation
    const edgeThreshold = 8 // 8px from top/bottom edge to trigger "between" mode
    
    if (node.type === 'folder' && !node.isEditing) {
      // Check if mouse is near the edges (top or bottom) of the folder item
      const distanceFromTop = mouseY - rect.top
      const distanceFromBottom = rect.bottom - mouseY
      const isNearTopEdge = distanceFromTop < edgeThreshold
      const isNearBottomEdge = distanceFromBottom < edgeThreshold
      
      // If near edges, show position indicator (insert between items)
      if (isNearTopEdge || isNearBottomEdge) {
        // Clear folder highlight when showing position indicator
        onDragOver(null)
        
        // Use the same logic as files for positioning
        if (mouseY >= rect.top && mouseY <= rect.bottom) {
          const isTopHalf = mouseY < itemCenterY
          
          if (siblingNodes && siblingNodes.length > 0) {
            const currentIndex = siblingNodes.findIndex(n => n.id === node.id)
            const isFirst = currentIndex === 0
            const isLast = currentIndex === siblingNodes.length - 1
            
            if (isTopHalf && isFirst) {
              setDropPosition({ nodeId: node.id, position: 'before' })
              return
            }
            
            if (isTopHalf && currentIndex > 0) {
              const previousNode = siblingNodes[currentIndex - 1]
              setDropPosition({ nodeId: previousNode.id, position: 'after' })
              return
            }
            
            if (!isTopHalf && isLast) {
              setDropPosition({ nodeId: node.id, position: 'after' })
              return
            }
          }
          
          setDropPosition({ nodeId: node.id, position: 'after' })
        }
        return
      }
      
      // Otherwise, mouse is in center area - allow dropping INTO folder
      onDragOver(node.id)
      setDropPosition(null) // Clear position indicator when dropping into folder
      return
    }
    
    // For files/non-folders, show indicator between items
    // When hovering top half, show indicator after previous item (between prev and current)
    // When hovering bottom half, show indicator after current item (between current and next)
    // Special cases: first item top half = before first, last item bottom half = after last
    if (mouseY >= rect.top && mouseY <= rect.bottom) {
      const isTopHalf = mouseY < itemCenterY
      
      if (siblingNodes && siblingNodes.length > 0) {
        const currentIndex = siblingNodes.findIndex(n => n.id === node.id)
        const isFirst = currentIndex === 0
        const isLast = currentIndex === siblingNodes.length - 1
        
        // If hovering top half of first item, show indicator before first item
        if (isTopHalf && isFirst) {
          setDropPosition({ nodeId: node.id, position: 'before' })
          return
        }
        
        // If hovering top half and not first, show indicator after previous item
        if (isTopHalf && currentIndex > 0) {
          const previousNode = siblingNodes[currentIndex - 1]
          setDropPosition({ nodeId: previousNode.id, position: 'after' })
          return
        }
        
        // If hovering bottom half of last item, show indicator after last item
        if (!isTopHalf && isLast) {
          const distanceFromCenter = Math.abs(mouseY - itemCenterY)
          if (distanceFromCenter < threshold && dropPosition?.nodeId === node.id && dropPosition?.position === 'after') {
            return
          }
          setDropPosition({ nodeId: node.id, position: 'after' })
          return
        }
      }
      
      // Otherwise, show indicator after current item (between current and next)
      const distanceFromCenter = Math.abs(mouseY - itemCenterY)
      
      // If in threshold zone and already showing this position, maintain it
      if (distanceFromCenter < threshold && dropPosition?.nodeId === node.id && dropPosition?.position === 'after') {
        // Keep current position
        return
      }
      
      setDropPosition({ nodeId: node.id, position: 'after' })
    }
  }
  
  const handleDragLeave = () => {
    // Don't clear folder highlight immediately - let it clear when dragging over a new item
    // But do clear dropPosition if we're leaving the item entirely
    // (This prevents flickering when moving between items)
  }
  
  const handleNameSubmit = () => {
    const trimmedName = editingName.trim()
    if (trimmedName) {
      updateNodeName(node.id, trimmedName)
    } else {
      deleteNode(node.id)
    }
  }
  
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSubmit()
    } else if (e.key === 'Escape') {
      setNodeEditing(node.id, false)
      setEditingName(node.name)
    }
  }
  
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (clickTimer !== null) {
      clearTimeout(clickTimer)
      setClickTimer(null)
    }
    if (node.type === 'folder' && !node.isEditing) {
      e.stopPropagation()
      setNodeEditing(node.id, true)
    }
  }
  
  const handleClick = (e: React.MouseEvent) => {
    if (!node.isEditing && !e.defaultPrevented) {
      // For Ctrl/Cmd or Shift clicks, handle immediately
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        onSelect(node.id, e)
      } else {
        // For regular clicks, delay to allow double-click detection
        const timer = window.setTimeout(() => {
          onSelect(node.id, e)
          setClickTimer(null)
        }, 200)
        setClickTimer(timer)
      }
    }
  }
  
  const handleFileDoubleClick = () => {
    if (clickTimer !== null) {
      clearTimeout(clickTimer)
      setClickTimer(null)
    }
    if (node.type === 'file') {
      setNodeEditing(node.id, true)
    }
  }
  
  if (node.type === 'folder') {
    const isDragOver = dragOverFolderId === node.id
    
    if (node.isEditing) {
      return (
        <div className="mb-1">
          <div className="flex items-center gap-2 px-1 py-0 rounded h-6">
            <FileIcon fileName={node.name} isFolder={true} />
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              placeholder="New Folder"
              className="px-1 py-0 text-sm border-none rounded bg-transparent dark:bg-transparent dark:text-gray-100 focus:outline-none focus:ring-0 focus:border-none placeholder:text-gray-400 dark:placeholder:text-gray-500 m-0"
              style={{ WebkitAppRegion: 'no-drag', border: 'none', outline: 'none', boxShadow: 'none', padding: '0', margin: '0' } as React.CSSProperties}
              autoFocus
            />
          </div>
        </div>
      )
    }
    
    const showDropIndicatorBefore = dropPosition?.nodeId === node.id && dropPosition?.position === 'before'
    const showDropIndicatorAfter = dropPosition?.nodeId === node.id && dropPosition?.position === 'after'
    
    return (
      <div 
        className="mb-1 relative" 
        data-node-id={node.id}
      >
        {showDropIndicatorBefore && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 -translate-y-full z-10" />
        )}
        <div 
          className={`flex items-center gap-2 px-1 pr-0 py-0 rounded h-6 ${isDragOver ? 'bg-blue-100 dark:bg-blue-900/30' : ''} ${isSelected ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          draggable={!node.isEditing}
          onMouseDown={handleMouseDown}
          onDragStart={handleDragStart}
          onDragEnd={() => {
            // Remove CSS class when drag ends (even if cancelled)
            document.body.classList.remove('dragging')
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={onDrop}
          data-folder-id={node.id}
          onClick={handleClick}
        >
            <span className="cursor-pointer flex-1 flex items-center gap-2" onDoubleClick={handleDoubleClick}>
            <FileIcon fileName={node.name} isFolder={true} isExpanded={isExpanded} />
            <span className="text-sm text-gray-900 dark:text-gray-100">{node.name}</span>
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="btn-clean opacity-60 hover:opacity-100 transition-opacity bg-transparent flex items-center justify-center -mr-2"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <FontAwesomeIcon 
              icon={isExpanded ? faChevronUp : faChevronDown} 
              className="text-gray-600 dark:text-gray-400 text-xs hover:text-gray-900 dark:hover:text-gray-200" 
            />
          </button>
        </div>
        {isExpanded && node.children && (
          <div 
            className="ml-4 mt-1"
            onDrop={onDrop}
            onDragOver={handleDragOver}
            data-folder-id={node.id}
          >
            {              node.children.map((child) => (
                <FileNode 
                  key={child.id} 
                  node={child}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  dragOverFolderId={dragOverFolderId}
                  onDrop={onDrop}
                  updateNodeName={updateNodeName}
                  deleteNode={deleteNode}
                  setNodeEditing={setNodeEditing}
                  isSelected={selectedIds.has(child.id)}
                  onSelect={onSelect}
                  selectedIds={selectedIds}
                  dropPosition={dropPosition}
                  setDropPosition={setDropPosition}
                  draggedNodeId={draggedNodeId}
                  siblingNodes={node.children}
                  isDraggingExternal={isDraggingExternal}
                />
              ))}
          </div>
        )}
        {showDropIndicatorAfter && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 translate-y-full z-10" />
        )}
      </div>
    )
  }
  
  if (node.isEditing) {
    return (
      <div className="mb-1">
          <div className="flex items-center gap-2 px-1 py-0 rounded h-6">
            <FileIcon fileName={node.name} isFolder={false} />
            <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className="px-1 py-0 text-sm border border-blue-500 dark:border-blue-400 rounded bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            autoFocus
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          />
        </div>
      </div>
    )
  }
  
  const showDropIndicatorBefore = dropPosition?.nodeId === node.id && dropPosition?.position === 'before'
  const showDropIndicatorAfter = dropPosition?.nodeId === node.id && dropPosition?.position === 'after'
  
  return (
    <div 
      className="mb-1 relative" 
      data-node-id={node.id}
    >
      {showDropIndicatorBefore && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 -translate-y-full z-10" />
      )}
      <div 
        className={`flex items-center gap-2 px-1 py-0 rounded cursor-move h-6 ${isSelected ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        draggable
        onMouseDown={handleMouseDown}
        onDragStart={handleDragStart}
        onDragEnd={() => {
          // Remove CSS class when drag ends (even if cancelled)
          document.body.classList.remove('dragging')
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDoubleClick={handleFileDoubleClick}
        onClick={handleClick}
      >
        <FileIcon fileName={node.name} isFolder={false} />
        <span className="text-sm text-gray-900 dark:text-gray-100">{node.name}</span>
      </div>
      {showDropIndicatorAfter && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 translate-y-full z-10" />
      )}
    </div>
  )
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

function getFileLanguage(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1) return 'text'
  
  const extension = fileName.substring(lastDot + 1).toLowerCase()
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'react',
    'ts': 'typescript',
    'tsx': 'react',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'c',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'md': 'markdown',
    'txt': 'text',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
  }
  return languageMap[extension] || extension
}

function generateStructuredOutput(nodes: FSNode[]): string {
  let output = ''
  
  // First, generate folder structure
  const folderStructure: string[] = []
  const files: Array<{ path: string[], name: string, content: string }> = []
  
  function traverseStructure(node: FSNode, path: string[], indent: string = '') {
    if (node.type === 'folder') {
      // Root folders don't need |-- prefix, nested ones do
      const displayName = path.length === 0 ? node.name : `${indent}|-- ${node.name}`
      folderStructure.push(displayName)
      
      if (node.children && node.children.length > 0) {
        const newIndent = indent + (path.length === 0 ? '' : '  ')
        const newPath = [...path, node.name]
        node.children.forEach((child) => {
          traverseStructure(child, newPath, newIndent)
        })
      }
    } else {
      files.push({
        path: path,
        name: node.name,
        content: node.content || ''
      })
    }
  }
  
  nodes.forEach((node) => {
    traverseStructure(node, [], '')
  })
  
  // Add folder structure to output
  if (folderStructure.length > 0) {
    output += 'FOLDER STRUCTURE:\n'
    output += folderStructure.join('\n')
    output += '\n\n'
  }
  
  // Add files with contents
  if (files.length > 0) {
    output += 'FILES:\n'
    output += '='.repeat(80) + '\n\n'
    
    files.forEach((file, index) => {
      const language = getFileLanguage(file.name)
      
      output += `${file.name} (${language})\n`
      output += '-'.repeat(80) + '\n'
      output += file.content
      output += '\n'
      
      if (index < files.length - 1) {
        output += '\n' + '='.repeat(80) + '\n\n'
      }
    })
  }
  
  return output
}

export default function App() {
  const nodes = useFSStore(s => s.nodes)
  const addNodes = useFSStore(s => s.addNodes)
  const addNodesToFolder = useFSStore(s => s.addNodesToFolder)
  const createFolderForEditing = useFSStore(s => s.createFolderForEditing)
  const updateNodeName = useFSStore(s => s.updateNodeName)
  const setNodeEditing = useFSStore(s => s.setNodeEditing)
  const deleteNode = useFSStore(s => s.deleteNode)
  const deleteNodes = useFSStore(s => s.deleteNodes)
  const moveNodeToFolder = useFSStore(s => s.moveNodeToFolder)
  const moveNodeToPosition = useFSStore(s => s.moveNodeToPosition)
  const updateFileContent = useFSStore(s => s.updateFileContent)
  const [isDragging, setIsDragging] = useState(false)
  const [fsAPIAvailable, setFsAPIAvailable] = useState(false)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<{ nodeId: string, position: 'before' | 'after' } | null>(null)
  const [isDraggingExternal, setIsDraggingExternal] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if dark mode is already set
    return document.documentElement.classList.contains('dark')
  })
  const [copySuccess, setCopySuccess] = useState(false)
  
  // Toggle dark mode class on html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])
  
  // Get flat list of all visible node IDs in order (traverses all nodes recursively)
  const getAllNodeIdsFlat = useCallback((nodes: FSNode[]): string[] => {
    const ids: string[] = []
    const traverse = (nodeList: FSNode[]) => {
      nodeList.forEach(node => {
        ids.push(node.id)
        if (node.type === 'folder' && node.children) {
          traverse(node.children)
        }
      })
    }
    traverse(nodes)
    return ids
  }, [])

  // Global dragOver handler to prevent cursor from ever going to disabled mode
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      // Always prevent default and set dropEffect to move
      // This ensures cursor never shows as disabled/not-allowed
      // Don't stop propagation - let child handlers still process
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
    }
    
    const handleGlobalDragEnter = (e: DragEvent) => {
      // Also handle dragEnter to set cursor early
      // Don't stop propagation - let child handlers still process
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
    }
    
    const handleGlobalDrop = (e: DragEvent) => {
      // Prevent default drop behavior globally
      e.preventDefault()
    }
    
    // Add listeners to document to catch ALL drag events
    // Use capture phase to ensure we catch everything first
    document.addEventListener('dragenter', handleGlobalDragEnter, true)
    document.addEventListener('dragover', handleGlobalDragOver, true)
    document.addEventListener('drop', handleGlobalDrop, true)
    
    return () => {
      document.removeEventListener('dragenter', handleGlobalDragEnter, true)
      document.removeEventListener('dragover', handleGlobalDragOver, true)
      document.removeEventListener('drop', handleGlobalDrop, true)
    }
  }, [])
  
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
  
  // Extract all file paths from nodes recursively
  const getAllFilePaths = useCallback((nodes: FSNode[]): string[] => {
    const paths: string[] = []
    const traverse = (nodeList: FSNode[]) => {
      nodeList.forEach(node => {
        if (node.type === 'file' && node.filePath) {
          paths.push(node.filePath)
        }
        if (node.children) {
          traverse(node.children)
        }
      })
    }
    traverse(nodes)
    return paths
  }, [])
  
  // Track which files are currently being watched
  const watchedFilesRef = React.useRef<Set<string>>(new Set())
  
  // Register/unregister file watchers when nodes change
  useEffect(() => {
    if (!fsAPIAvailable || !window.fsAPI?.watchFile) return
    
    const filePaths = getAllFilePaths(nodes)
    const currentWatched = new Set(filePaths)
    
    // Watch new files that aren't being watched yet
    filePaths.forEach(filePath => {
      if (!watchedFilesRef.current.has(filePath)) {
        window.fsAPI.watchFile(filePath).catch(err => {
          console.error(`Error watching file ${filePath}:`, err)
        })
        watchedFilesRef.current.add(filePath)
      }
    })
    
    // Unwatch files that are no longer in the tree
    const filesToUnwatch: string[] = []
    watchedFilesRef.current.forEach(filePath => {
      if (!currentWatched.has(filePath)) {
        filesToUnwatch.push(filePath)
      }
    })
    
    filesToUnwatch.forEach(filePath => {
      if (window.fsAPI?.unwatchFile) {
        window.fsAPI.unwatchFile(filePath).catch(err => {
          console.error(`Error unwatching file ${filePath}:`, err)
        })
        watchedFilesRef.current.delete(filePath)
      }
    })
  }, [nodes, fsAPIAvailable, getAllFilePaths])
  
  // Listen for file change events
  useEffect(() => {
    if (!fsAPIAvailable || !window.fsAPI?.onFileChanged) return
    
    const handleFileChanged = (data: { filePath: string, content: string }) => {
      updateFileContent(data.filePath, data.content)
    }
    
    window.fsAPI.onFileChanged(handleFileChanged)
    
    return () => {
      if (window.fsAPI?.removeFileChangedListener) {
        window.fsAPI.removeFileChangedListener()
      }
    }
  }, [fsAPIAvailable, updateFileContent])
  
  const handleDrop = async(e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setIsDraggingExternal(false)
    
    // Remove CSS class that forces move cursor
    document.body.classList.remove('dragging')
    
    // Check if this is an internal drag (moving a node)
    const draggedId = e.dataTransfer?.getData('application/x-node-id')
    if (draggedId) {
      // Save dropPosition before clearing state
      const currentDropPosition = dropPosition
      
      // Clear state
      setDraggedNodeId(null)
      setDragOverFolderId(null)
      setDropPosition(null)
      
      // If dropPosition was set, use position-based insertion
      if (currentDropPosition) {
        // If trying to move before/after itself, do nothing (already in correct position)
        if (currentDropPosition.nodeId === draggedId) {
          // Item is already at the target position, no need to move
          return
        }
        moveNodeToPosition(draggedId, currentDropPosition.nodeId, currentDropPosition.position)
      } else {
        // Otherwise, use folder-based insertion
        const targetFolderId = e.currentTarget.dataset.folderId || null
        if (draggedId !== targetFolderId) {
          moveNodeToFolder(draggedId, targetFolderId)
        }
      }
      return
    }

    setDragOverFolderId(null)
    setDropPosition(null)
    setIsDraggingExternal(false)

    if (!window.fsAPI) {
      console.error('fsAPI is not available. Make sure the preload script is loaded.')
      return
    }

    // External file drop (VS Code/File Explorer)
    const targetFolderId = e.currentTarget.dataset.folderId || null

    // First, check for text/plain data (VS Code/Cursor provides file paths as text)
    const textData = e.dataTransfer?.getData('text/plain');
    if (textData && textData.trim().length > 0) {
      // VS Code provides file paths, one per line if multiple files
      const paths = textData.split(/\r?\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      if (paths.length > 0) {
          try {
          const dataSource = await window.fsAPI.parseDroppedPaths(paths);
          if (targetFolderId) {
            // Add to specific folder
            addNodesToFolder(dataSource, targetFolderId)
          } else {
            addNodes(dataSource)
          }
          return;
        } catch (error) {
          console.error('Error processing dropped paths from text:', error)
        }
      }
    }

    // Fallback to File objects (File Explorer)
    const items = e.dataTransfer?.items;
    const files = e.dataTransfer?.files;
    
    if (items && items.length > 0) {
      try {
        const file = files?.[0] as File;
        if (!file) return;
        
        const filepath = window.fsAPI.getFilePath(file);
        const dataSource = await window.fsAPI.parseDroppedPaths([filepath]);
        if (targetFolderId) {
          addNodesToFolder(dataSource, targetFolderId)
        } else {
        addNodes(dataSource)
        }
      } catch (error) {
        console.error('Error processing dropped file:', error)
      }
    } else if (files && files.length > 0) {
      try {
        const filepath = window.fsAPI.getFilePath(files[0] as File);
        console.log("filepath: ", filepath);
        const dataSource = await window.fsAPI.parseDroppedPaths([filepath]);
        if (targetFolderId) {
          addNodesToFolder(dataSource, targetFolderId)
        } else {
        addNodes(dataSource)
        }
      } catch (error) {
        console.error('Error processing dropped file:', error)
      }
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // ALWAYS prevent default and set dropEffect FIRST - this is critical for cursor consistency
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // Check if this is an external file drag (not internal node drag)
    const hasExternalFiles = e.dataTransfer?.types?.some(type => 
      type === 'Files' || type === 'text/plain' || type === 'application/x-moz-file'
    ) && !e.dataTransfer?.getData('application/x-node-id')
    
    if (hasExternalFiles) {
      // External files being dragged - show visual feedback
      setIsDragging(true)
      setIsDraggingExternal(true)
      
      // Handle drop position indicators for external files too
      const container = e.currentTarget as HTMLElement
      const mouseY = e.clientY
      
      if (nodes.length > 0) {
        const firstNodeElement = container.querySelector('[data-node-id]') as HTMLElement
        if (firstNodeElement) {
          const firstNodeRect = firstNodeElement.getBoundingClientRect()
          if (mouseY < firstNodeRect.top) {
            setDropPosition({ nodeId: nodes[0].id, position: 'before' })
            return
          }
        }
        
        const rootNodeElements: HTMLElement[] = []
        nodes.forEach(node => {
          const element = container.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement
          if (element) {
            rootNodeElements.push(element)
          }
        })
        
        if (rootNodeElements.length > 0) {
          let lastElement = rootNodeElements[0]
          let maxBottom = lastElement.getBoundingClientRect().bottom
          
          rootNodeElements.forEach(el => {
            const rect = el.getBoundingClientRect()
            if (rect.bottom > maxBottom) {
              maxBottom = rect.bottom
              lastElement = el
            }
          })
          
          const lastNodeRect = lastElement.getBoundingClientRect()
          if (mouseY > lastNodeRect.bottom) {
            const lastNodeId = lastElement.getAttribute('data-node-id')
            if (lastNodeId) {
              setDropPosition({ nodeId: lastNodeId, position: 'after' })
              return
            }
          }
        }
      }
    } else {
      setIsDraggingExternal(false)
    }
    
    // Only handle position indicators if we're dragging a node (not external files)
    if (!draggedNodeId) {
      return
    }
    
    e.stopPropagation()
    
    // Check if dragging over empty space (not over any item)
    const container = e.currentTarget as HTMLElement
    const mouseY = e.clientY
    
    // If dragging in empty space above or below items
    if (nodes.length > 0) {
      // Find first root-level node element
      const firstNodeElement = container.querySelector('[data-node-id]') as HTMLElement
      if (firstNodeElement) {
        const firstNodeRect = firstNodeElement.getBoundingClientRect()
        // If mouse is above the first item, show indicator before first item
        if (mouseY < firstNodeRect.top) {
          setDropPosition({ nodeId: nodes[0].id, position: 'before' })
          return
        }
      }
      
      // Find last root-level node element (need to traverse to find the actual last one)
      // Get all root-level node elements
      const rootNodeElements: HTMLElement[] = []
      nodes.forEach(node => {
        const element = container.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement
        if (element) {
          rootNodeElements.push(element)
        }
      })
      
      if (rootNodeElements.length > 0) {
        // Find the bottommost element
        let lastElement = rootNodeElements[0]
        let maxBottom = lastElement.getBoundingClientRect().bottom
        
        rootNodeElements.forEach(el => {
          const rect = el.getBoundingClientRect()
          if (rect.bottom > maxBottom) {
            maxBottom = rect.bottom
            lastElement = el
          }
        })
        
        const lastNodeRect = lastElement.getBoundingClientRect()
        if (mouseY > lastNodeRect.bottom) {
          const lastNodeId = lastElement.getAttribute('data-node-id')
          if (lastNodeId) {
            setDropPosition({ nodeId: lastNodeId, position: 'after' })
            return
          }
        }
      }
    }
    
    // Otherwise, let individual items handle the drag over
  }, [draggedNodeId, nodes, setDropPosition])
  
  const clear = useFSStore(s => s.clear)
  const handleCreateFolder = () => {
    createFolderForEditing()
  }
  
  const handleClear = () => {
    setShowConfirmDialog(true)
  }
  
  const handleConfirmClear = () => {
    // Unwatch all files before clearing
    if (window.fsAPI?.unwatchFile) {
      const filePaths = getAllFilePaths(nodes)
      filePaths.forEach(filePath => {
        window.fsAPI.unwatchFile(filePath).catch(err => {
          console.error(`Error unwatching file ${filePath}:`, err)
        })
      })
    }
    watchedFilesRef.current.clear()
    clear()
    setShowConfirmDialog(false)
  }
  
  const handleCancelClear = () => {
    setShowConfirmDialog(false)
  }
  
  const handleCopyToClipboard = async () => {
    if (nodes.length === 0) return
    
    const structuredOutput = generateStructuredOutput(nodes)
    try {
      await navigator.clipboard.writeText(structuredOutput)
      setCopySuccess(true)
      setTimeout(() => {
        setCopySuccess(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }
  
  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const allIds = getAllNodeIdsFlat(nodes)
    const currentIndex = allIds.indexOf(id)
    
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle selection
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(id)) {
          newSet.delete(id)
        } else {
          newSet.add(id)
        }
        return newSet
      })
      setLastSelectedIndex(currentIndex)
    } else if (e.shiftKey && lastSelectedIndex !== null) {
      // Shift+Click: Range selection
      const start = Math.min(lastSelectedIndex, currentIndex)
      const end = Math.max(lastSelectedIndex, currentIndex)
      const rangeIds = allIds.slice(start, end + 1)
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        rangeIds.forEach(rangeId => newSet.add(rangeId))
        return newSet
      })
    } else {
      // Regular click: Single selection
      setSelectedIds(new Set([id]))
      setLastSelectedIndex(currentIndex)
    }
  }
  
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    
    // Unwatch files that are being deleted
    const idsToDelete = Array.from(selectedIds)
    const findNodeById = (id: string, nodeList: FSNode[]): FSNode | null => {
      for (const node of nodeList) {
        if (node.id === id) return node
        if (node.children) {
          const found = findNodeById(id, node.children)
          if (found) return found
        }
      }
      return null
    }
    
    const extractFilePaths = (node: FSNode): string[] => {
      const paths: string[] = []
      if (node.type === 'file' && node.filePath) {
        paths.push(node.filePath)
      }
      if (node.children) {
        node.children.forEach(child => {
          paths.push(...extractFilePaths(child))
        })
      }
      return paths
    }
    
    idsToDelete.forEach(id => {
      const node = findNodeById(id, nodes)
      if (node) {
        const filePaths = extractFilePaths(node)
        filePaths.forEach(filePath => {
          if (window.fsAPI?.unwatchFile) {
            window.fsAPI.unwatchFile(filePath).catch(err => {
              console.error(`Error unwatching file ${filePath}:`, err)
            })
          }
        })
      }
    })
    
    deleteNodes(idsToDelete)
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
  }

  // const handleCopyMarkdown = useCallback(() => {
  //   const markdown = generateMarkdown(nodes)
  //   navigator.clipboard.writeText(markdown)
  //   alert('Copied to clipboard!')
  // }, [nodes])

  return (
    <div
      className="h-full w-full flex flex-col bg-white dark:bg-gray-900"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      data-folder-id={null}
    >
      {/* Toolbar */}
      <div 
        className="flex items-center justify-between px-2 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 ml-[1px]">FILES</span>
        <div className="flex items-center gap-0 mr-[1px]">
          <button
            onClick={handleCreateFolder}
            className="btn-clean p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="New Folder"
          >
            <FontAwesomeIcon icon={faFolderPlus} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm" />
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="btn-clean p-0.5 opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Delete Selected"
          >
            <FontAwesomeIcon icon={faTrash} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm" />
          </button>
          <button
            onClick={handleClear}
            className="btn-clean p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Clear All"
          >
            <FontAwesomeIcon icon={faRotateRight} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm" />
          </button>
          <button
            onClick={handleCopyToClipboard}
            disabled={nodes.length === 0}
            className="btn-clean p-0.5 opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Copy All to Clipboard"
          >
            <FontAwesomeIcon icon={copySuccess ? faCheck : faCopy} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm" />
          </button>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="ml-2 flex items-center">
            <Switch
              onChange={(checked) => setIsDarkMode(checked)}
              checked={isDarkMode}
              onColor="#374151"
              offColor="#D1D5DB"
              onHandleColor="#ffffff"
              offHandleColor="#ffffff"
              handleDiameter={12}
              uncheckedIcon={false}
              checkedIcon={false}
              boxShadow="0px 1px 3px rgba(0, 0, 0, 0.2)"
              activeBoxShadow="0px 1px 3px rgba(0, 0, 0, 0.2)"
              height={14}
              width={28}
              className="react-switch"
              checkedHandleIcon={null}
              uncheckedHandleIcon={null}
            />
          </div>
        </div>
      </div>
      <div 
        className="overflow-auto flex-1 w-full p-[14px] min-h-0 no-scrollbar"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={(e) => {
          // Clear drop position and dragging state when leaving the container
          if (e.currentTarget === e.target) {
            setDropPosition(null)
            setIsDragging(false)
            setIsDraggingExternal(false)
          }
        }}
        onDragEnter={(e) => {
          // Detect external files on drag enter
          const hasExternalFiles = e.dataTransfer?.types?.some(type => 
            type === 'Files' || type === 'text/plain' || type === 'application/x-moz-file'
          ) && !e.dataTransfer?.getData('application/x-node-id')
          
          if (hasExternalFiles) {
            setIsDragging(true)
            setIsDraggingExternal(true)
          }
        }}
        data-folder-id={null}
        onClick={(e) => {
          // Clear selection when clicking on empty space
          if (e.target === e.currentTarget) {
            setSelectedIds(new Set())
            setLastSelectedIndex(null)
          }
        }}
      >
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className={`text-sm font-medium transition-colors ${
              isDragging 
                ? 'text-blue-500 dark:text-blue-400' 
                : 'text-gray-300 dark:text-gray-600'
            }`}>
              DROP FILES HERE
            </div>
          </div>
        ) : (
            nodes.map(n => (
              <FileNode 
                key={n.id} 
                node={n}
                onDragStart={setDraggedNodeId}
                onDragOver={setDragOverFolderId}
                dragOverFolderId={dragOverFolderId}
                onDrop={handleDrop}
                updateNodeName={updateNodeName}
                deleteNode={deleteNode}
                setNodeEditing={setNodeEditing}
                isSelected={selectedIds.has(n.id)}
                onSelect={handleSelect}
                selectedIds={selectedIds}
                dropPosition={dropPosition}
                setDropPosition={setDropPosition}
                draggedNodeId={draggedNodeId}
                siblingNodes={nodes}
                isDraggingExternal={isDraggingExternal}
              />
            ))
        )}
      </div>
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Clear All Files"
        message="Are you sure you want to clear all files and folders?"
        confirmText="Clear"
        cancelText="Cancel"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
    </div>
  )
}
