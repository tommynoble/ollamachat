import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import ChatWindow from './components/ChatWindow'
import { ChatHistorySidebar } from './components/ChatHistorySidebar'
import { SidebarProvider } from './components/ui/sidebar'
import { AppSidebar } from './components/AppSidebar'
import ModelsPage from './pages/ModelsPage'
import LearningPage from './pages/LearningPage'
import AnalyzerPage from './pages/AnalyzerPage'
import CoderPage from './pages/CoderPage'
import SettingsPage from './pages/SettingsPage'
import ComparisonPage from './pages/ComparisonPage'
import OnlinePage from './pages/OnlinePage'
import DocumentsPage from './pages/DocumentsPage'
import TrainModelPage from './pages/TrainModelPage'
import { MessageCircle, Moon, Sun, Code2, GitCompare } from 'lucide-react'
import { Button } from './components/ui/button'

// Get ipcRenderer from the preload script
const ipcRenderer = (window as any).ipcRenderer || null

export default function App() {
  const [currentPage, setCurrentPage] = useState('chat')
  const [messages, setMessages] = useState<Array<{ role: string; content: string; isStreaming?: boolean; createdAt?: string }>>([])
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [downloadedModels, setDownloadedModels] = useState<string[]>([])
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; updatedAt: string; createdAt?: string; model: string }>>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      return saved ? saved === 'dark' : true
    }
    return true
  })
  const [ollamaStatus, setOllamaStatus] = useState<'running' | 'offline' | 'checking'>('checking')
  const [showHistory, setShowHistory] = useState(true)

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    loadModels()
    loadSessions()

    const fetchDownloadedModels = async () => {
      if (!ipcRenderer) return
      try {
        const result = await ipcRenderer.invoke('get-downloaded-models')
        if (result?.success && result.models) {
          const modelNames = result.models
            .map((m: any) => {
              if (typeof m === 'string') {
                return m
              } else if (typeof m === 'object' && m.name) {
                return m.name
              }
              return null
            })
            .filter((m: any) => m !== null)

          setDownloadedModels(modelNames)
          // Only set a default if none is selected
          if (!currentModel && modelNames.length > 0) {
            setCurrentModel(modelNames[0])
          }
        } else {
          // Clear stale pills if we can't fetch
          setDownloadedModels([])
        }
      } catch (error) {
        console.error('Error fetching downloaded models:', error)
        setDownloadedModels([])
      }
    }

    const autoStartOllama = async () => {
      if (!ipcRenderer) return
      try {
        const result = await ipcRenderer.invoke('check-external-drive-config')
        if (result?.configured) {
          console.log('🚀 Auto-starting Ollama with configured external drive...')
          console.log('📁 Models path:', result.path)
          await ipcRenderer.invoke('kill-ollama')
          await ipcRenderer.invoke('start-ollama-with-drive', result.path)
        }
      } catch (error) {
        console.error('Error auto-starting Ollama:', error)
      }
    }

    void autoStartOllama

    const checkOllamaStatus = async () => {
      if (!ipcRenderer) return
      try {
        const result = await ipcRenderer.invoke('check-ollama-status')
        setOllamaStatus(result.running ? 'running' : 'offline')
      } catch (error) {
        setOllamaStatus('offline')
      }
    }

    // Skip auto-starting Ollama with external drive; rely on user-launched instance
    fetchDownloadedModels()

    checkOllamaStatus()
    const interval = setInterval(checkOllamaStatus, 2000)
    const modelsInterval = setInterval(fetchDownloadedModels, 3000)
    return () => {
      clearInterval(interval)
      clearInterval(modelsInterval)
    }
  }, [])

  const loadSessions = async () => {
    if (!ipcRenderer) return
    try {
      const result = await ipcRenderer.invoke('get-chat-history')
      if (result.success) {
        setSessions(result.sessions)
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  const loadSessionById = async (sessionId: string) => {
    if (!ipcRenderer) return
    try {
      const result = await ipcRenderer.invoke('load-chat-session', sessionId)
      if (result.success && result.session) {
        const sessionModel = (result.session.model && result.session.model.trim()) ? result.session.model.trim() : currentModel
        setCurrentSessionId(sessionId)
        setMessages(result.session.messages || [])
        setCurrentModel(sessionModel || currentModel)
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setCurrentSessionId(null)
    setIsLoading(false)
    if (currentRequestIdRef.current && ipcRenderer) {
      ipcRenderer.invoke('abort-chat', currentRequestIdRef.current)
    }
    if (ipcRenderer) {
      ipcRenderer.invoke('clear-conversation', currentModel)
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    await loadSessionById(sessionId)
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('delete-chat-session', sessionId)
    loadSessions()
    if (currentSessionId === sessionId) {
      handleNewChat()
    }
  }

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('rename-chat-session', { sessionId, title: newTitle })
    loadSessions()
  }

  const loadModels = async () => {
    if (!ipcRenderer) {
      console.warn('IPC not available, using default model')
      return
    }
    try {
      const result = await ipcRenderer.invoke('get-models')
      if (result.success && result.models.length > 0 && !currentModel) {
        setCurrentModel(result.models[0])
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  // Track current request ID for cancellation
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)

  useEffect(() => {
    currentRequestIdRef.current = currentRequestId
  }, [currentRequestId])

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // Buffer streaming chunks to avoid excessive renders and memory churn
  const bufferedContentRef = useRef<string>('')
  const flushTimeoutRef = useRef<number | null>(null)

  const flushPendingChunks = () => {
    if (!bufferedContentRef.current) return
    const chunk = bufferedContentRef.current
    bufferedContentRef.current = ''
    flushTimeoutRef.current = null

    setMessages(prev => {
      const updated = [...prev]
      const lastMsg = updated[updated.length - 1]

      if (!lastMsg || lastMsg.role !== 'assistant') {
        updated.push({ role: 'assistant', content: chunk, isStreaming: true })
        return updated
      }

      updated[updated.length - 1] = {
        ...lastMsg,
        content: (lastMsg.content || '') + chunk,
        isStreaming: true
      }
      return updated
    })
  }


  // Attach streaming listeners once to avoid missing early events
  useEffect(() => {
    if (!ipcRenderer) return

    const handleStart = (_event: any, data: any) => {
      console.log('🚀 Stream started:', data)
      if (!data?.requestId) return
      currentRequestIdRef.current = data.requestId
      setCurrentRequestId(data.requestId)
      bufferedContentRef.current = ''
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current)
        flushTimeoutRef.current = null
      }
    }

    const handleChunk = (_event: any, data: any) => {
      if (!data?.requestId || data.requestId !== currentRequestIdRef.current) return
      if (!data.content) return
      // Ignore chunks during streaming; only display final response when stream ends
      // This avoids token-fragment duplication and shows clean final output
    }

    const handleEnd = (_event: any, data: any) => {
      console.log('✅ Stream ended:', data)
      if (!data?.requestId || data.requestId !== currentRequestIdRef.current) return
      flushPendingChunks()
      if (data.fullResponse) {
        setMessages(prev => {
          if (prev.length === 0) return prev
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg.role === 'assistant') {
            updated[updated.length - 1] = { ...lastMsg, content: data.fullResponse, isStreaming: false }
          }
          saveCurrentSession(updated)
          return updated
        })
      } else {
        setMessages(prev => {
          if (prev.length === 0) return prev
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]
          if (lastMsg.role === 'assistant') {
            updated[updated.length - 1] = { ...lastMsg, isStreaming: false }
          }
          saveCurrentSession(updated)
          return updated
        })
      }
      setIsLoading(false)
      setCurrentRequestId(null)
      currentRequestIdRef.current = null
    }

    const handleError = (_event: any, data: any) => {
      console.error('❌ Stream error:', data)
      if (!data?.requestId || data.requestId !== currentRequestIdRef.current) return
      flushPendingChunks()
      setMessages(prev => {
        if (prev.length === 0) return prev
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg.role === 'assistant') {
          updated[updated.length - 1] = {
            ...lastMsg,
            content: lastMsg.content || `Error: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error) || 'Unknown error'}`,
            isStreaming: false
          }
        }
        saveCurrentSession(updated)
        return updated
      })
      setIsLoading(false)
      setCurrentRequestId(null)
      currentRequestIdRef.current = null
    }

    ipcRenderer.on('chat-stream-start', handleStart)
    ipcRenderer.on('chat-stream-chunk', handleChunk)
    ipcRenderer.on('chat-stream-end', handleEnd)
    ipcRenderer.on('chat-stream-error', handleError)

    return () => {
      ipcRenderer.removeListener('chat-stream-start', handleStart)
      ipcRenderer.removeListener('chat-stream-chunk', handleChunk)
      ipcRenderer.removeListener('chat-stream-end', handleEnd)
      ipcRenderer.removeListener('chat-stream-error', handleError)
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current)
      }
      bufferedContentRef.current = ''
    }
  }, [])

  const handleStopGeneration = async () => {
    if (currentRequestId && ipcRenderer) {
      await ipcRenderer.invoke('abort-chat', currentRequestId)
      setIsLoading(false)
      setCurrentRequestId(null)
      currentRequestIdRef.current = null

      setMessages(prev => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          newMessages[newMessages.length - 1] = { ...lastMsg, isStreaming: false }
        }
        return newMessages
      })
    }
  }

  const handleSendMessage = async (message: string) => {
    const modelToSend = (currentModel || '').trim()
    if (!modelToSend) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No model selected. Download or select a model to chat.', isStreaming: false }])
      return
    }
    if (modelToSend.toLowerCase() === 'unknown') {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Selected chat has no model. Please pick a model from the dropdown.', isStreaming: false }])
      return
    }
    const timestamp = new Date().toISOString()
    const newMessages = [...messages, { role: 'user', content: message, createdAt: timestamp }]
    setMessages(newMessages)
    setIsLoading(true)

    if (!ipcRenderer) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'IPC not available', isStreaming: false }])
      setIsLoading(false)
      return
    }

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])
      const result = await ipcRenderer.invoke('chat-message', message, modelToSend, currentSessionId || 'default')

      if (result.success) {
        setCurrentRequestId(result.requestId)
        currentRequestIdRef.current = result.requestId
        saveCurrentSession(newMessages)
      } else {
        console.error('Chat error:', result.error)
        setMessages(prev => {
          const updated = [...prev]
          updated.pop()
          updated.push({ role: 'assistant', content: `Error: ${result.error}` })
          return updated
        })
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => {
        const updated = [...prev]
        updated.pop()
        updated.push({ role: 'assistant', content: 'Error communicating with Ollama' })
        return updated
      })
      setIsLoading(false)
    }
  }

  const saveCurrentSession = async (msgs: typeof messages) => {
    if (!ipcRenderer || msgs.length === 0) return
    let sessionId = currentSessionIdRef.current
    let createdAt = new Date().toISOString()
    if (!sessionId) {
      sessionId = uuidv4()
      setCurrentSessionId(sessionId)
      currentSessionIdRef.current = sessionId
    } else {
      const existing = sessions.find(s => s.id === sessionId)
      createdAt = existing?.createdAt || createdAt
    }

    const title = msgs[0]?.content?.slice(0, 60) || 'New Chat'
    const payload = {
      id: sessionId,
      title,
      createdAt,
      updatedAt: new Date().toISOString(),
      model: currentModel || 'unknown',
      messages: msgs
    }

    try {
      await ipcRenderer.invoke('save-chat-session', payload)
      loadSessions()
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  const PageHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
    <div className="border-b border-border bg-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-6 h-6" />
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${ollamaStatus === 'running'
              ? 'bg-green-500 animate-pulse'
              : ollamaStatus === 'checking'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
              }`}
          />
          <span
            className={`text-xs font-medium ${ollamaStatus === 'running'
              ? 'text-green-600'
              : ollamaStatus === 'checking'
                ? 'text-yellow-600'
                : 'text-red-600'
              }`}
          >
            {ollamaStatus === 'running' ? 'Online' : ollamaStatus === 'checking' ? 'Checking...' : 'Offline'}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="rounded-full"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  )

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return (
          <>
            <div className="border-b border-border bg-card p-4 flex items-center justify-between">
              <div></div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Model:</label>
                  {downloadedModels.length > 0 ? (
                    <select
                      value={currentModel ?? ''}
                      onChange={(e) => {
                        const nextModel = e.target.value
                        setCurrentModel(nextModel)
                        // Lock model per chat: switching models starts a new chat/session.
                        handleNewChat()
                      }}
                      className="px-3 py-1 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {downloadedModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No models downloaded</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${ollamaStatus === 'running'
                      ? 'bg-green-500 animate-pulse'
                      : ollamaStatus === 'checking'
                        ? 'bg-yellow-500 animate-pulse'
                        : 'bg-red-500'
                      }`}
                  />
                  <span
                    className={`text-xs font-medium ${ollamaStatus === 'running'
                      ? 'text-green-600'
                      : ollamaStatus === 'checking'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                      }`}
                  >
                    {ollamaStatus === 'running' ? 'Online' : ollamaStatus === 'checking' ? 'Checking...' : 'Offline'}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="rounded-full"
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
              </div>
            </div>
            <div className="flex flex-1 overflow-hidden relative">
              {showHistory && (
                <div className="w-72 h-full border-r border-border/60 bg-card/30 backdrop-blur-sm">
                  <ChatHistorySidebar
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    onSelectSession={handleSelectSession}
                    onNewChat={handleNewChat}
                    onDeleteSession={handleDeleteSession}
                    onRenameSession={handleRenameSession}
                  />
                </div>
              )}
              <div className="flex-1 flex flex-col">
                <ChatWindow
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  onStop={handleStopGeneration}
                />
              </div>
            </div>
          </>
        )
      case 'models':
        return <ModelsPage />
      case 'comparison':
        return (
          <>
            <PageHeader title="Model Comparison" icon={GitCompare} />
            <ComparisonPage />
          </>
        )
      case 'learning':
        return <LearningPage />
      case 'analyzer':
        return <AnalyzerPage />
      case 'coder':
        return (
          <>
            <PageHeader title="Code Assistant" icon={Code2} />
            <CoderPage />
          </>
        )
      case 'settings':
        return <SettingsPage />
      case 'online':
        return <OnlinePage />
      case 'documents':
        return <DocumentsPage />
      case 'train':
        return <TrainModelPage />
      default:
        return (
          <>
            <PageHeader title="Ollama Chat" icon={MessageCircle} />
            <ChatWindow
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onStop={handleStopGeneration}
            />
          </>
        )
    }
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onToggleHistory={() => setShowHistory(v => !v)}
          historyVisible={showHistory}
        />
        <div className="flex-1 flex flex-col overflow-y-auto">
          {renderPage()}
        </div>
      </div>
    </SidebarProvider>
  )
}
