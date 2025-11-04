import { create } from 'zustand'

export type FSNode = {
  id: string
  name: string
  type: 'file' | 'folder'
  content?: string
  children?: FSNode[]
}

interface FSStore {
  nodes: FSNode[]
  addNodes: (newNodes: FSNode[]) => void
  removeNode: (id: string) => void
  clear: () => void
}

export const useFSStore = create<FSStore>((set) => ({
  nodes: [],
  addNodes: (newNodes) => set(s => ({ nodes: [...s.nodes, ...newNodes] })),
  removeNode: (id) => set(s => ({ nodes: s.nodes.filter(n => n.id !== id) })),
  clear: () => set({ nodes: [] })
}))