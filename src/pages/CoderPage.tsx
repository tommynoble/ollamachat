import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Code2, Copy, Play } from 'lucide-react'

export default function CoderPage() {
  const [input, setInput] = useState('')
  const [code, setCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (!input.trim()) return
    
    setIsGenerating(true)
    // TODO: Send to IPC for code generation
    setTimeout(() => {
      setCode(`// Generated code for: ${input}\nfunction example() {\n  console.log('Hello, World!');\n}`)
      setIsGenerating(false)
    }, 1000)
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Code2 className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Code Assistant</h2>
        </div>
        <p className="text-muted-foreground">Generate and review code with AI assistance</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div>
            <label className="block text-sm font-medium mb-2">Describe what you need</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Create a function that sorts an array..."
              className="w-full h-64 p-4 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            
            <div className="flex gap-2 mt-4">
              <Button 
                onClick={handleGenerate}
                disabled={!input.trim() || isGenerating}
                className="flex-1 gap-2"
              >
                <Code2 className="w-4 h-4" />
                Generate Code
              </Button>
              <Button 
                variant="outline"
                disabled={!code}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                Run
              </Button>
            </div>
          </div>

          {/* Code Output Section */}
          <div>
            <label className="block text-sm font-medium mb-2">Generated Code</label>
            <div className="w-full h-64 p-4 border border-border rounded-lg bg-muted/50 font-mono text-sm overflow-y-auto">
              {code ? (
                <pre className="text-foreground">{code}</pre>
              ) : (
                <p className="text-muted-foreground">Generated code will appear here...</p>
              )}
            </div>
            
            {code && (
              <Button 
                variant="outline"
                className="w-full mt-4 gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Code
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
