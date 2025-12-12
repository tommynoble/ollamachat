import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from './ui/button'
import { Send, Paperclip, FileText, Image, StopCircle, Copy, Check, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: string
  content?: string
  isStreaming?: boolean
  createdAt?: string
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
  onStop?: () => void
}

// Helper: Auto-close dangling code fences
function closeDanglingFence(s: string) {
  const fences = (s.match(/```/g) || []).length
  return fences % 2 === 1 ? s + '\n```' : s
}

// Helper: Remove <think>...</think> blocks (including partial ones during streaming)
function filterThinking(content?: string) {
  if (!content) return ''
  return content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim()
}

// Helper: ensure numbered lists stay on new lines as text streams in
function normalizeListPrefixes(content: string) {
  return content.replace(/([^\n])(\d+\.\s)/g, '$1\n$2')
}

// Helper: soften streaming artifacts by collapsing repeated words/numbers/punctuation
function sanitizeStreaming(content: string) {
  // Collapse consecutive repeated words (case-insensitive)
  const parts = content.split(/\s+/)
  const deduped: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i]
    const prev = deduped[deduped.length - 1]
    if (prev && prev.toLowerCase() === w.toLowerCase()) continue
    deduped.push(w)
  }

  let cleaned = deduped.join(' ')
  // Collapse repeated punctuation
  cleaned = cleaned.replace(/([.,;:!?])\1+/g, '$1')
  // Collapse repeated list numbers like "1. 1."
  cleaned = cleaned.replace(/\b(\d+)\.(\s*\1\.)+/g, '$1.')
  // Normalize spacing
  cleaned = cleaned.replace(/\s{3,}/g, ' ')
  return cleaned.trim()
}

// Code block component with copy button
const CodeBlock = ({ children, className, ...props }: any) => {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return match ? (
    <div className="relative group rounded-md overflow-hidden my-4 border border-border">
      <div className="flex justify-between items-center px-4 py-2 bg-muted/80 text-xs text-muted-foreground border-b border-border">
        <span>{match[1]}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-4 bg-muted/30 overflow-x-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </div>
    </div>
  ) : (
    <code className="px-1.5 py-0.5 rounded bg-muted/40 font-mono text-sm" {...props}>
      {children}
    </code>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const rawContent = message.content ?? ''
  const filteredContent = filterThinking(rawContent)
  const isThinking = !!message.isStreaming && rawContent.length > 0 && filteredContent.length === 0
  const baseContent = filteredContent.length > 0 ? filteredContent : rawContent
  const normalizedContent = normalizeListPrefixes(baseContent)
  const finalContent = closeDanglingFence(normalizedContent)
  const streamingContent = sanitizeStreaming(finalContent)
  // Keep lists stable and render streaming text without markdown to avoid janky partial formatting
  const displayContent = message.isStreaming ? streamingContent : finalContent

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${message.role === 'user' ? 'mb-2' : 'mb-4'}`}>
      <div
        className={`px-4 py-2 ${message.role === 'user'
          ? 'bg-card text-card-foreground border border-border rounded-2xl max-w-lg'
          : 'max-w-3xl text-foreground rounded-2xl px-2 py-1'
          }`}
      >
        {message.role === 'user' ? (
          <div className="text-base leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-invert max-w-none text-base">
            {isThinking ? (
              <div className="flex items-center gap-2 text-muted-foreground italic py-1">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="animate-pulse">Thinking...</span>
              </div>
            ) : message.isStreaming ? (
              displayContent.trim().length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground italic py-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="animate-pulse">Thinking...</span>
                </div>
              ) : (
                <div className="leading-relaxed whitespace-pre-wrap text-muted-foreground/90">
                  {displayContent}
                </div>
              )
            ) : displayContent.trim().length === 0 ? (
              <div className="text-muted-foreground italic text-sm py-1 opacity-50">
                (No response)
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  h1: (p) => <h1 className="text-5xl font-semibold mt-6 mb-4 pb-2 border-b border-border text-primary" {...p} />,
                  h2: (p) => <h2 className="text-4xl font-semibold mt-6 mb-4 pb-3 border-b border-border text-primary" {...p} />,
                  h3: (p) => <h3 className="text-2xl font-medium mt-6 mb-4 pb-3 border-b border-border text-primary/90" {...p} />,
                  ul: (p) => <ul className="list-disc pl-6 space-y-3 my-3" {...p} />,
                  ol: (p) => <ol className="list-decimal pl-6 space-y-3 my-3" {...p} />,
                  li: (p) => <li className="leading-relaxed pl-1 pb-2" {...p} />,
                  strong: (p) => <strong className="font-bold text-foreground" {...p} />,
                  p: (p) => <p className="leading-relaxed mb-3 pb-3 border-b border-border/40 last:border-b-0" {...p} />,
                  code: CodeBlock,
                  pre: (p) => <pre className="not-prose" {...p} />, // Remove prose styling from pre to let CodeBlock handle it
                }}
              >
                {closeDanglingFence(displayContent)}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatWindow({ messages, onSendMessage, isLoading = false, onStop }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    // Only scroll if we are near the bottom or it's a new message
    // For now, simple auto-scroll is fine
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
      const uploadResult = await (window as any).ipcRenderer?.invoke('rag-upload-document', filePath)

      if (uploadResult.success) {
        loadDocuments()
        console.log('Image uploaded:', filePath)
        alert(`✅ Image uploaded: ${uploadResult.file_name}\n\nNote: Image support is coming soon.`)
      } else {
        console.error('Image upload failed:', uploadResult.error)
        alert(`❌ Upload failed: ${uploadResult.error}`)
      }
      setIsUploadingDoc(false)
    } catch (error) {
      console.error('Error uploading image:', error)
      setIsUploadingDoc(false)
    }
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed) {
      onSendMessage(trimmed)
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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0 bg-muted/20">
        {/* Messages Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 ml-[100px] mr-[30px]">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="text-muted-foreground">
                <p className="text-lg font-medium mb-2">Welcome to Ollama Chat</p>
                <p className="text-sm">Start a conversation by typing a message below</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))
          )}

          {isLoading && (
            <div className="flex justify-start items-center gap-3 ml-2">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-1"
              >
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-bounce"></div>
              </motion.div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-4 relative">
        {/* Attachments Popup */}
        {showDocuments && (
          <div className="absolute bottom-full right-4 mb-2 bg-card border border-border rounded-xl shadow-lg p-4 w-72 z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Attachments</h3>
              <button
                onClick={() => setShowDocuments(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

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
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 bg-muted/30 border border-border rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-all"
            rows={1}
            style={{ minHeight: '46px', maxHeight: '120px' }}
            disabled={isLoading}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => setShowDocuments(!showDocuments)}
              disabled={isLoading}
              variant="outline"
              size="icon"
              title="Documents"
              className={documents.length > 0 ? 'bg-primary/10 border-primary/20' : ''}
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            {isLoading && onStop ? (
              <Button
                onClick={onStop}
                variant="destructive"
                size="icon"
                title="Stop Generating"
              >
                <StopCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!input.trim()}
                size="icon"
                className={input.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
