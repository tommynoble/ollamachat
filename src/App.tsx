import { useState, useEffect } from 'react'
import ChatWindow from './components/ChatWindow'
import { SidebarProvider } from './components/ui/sidebar'
import { AppSidebar } from './components/AppSidebar'
import ModelsPage from './pages/ModelsPage'
import LearningPage from './pages/LearningPage'
import AnalyzerPage from './pages/AnalyzerPage'
import CoderPage from './pages/CoderPage'
import SettingsPage from './pages/SettingsPage'
import ComparisonPage from './pages/ComparisonPage'
import OnlinePage from './pages/OnlinePage'
import { MessageCircle, Moon, Sun, BookOpen, Code2, GitCompare } from 'lucide-react'
import { Button } from './components/ui/button'
import { SidebarTrigger } from './components/ui/sidebar'

// Get ipcRenderer from the preload script
const ipcRenderer = (window as any).ipcRenderer || null

export default function App() {
  const [currentPage, setCurrentPage] = useState('chat')
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [currentModel, setCurrentModel] = useState('llama2')
  const [isLoading, setIsLoading] = useState(false)
  const [downloadedModels, setDownloadedModels] = useState<string[]>([])
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Load theme preference from localStorage, default to dark
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      return saved ? saved === 'dark' : true
    }
    return true
  })
  const [ollamaStatus, setOllamaStatus] = useState<'running' | 'offline' | 'checking'>('checking')

  useEffect(() => {
    // Apply theme to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    // Save preference
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    // Load available models on startup
    loadModels()
    
    // Fetch downloaded models
    const fetchDownloadedModels = async () => {
      if (!ipcRenderer) return
      try {
        const result = await ipcRenderer.invoke('get-downloaded-models')
        if (result?.success && result.models) {
          const modelNames = result.models.map((m: any) => {
            // Handle both string and object formats
            if (typeof m === 'string') {
              return m.split(':')[0] // Remove variant like :latest
            } else if (typeof m === 'object' && m.name) {
              return m.name.split(':')[0] // Extract name from object
            }
            return null
          }).filter((m: any) => m !== null) // Remove nulls
          
          setDownloadedModels(modelNames)
          // Set current model to first downloaded model if available
          if (modelNames.length > 0 && !modelNames.includes(currentModel)) {
            setCurrentModel(modelNames[0])
          }
        }
      } catch (error) {
        console.error('Error fetching downloaded models:', error)
      }
    }
    
    // Auto-start Ollama if external drive is configured
    const autoStartOllama = async () => {
      if (!ipcRenderer) return
      try {
        const result = await ipcRenderer.invoke('check-external-drive-config')
        if (result?.configured) {
          console.log('🚀 Auto-starting Ollama with configured external drive...')
          console.log('📁 Models path:', result.path)
          // Kill any existing Ollama process first
          await ipcRenderer.invoke('kill-ollama')
          // Then start with correct env var
          await ipcRenderer.invoke('start-ollama-with-drive', result.path)
        }
      } catch (error) {
        console.error('Error auto-starting Ollama:', error)
      }
    }
    
    // Check Ollama status periodically
    const checkOllamaStatus = async () => {
      if (!ipcRenderer) return
      try {
        const result = await ipcRenderer.invoke('check-ollama-status')
        setOllamaStatus(result.running ? 'running' : 'offline')
      } catch (error) {
        setOllamaStatus('offline')
      }
    }
    
    // Auto-start on app startup
    autoStartOllama()
    fetchDownloadedModels()
    
    checkOllamaStatus()
    const interval = setInterval(checkOllamaStatus, 2000) // Check every 2 seconds for faster feedback
    const modelsInterval = setInterval(fetchDownloadedModels, 3000) // Refresh models every 3 seconds
    return () => {
      clearInterval(interval)
      clearInterval(modelsInterval)
    }
  }, [])

  const loadModels = async () => {
    if (!ipcRenderer) {
      console.warn('IPC not available, using default model')
      return
    }
    try {
      const result = await ipcRenderer.invoke('get-models')
      if (result.success && result.models.length > 0) {
        setCurrentModel(result.models[0])
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const handleSendMessage = async (message: string) => {
    setMessages([...messages, { role: 'user', content: message }])
    setIsLoading(true)

    if (!ipcRenderer) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'IPC not available' }])
      setIsLoading(false)
      return
    }

    try {
      const result = await ipcRenderer.invoke('chat-message', message, currentModel)
      console.log('Chat response:', result)
      if (result.success) {
        console.log('Adding response:', result.response)
        setMessages(prev => [...prev, { role: 'assistant', content: result.response }])
      } else {
        console.error('Chat error:', result.error)
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${result.error}` }])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error communicating with Ollama' }])
    } finally {
      setIsLoading(false)
    }
  }

  const PageHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
    <div className="border-b border-border bg-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-6 h-6" />
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        {/* Ollama Status Indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            ollamaStatus === 'running' 
              ? 'bg-green-500 animate-pulse' 
              : ollamaStatus === 'checking'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
          }`} />
          <span className={`text-xs font-medium ${
            ollamaStatus === 'running'
              ? 'text-green-600'
              : ollamaStatus === 'checking'
              ? 'text-yellow-600'
              : 'text-red-600'
          }`}>
            {ollamaStatus === 'running' ? '🟢 Online' : ollamaStatus === 'checking' ? '🟡 Checking...' : '🔴 Offline'}
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
              <div className="flex items-center gap-2">
                <SidebarTrigger className="mr-2" />
                <MessageCircle className="w-6 h-6" />
                <h1 className="text-xl font-semibold">Ollama Chat</h1>
              </div>
              <div className="flex items-center gap-4">
                {/* Model Selector - Only Downloaded Models */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Model:</label>
                  {downloadedModels.length > 0 ? (
                    <select
                      value={currentModel}
                      onChange={(e) => {
                        setCurrentModel(e.target.value)
                        setMessages([]) // Clear chat when switching models
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

                {/* Ollama Status Indicator */}
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    ollamaStatus === 'running' 
                      ? 'bg-green-500 animate-pulse' 
                      : ollamaStatus === 'checking'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                  }`} />
                  <span className={`text-xs font-medium ${
                    ollamaStatus === 'running'
                      ? 'text-green-600'
                      : ollamaStatus === 'checking'
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {ollamaStatus === 'running' ? '🟢 Online' : ollamaStatus === 'checking' ? '🟡 Checking...' : '🔴 Offline'}
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
            <ChatWindow messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
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
        return (
          <>
            <PageHeader title="AI Learning Center" icon={BookOpen} />
            <LearningPage />
          </>
        )
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
      default:
        return (
          <>
            <PageHeader title="Ollama Chat" icon={MessageCircle} />
            <ChatWindow messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
          </>
        )
    }
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background">
        {/* Sidebar */}
        <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {renderPage()}
        </div>
      </div>
    </SidebarProvider>
  )
}
