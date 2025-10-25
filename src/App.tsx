import { useState, useEffect } from 'react'
import ChatWindow from './components/ChatWindow'
import Sidebar from './components/Sidebar'
import { MessageCircle } from 'lucide-react'

const { ipcRenderer } = window.require('electron')

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [currentModel, setCurrentModel] = useState('llama2')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load available models on startup
    loadModels()
  }, [])

  const loadModels = async () => {
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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Ollama Chat</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            Model: <span className="font-medium text-foreground">{currentModel}</span>
          </div>
        </div>

        {/* Chat Window */}
        <ChatWindow messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  )
}
