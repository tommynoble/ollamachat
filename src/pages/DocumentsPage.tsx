import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { FileText, Upload, Trash2, RefreshCw } from 'lucide-react'

interface Document {
  file_name: string
  file_path: string
  chunks_count: number
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  const loadDocuments = async () => {
    try {
      const docs = await (window as any).ipcRenderer?.invoke('rag-list-documents')
      setDocuments(docs || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const handleFileUpload = async () => {
    try {
      setIsUploading(true)
      setUploadMessage('')

      // Open file dialog
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.pdf,.txt,.md,.json,.py,.js,.ts,.tsx,.jsx'
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        const filePath = (file as any).path
        
        setUploadMessage(`Uploading ${file.name}...`)
        
        const result = await (window as any).ipcRenderer?.invoke('rag-upload-document', filePath)
        
        if (result.success) {
          setUploadMessage(`✅ ${result.message}`)
          loadDocuments()
        } else {
          setUploadMessage(`❌ Error: ${result.error}`)
        }
        
        setIsUploading(false)
        
        // Clear message after 5 seconds
        setTimeout(() => setUploadMessage(''), 5000)
      }

      input.click()
    } catch (error) {
      console.error('Error uploading document:', error)
      setUploadMessage('❌ Upload failed')
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return

    try {
      const result = await (window as any).ipcRenderer?.invoke('rag-delete-document', fileName)
      
      if (result.success) {
        setUploadMessage(`✅ ${result.message}`)
        loadDocuments()
      } else {
        setUploadMessage(`❌ Error: ${result.error}`)
      }

      setTimeout(() => setUploadMessage(''), 5000)
    } catch (error) {
      console.error('Error deleting document:', error)
      setUploadMessage('❌ Delete failed')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Document Library</h2>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2"
              onClick={loadDocuments}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button 
              onClick={handleFileUpload}
              disabled={isUploading}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          Upload documents to chat with them using RAG (Retrieval-Augmented Generation)
        </p>
        
        {uploadMessage && (
          <div className={`mt-4 p-3 rounded-lg ${
            uploadMessage.startsWith('✅') 
              ? 'bg-green-500/20 border border-green-500/50 text-green-700' 
              : 'bg-red-500/20 border border-red-500/50 text-red-700'
          }`}>
            {uploadMessage}
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-6">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No documents uploaded yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload PDFs, text files, or code files to chat with them
            </p>
            <Button onClick={handleFileUpload} className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Your First Document
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.file_name}
                className="border border-border rounded-lg p-4 bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold truncate">{doc.file_name}</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDocument(doc.file_name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {doc.chunks_count} chunks
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {doc.file_path}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="border-t border-border bg-card p-4">
        <div className="text-sm text-muted-foreground">
          <p className="font-semibold mb-1">Supported file types:</p>
          <p>PDF, TXT, MD, JSON, Python, JavaScript, TypeScript, JSX, TSX</p>
        </div>
      </div>
    </div>
  )
}
