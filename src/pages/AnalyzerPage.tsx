import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Search, FileText, Copy } from 'lucide-react'

export default function AnalyzerPage() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async (type: 'analyze' | 'summarize' | 'extract') => {
    if (!input.trim()) return
    
    setIsAnalyzing(true)
    // TODO: Send to IPC for analysis
    setTimeout(() => {
      setResults(`${type} results for: ${input.substring(0, 50)}...`)
      setIsAnalyzing(false)
    }, 1000)
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Document Analysis</h2>
        </div>
        <p className="text-muted-foreground">Analyze text and extract insights with AI</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div>
            <label className="block text-sm font-medium mb-2">Text to Analyze</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your text here or drag and drop a file..."
              className="w-full h-64 p-4 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            
            <div className="flex gap-2 mt-4">
              <Button 
                onClick={() => handleAnalyze('analyze')}
                disabled={!input.trim() || isAnalyzing}
                className="flex-1 gap-2"
              >
                <Search className="w-4 h-4" />
                Analyze Text
              </Button>
              <Button 
                onClick={() => handleAnalyze('summarize')}
                disabled={!input.trim() || isAnalyzing}
                variant="outline"
                className="flex-1 gap-2"
              >
                <FileText className="w-4 h-4" />
                Summarize
              </Button>
              <Button 
                onClick={() => handleAnalyze('extract')}
                disabled={!input.trim() || isAnalyzing}
                variant="outline"
                className="flex-1 gap-2"
              >
                Extract Points
              </Button>
            </div>
          </div>

          {/* Results Section */}
          <div>
            <label className="block text-sm font-medium mb-2">Analysis Results</label>
            <div className="w-full h-64 p-4 border border-border rounded-lg bg-muted/50 text-foreground overflow-y-auto">
              {results ? (
                <p>{results}</p>
              ) : (
                <p className="text-muted-foreground">Results will appear here...</p>
              )}
            </div>
            
            {results && (
              <Button 
                variant="outline"
                className="w-full mt-4 gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Results
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
