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
import { MessageCircle, Moon, Sun, BarChart3, BookOpen, Zap, Code2, Settings, GitCompare, Cloud } from 'lucide-react'
import { Button } from './components/ui/button'

// Get ipcRenderer from the preload script
const ipcRenderer = (window as any).ipcRenderer || null

export default function App() {
  const [currentPage, setCurrentPage] = useState('chat')
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [currentModel, setCurrentModel] = useState('llama2')
  const [isLoading, setIsLoading] = useState(false)
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
    
    checkOllamaStatus()
    const interval = setInterval(checkOllamaStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
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
      if (result.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.response }])
      } else {
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
          <span className="text-xs font-medium text-muted-foreground">
            {ollamaStatus === 'running' ? 'Ollama Running' : ollamaStatus === 'checking' ? 'Checking...' : 'Ollama Offline'}
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
            <PageHeader title="Ollama Chat" icon={MessageCircle} />
            <ChatWindow messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
          </>
        )
      case 'comparison':
        return (
          <>
            <PageHeader title="Model Comparison" icon={GitCompare} />
            <ComparisonPage />
          </>
        )
      case 'models':
        return (
          <>
            <PageHeader title="Model Management" icon={BarChart3} />
            <ModelsPage />
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
        return (
          <>
            <PageHeader title="Document Analysis" icon={Zap} />
            <AnalyzerPage />
          </>
        )
      case 'coder':
        return (
          <>
            <PageHeader title="Code Assistant" icon={Code2} />
            <CoderPage />
          </>
        )
      case 'settings':
        return (
          <>
            <PageHeader title="Settings" icon={Settings} />
            <SettingsPage />
          </>
        )
      case 'online':
        return (
          <>
            <PageHeader title="Cloud Models" icon={Cloud} />
            <OnlinePage />
          </>
        )
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
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        {/* Sidebar */}
        <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderPage()}
        </div>
      </div>
    </SidebarProvider>
  )
}
