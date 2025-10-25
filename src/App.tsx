import { useState } from 'react'
import { Button } from './components/ui/button'
import ChatWindow from './components/ChatWindow'
import Sidebar from './components/Sidebar'
import { MessageCircle } from 'lucide-react'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [currentModel, setCurrentModel] = useState('llama2')

  const handleSendMessage = (message: string) => {
    setMessages([...messages, { role: 'user', content: message }])
    // TODO: Send to Ollama API
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
        <ChatWindow messages={messages} onSendMessage={handleSendMessage} />
      </div>
    </div>
  )
}
