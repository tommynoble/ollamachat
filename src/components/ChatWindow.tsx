import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from './ui/button'
import { Send, Paperclip, FileText, Image } from 'lucide-react'

interface Message {
  role: string
  content: string
  isStreaming?: boolean
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

// Typewriter animation component using Framer Motion
function TypewriterMessage({ message }: { message: Message }) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (message.role === 'user') {
      // User messages display instantly
      setDisplayedContent(message.content)
      setIsComplete(true)
      return
    }

    // Assistant messages have typewriter effect with Motion
    let index = 0
    setDisplayedContent('')
    setIsComplete(false)

    const interval = setInterval(() => {
      if (index < message.content.length) {
        // Handle emojis and multi-byte characters properly
        const char = message.content[index]
        // Check if it's a surrogate pair (emoji)
        if (char.charCodeAt(0) >= 0xD800 && char.charCodeAt(0) <= 0xDBFF) {
          // It's a high surrogate, include the next character too
          setDisplayedContent(message.content.substring(0, index + 2))
          index += 2
        } else {
          setDisplayedContent(message.content.substring(0, index + 1))
          index++
        }
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, 15) // Adjust speed here (lower = faster)

    return () => clearInterval(interval)
  }, [message])

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${message.role === 'user' ? 'mb-2' : 'mb-4'}`}>
      <div
        className={`px-4 py-2 ${
          message.role === 'user'
            ? 'bg-card text-white rounded-2xl max-w-lg opacity-90'
            : 'max-w-2xl text-foreground rounded-2xl px-6 py-3'
        }`}
      >
        <div className="text-base whitespace-pre-wrap leading-8 space-y-4">
          {displayedContent}
          {!isComplete && message.role === 'assistant' && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block"
            >
              ▌
            </motion.span>
          )}
        </div>
      </div>
    </div>
  )
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
      setIsUploadingDoc(true)
      
      // Use Electron's file dialog
      const result = await (window as any).ipcRenderer?.invoke('open-file-dialog', {
        filters: [
          { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'json', 'csv', 'py', 'js', 'ts', 'tsx', 'jsx'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (result.canceled || !result.filePaths?.[0]) {
        setIsUploadingDoc(false)
        return
      }

      const filePath = result.filePaths[0]
      const uploadResult = await (window as any).ipcRenderer?.invoke('rag-upload-document', filePath)
      
      if (uploadResult.success) {
        loadDocuments()
        console.log('✅ Document uploaded:', uploadResult.message)
      } else {
        console.error('Upload failed:', uploadResult.error)
        alert(`❌ Upload failed: ${uploadResult.error}`)
      }
      setIsUploadingDoc(false)
    } catch (error) {
      console.error('Error uploading document:', error)
      setIsUploadingDoc(false)
    }
  }

  const handleUploadImage = async () => {
    try {
      setIsUploadingDoc(true)
      
      // Use Electron's file dialog
      const result = await (window as any).ipcRenderer?.invoke('open-file-dialog', {
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      
      if (result.canceled || !result.filePaths?.[0]) {
        setIsUploadingDoc(false)
        return
      }

      const filePath = result.filePaths[0]
      
      // For images, we'll store them as documents for now
      // In the future, this could be enhanced for vision models
      const uploadResult = await (window as any).ipcRenderer?.invoke('rag-upload-document', filePath)
      
      if (uploadResult.success) {
        console.log('Image uploaded:', filePath)
        loadDocuments()
        alert(`✅ Image uploaded: ${uploadResult.file_name}\n\nNote: Image support is coming soon. For now, images are stored but not processed.`)
      } else {
        console.error('Image upload failed:', uploadResult.error)
        alert(`❌ Upload failed: ${uploadResult.error}\n\nNote: Images need OCR support. This feature is coming soon!`)
      }
      setIsUploadingDoc(false)
    } catch (error) {
      console.error('Error uploading image:', error)
      setIsUploadingDoc(false)
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
            <TypewriterMessage key={idx} message={msg} />
          ))
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex justify-start"
          >
            <motion.div
              className="bg-muted text-muted-foreground px-4 py-2 rounded-lg"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <p className="text-sm">
                Thinking
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ...
                </motion.span>
              </p>
            </motion.div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-4 relative">
        {/* Attachments Popup - Right Side */}
        {showDocuments && (
          <div className="absolute bottom-full right-4 mb-2 bg-card border border-border rounded-3xl shadow-lg p-4 w-72 z-50">
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
                <Image className="w-4 h-4" />
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
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 bg-input border border-border rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
