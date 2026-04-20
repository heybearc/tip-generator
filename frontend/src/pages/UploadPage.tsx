import { useState, useCallback } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface UploadedFile {
  id: string
  filename: string
  file_type: string
  file_size: number
  uploaded_at: string
  status: 'uploading' | 'success' | 'error'
  error?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateFile = (file: File): string | null => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ]
    
    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Please upload Excel (.xlsx), PDF, or Word (.docx) files only.'
    }
    
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return 'File size exceeds 10MB limit.'
    }
    
    return null
  }

  const uploadFile = async (file: File) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    
    setFiles(prev => [...prev, {
      id: tempId,
      filename: file.name,
      file_type: file.type,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
      status: 'uploading'
    }])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(`${API_URL}/api/documents/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setFiles(prev => prev.map(f => 
        f.id === tempId 
          ? { ...response.data, status: 'success' as const }
          : f
      ))
    } catch (error: any) {
      setFiles(prev => prev.map(f => 
        f.id === tempId 
          ? { 
              ...f, 
              status: 'error' as const, 
              error: error.response?.data?.detail || 'Upload failed' 
            }
          : f
      ))
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setIsUploading(true)

    const droppedFiles = Array.from(e.dataTransfer.files)
    
    for (const file of droppedFiles) {
      const error = validateFile(file)
      if (error) {
        alert(error)
        continue
      }
      await uploadFile(file)
    }

    setIsUploading(false)
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    
    setIsUploading(true)
    const selectedFiles = Array.from(e.target.files)
    
    for (const file of selectedFiles) {
      const error = validateFile(file)
      if (error) {
        alert(error)
        continue
      }
      await uploadFile(file)
    }

    setIsUploading(false)
    e.target.value = ''
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-2">Upload Documents</h2>
      <p className="text-gray-600 mb-8">
        Upload your discovery worksheets (Excel), service orders (PDF), or templates (Word)
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold mb-2">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </h3>
        <p className="text-gray-500 mb-4">or</p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept=".xlsx,.pdf,.docx"
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading}
          />
          <span className="px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block">
            Browse Files
          </span>
        </label>
        <p className="text-sm text-gray-500 mt-4">
          Supported formats: Excel (.xlsx), PDF, Word (.docx) • Max 10MB per file
        </p>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Uploaded Files ({files.length})</h3>
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.filename}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {file.status === 'uploading' && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="text-sm">Uploading...</span>
                    </div>
                  )}
                  
                  {file.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  
                  {file.status === 'error' && (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">{file.error}</span>
                    </div>
                  )}
                  
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    disabled={file.status === 'uploading'}
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
