import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Plus, Trash2, Copy } from 'lucide-react'

interface ComparisonResult {
  model: string
  response: string
  time: number
}

export default function ComparisonPage() {
  const [input, setInput] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>(['llama2', 'mistral'])
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [isComparing, setIsComparing] = useState(false)

  const availableModels = ['llama2', 'mistral', 'neural-chat', 'phi', 'orca']

  const handleAddModel = (model: string) => {
    if (!selectedModels.includes(model) && selectedModels.length < 5) {
      setSelectedModels([...selectedModels, model])
    }
  }

  const handleRemoveModel = (model: string) => {
    setSelectedModels(selectedModels.filter(m => m !== model))
  }

  const handleCompare = async () => {
    if (!input.trim() || selectedModels.length === 0) return

    setIsComparing(true)
    setResults([])

    // Simulate comparison (will be connected to IPC later)
    for (const model of selectedModels) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setResults(prev => [...prev, {
        model,
        response: `Response from ${model}: This is a simulated response for the prompt "${input.substring(0, 30)}..."`,
        time: Math.random() * 2 + 0.5
      }])
    }

    setIsComparing(false)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Input Section */}
      <div className="border-b border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Enter Your Prompt</h3>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question to compare how different models respond..."
          className="w-full h-24 p-4 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Model Selection */}
      <div className="border-b border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Select Models to Compare</h3>
        
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-3">Selected: {selectedModels.length}/5</p>
          <div className="flex flex-wrap gap-2">
            {selectedModels.map(model => (
              <div
                key={model}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1 rounded-full"
              >
                <span className="text-sm font-medium">{model}</span>
                <button
                  onClick={() => handleRemoveModel(model)}
                  className="hover:opacity-80"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableModels.map(model => (
            <Button
              key={model}
              variant={selectedModels.includes(model) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleAddModel(model)}
              disabled={!selectedModels.includes(model) && selectedModels.length >= 5}
            >
              {model}
            </Button>
          ))}
        </div>
      </div>

      {/* Compare Button */}
      <div className="border-b border-border bg-card p-6">
        <Button
          onClick={handleCompare}
          disabled={!input.trim() || selectedModels.length === 0 || isComparing}
          className="w-full gap-2"
        >
          {isComparing ? 'Comparing...' : 'Compare Models'}
        </Button>
      </div>

      {/* Results Section */}
      <div className="flex-1 overflow-y-auto p-6">
        {results.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p>Responses will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{result.model}</h4>
                    <p className="text-xs text-muted-foreground">Response time: {result.time.toFixed(2)}s</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{result.response}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
