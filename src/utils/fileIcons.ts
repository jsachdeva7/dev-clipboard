// Map file extensions to icon file names
const extensionToIcon: Record<string, string> = {
  // JavaScript/TypeScript
  '.js': 'file_type_js',
  '.jsx': 'file_type_reactjs',
  '.ts': 'file_type_typescript',
  '.tsx': 'file_type_reactjs',
  
  // Web
  '.html': 'file_type_html',
  '.css': 'file_type_css',
  '.json': 'file_type_json',
  
  // C/C++
  '.c': 'file_type_c',
  '.cpp': 'file_type_cpp',
  '.cc': 'file_type_cpp',
  '.cxx': 'file_type_cpp',
  '.h': 'file_type_cheader',
  '.hpp': 'file_type_cheader',
  
  // Other languages
  '.py': 'file_type_python',
  '.java': 'file_type_java',
  '.go': 'file_type_go',
  '.rs': 'file_type_rust',
  '.sh': 'file_type_shell',
  '.bash': 'file_type_shell',
  '.zsh': 'file_type_shell',
  
  // Images
  '.png': 'file_type_image',
  '.jpg': 'file_type_image',
  '.jpeg': 'file_type_image',
  '.gif': 'file_type_image',
  '.svg': 'file_type_image',
  '.webp': 'file_type_image',
  '.ico': 'file_type_image',
}

export function getFileIcon(fileName: string, isFolder: boolean = false, isExpanded?: boolean): string | null {
  if (isFolder) {
    return isExpanded ? 'default_folder_opened' : 'default_folder'
  }
  
  // Get file extension
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1) {
    return 'default_file' // No extension, use default file icon
  }
  
  const extension = fileName.substring(lastDot).toLowerCase()
  return extensionToIcon[extension] || 'default_file'
}

export function getFileIconPath(fileName: string, isFolder: boolean = false, isExpanded?: boolean): string {
  const iconName = getFileIcon(fileName, isFolder, isExpanded)
  
  // Vite handles assets - use import.meta.url for proper resolution
  return new URL(`../assets/file type icons/${iconName}.svg`, import.meta.url).href
}
