import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Send, Paperclip, FileText, Image as ImageIcon } from 'lucide-react'

interface Message {
  role: string
  content: string
}

interface Document {
  file_name: string
  file_path: string
  chunks_count: number
}

interface ChatWindowProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
}

export default function ChatWindow({ messages, onSendMessage, isLoading = false }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const docs = await (window as any).ipcRenderer?.invoke('rag-list-documents')
      setDocuments(docs || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  const handleUploadDocument = async () => {
    try {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = '.pdf,.txt,.md,.json,.py,.js,.ts,.tsx,.jsx'
      
      fileInput.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        setIsUploadingDoc(true)
        const filePath = (file as any).path
        const result = await (window as any).ipcRenderer?.invoke('rag-upload-document', filePath)
        
        if (result.success) {
          loadDocuments()
        }
        setIsUploadingDoc(false)
      }

      fileInput.click()
    } catch (error) {
      console.error('Error uploading document:', error)
    }
  }

  const handleUploadImage = async () => {
    try {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      
      fileInput.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        setIsUploadingDoc(true)
        // For now, just add image as a message
        const reader = new FileReader()
        reader.onload = (event) => {
          const imageData = event.target?.result as string
          // You can send this to the model or display it
          console.log('Image uploaded:', file.name)
          setIsUploadingDoc(false)
        }
        reader.readAsDataURL(file)
      }

      fileInput.click()
    } catch (error) {
      console.error('Error uploading image:', error)
    }
  }

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input)
      setInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium mb-2">Welcome to Ollama Chat</p>
              <p className="text-sm">Start a conversation by typing a message below</p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground px-4 py-2 rounded-lg">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-4 relative">
        {/* Attachments Popup - Right Side */}
        {showDocuments && (
          <div className="absolute bottom-full right-4 mb-2 bg-card border border-border rounded-lg shadow-lg p-4 w-72 z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Attachments</h3>
              <button
                onClick={() => setShowDocuments(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Upload Options */}
            <div className="space-y-2 mb-4">
              <Button
                onClick={handleUploadDocument}
                disabled={isUploadingDoc}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
              >
                <FileText className="w-4 h-4" />
                {isUploadingDoc ? 'Uploading...' : 'Upload Document'}
              </Button>
              <Button
                onClick={handleUploadImage}
                disabled={isUploadingDoc}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
              >
                <ImageIcon className="w-4 h-4" />
                Upload Image
              </Button>
            </div>

            {/* Documents List */}
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Documents</p>
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No documents yet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.file_name}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded hover:bg-muted cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">{doc.chunks_count} chunks</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Controls */}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="flex-1 px-4 py-2 bg-input border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2 self-end">
            <Button
              onClick={() => setShowDocuments(!showDocuments)}
              disabled={isLoading}
              variant="outline"
              size="icon"
              title="Documents"
              className={documents.length > 0 ? 'bg-primary/10' : ''}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
