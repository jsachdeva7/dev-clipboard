import { create } from 'zustand'

export type FSNode = {
  id: string
  name: string
  type: 'file' | 'folder'
  content?: string
  filePath?: string
  children?: FSNode[]
  isEditing?: boolean
  isExpanded?: boolean
}

interface FSStore {
  nodes: FSNode[]
  addNodes: (newNodes: FSNode[]) => void
  addNodesToFolder: (newNodes: FSNode[], folderId: string | null) => void
  removeNode: (id: string) => void
  clear: () => void
  createFolder: (name: string) => void
  createFolderForEditing: () => string
  updateNodeName: (id: string, name: string) => void
  setNodeEditing: (id: string, isEditing: boolean) => void
  deleteNode: (id: string) => void
  deleteNodes: (ids: string[]) => void
  moveNodeToFolder: (nodeId: string, targetFolderId: string | null) => void
  moveNodeToPosition: (nodeId: string, targetNodeId: string, position: 'before' | 'after') => void
  findParentNode: (targetNodeId: string, nodes: FSNode[], parent?: FSNode | null) => FSNode | null
  insertNodeAtPosition: (node: FSNode, targetNodeId: string, position: 'before' | 'after', nodes: FSNode[]) => FSNode[]
  findNodeById: (id: string, nodes?: FSNode[]) => FSNode | null
  removeNodeFromTree: (id: string, nodes: FSNode[]) => FSNode[]
  addNodeToFolder: (node: FSNode, folderId: string | null, nodes: FSNode[]) => FSNode[]
  updateFileContent: (filePath: string, content: string) => void
  setNodeExpanded: (id: string, isExpanded: boolean) => void
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useFSStore = create<FSStore>((set, get) => ({
  nodes: [],
  addNodes: (newNodes) => set(s => ({ nodes: [...s.nodes, ...newNodes] })),
  addNodesToFolder: (newNodes, folderId) => {
    let updatedNodes = get().nodes
    newNodes.forEach(node => {
      updatedNodes = get().addNodeToFolder(node, folderId, updatedNodes)
    })
    set({ nodes: updatedNodes })
  },
  removeNode: (id) => set(s => ({ nodes: s.nodes.filter(n => n.id !== id) })),
  clear: () => set({ nodes: [] }),
  
  createFolder: (name) => {
    const newFolder: FSNode = {
      id: generateId(),
      name: name || 'New Folder',
      type: 'folder',
      children: []
    }
    set(s => ({ nodes: [...s.nodes, newFolder] }))
  },
  
  createFolderForEditing: () => {
    const newFolder: FSNode = {
      id: generateId(),
      name: '',
      type: 'folder',
      children: [],
      isEditing: true,
      isExpanded: false  // New folders should start collapsed
    }
    set(s => ({ nodes: [...s.nodes, newFolder] }))
    return newFolder.id
  },
  
  updateNodeName: (id, name) => {
    const updateNode = (nodes: FSNode[]): FSNode[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, name, isEditing: false }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    set(s => ({ nodes: updateNode(s.nodes) }))
  },
  
  setNodeEditing: (id, isEditing) => {
    const updateNode = (nodes: FSNode[]): FSNode[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, isEditing }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    set(s => ({ nodes: updateNode(s.nodes) }))
  },
  
  deleteNode: (id) => {
    set(s => ({ nodes: get().removeNodeFromTree(id, s.nodes) }))
  },
  
  deleteNodes: (ids: string[]) => {
    let updatedNodes = get().nodes
    ids.forEach((id: string) => {
      updatedNodes = get().removeNodeFromTree(id, updatedNodes)
    })
    set({ nodes: updatedNodes })
  },
  
  findNodeById: (id, nodes) => {
    const searchNodes = nodes || get().nodes
    for (const node of searchNodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = get().findNodeById(id, node.children)
        if (found) return found
      }
    }
    return null
  },
  
  removeNodeFromTree: (id, nodes) => {
    return nodes.filter(node => {
      if (node.id === id) return false
      if (node.children) {
        node.children = get().removeNodeFromTree(id, node.children)
      }
      return true
    })
  },
  
  addNodeToFolder: (node, folderId, nodes) => {
    if (folderId === null) {
      return [...nodes, node]
    }
    
    return nodes.map(n => {
      if (n.id === folderId && n.type === 'folder') {
        return {
          ...n,
          children: [...(n.children || []), node]
        }
      }
      if (n.children) {
        return {
          ...n,
          children: get().addNodeToFolder(node, folderId, n.children)
        }
      }
      return n
    })
  },
  
  moveNodeToFolder: (nodeId, targetFolderId) => {
    const node = get().findNodeById(nodeId)
    if (!node) return
    
    // Remove node from current location
    const updatedNodes = get().removeNodeFromTree(nodeId, get().nodes)
    
    // Add node to target folder
    const finalNodes = get().addNodeToFolder(node, targetFolderId, updatedNodes)
    
    set({ nodes: finalNodes })
  },
  
  findParentNode: (targetNodeId, nodes, parent = null) => {
    for (const node of nodes) {
      if (node.id === targetNodeId) {
        return parent
      }
      if (node.children) {
        const found = get().findParentNode(targetNodeId, node.children, node)
        if (found !== null) return found
      }
    }
    return null
  },
  
  insertNodeAtPosition: (node, targetNodeId, position, nodes) => {
    const targetIndex = nodes.findIndex(n => n.id === targetNodeId)
    if (targetIndex === -1) {
      // Target not found in this level, search children
      return nodes.map(n => {
        if (n.children) {
          return {
            ...n,
            children: get().insertNodeAtPosition(node, targetNodeId, position, n.children)
          }
        }
        return n
      })
    }
    
    // Found target, insert at position
    const newNodes = [...nodes]
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    newNodes.splice(insertIndex, 0, node)
    return newNodes
  },
  
  moveNodeToPosition: (nodeId, targetNodeId, position) => {
    const node = get().findNodeById(nodeId)
    if (!node) return
    
    // Remove node from current location
    let updatedNodes = get().removeNodeFromTree(nodeId, get().nodes)
    
    // Find parent of target node
    const parentNode = get().findParentNode(targetNodeId, updatedNodes)
    
    if (parentNode) {
      // Target is inside a folder
      const updateParent = (nodes: FSNode[]): FSNode[] => {
        return nodes.map(n => {
          if (n.id === parentNode.id && n.children) {
            return {
              ...n,
              children: get().insertNodeAtPosition(node, targetNodeId, position, n.children)
            }
          }
          if (n.children) {
            return { ...n, children: updateParent(n.children) }
          }
          return n
        })
      }
      updatedNodes = updateParent(updatedNodes)
    } else {
      // Target is at root level
      updatedNodes = get().insertNodeAtPosition(node, targetNodeId, position, updatedNodes)
    }
    
    set({ nodes: updatedNodes })
  },
  
  updateFileContent: (filePath, content) => {
    // Normalize path for comparison (Windows backslashes to forward slashes)
    const normalizedFilePath = filePath.replace(/\\/g, '/')
    const updateNode = (nodes: FSNode[]): FSNode[] => {
      return nodes.map(node => {
        const normalizedNodePath = node.filePath?.replace(/\\/g, '/')
        if (normalizedNodePath === normalizedFilePath && node.type === 'file') {
          return { ...node, content }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    set(s => ({ nodes: updateNode(s.nodes) }))
  },
  
  setNodeExpanded: (id, isExpanded) => {
    const updateNode = (nodes: FSNode[]): FSNode[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, isExpanded }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    set(s => ({ nodes: updateNode(s.nodes) }))
  }
}))