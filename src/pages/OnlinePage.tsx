import { useState } from 'react'
import { Button } from '../components/ui/button'
import { ChevronDown, Cloud } from 'lucide-react'

export default function OnlinePage() {
  const [selectedModel, setSelectedModel] = useState('')
  const [showMore, setShowMore] = useState(false)

  const mainModels = [
    { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', description: 'Most capable model', price: '$0.03/1K tokens' },
    { id: 'gpt-3.5', name: 'GPT-3.5 Turbo', provider: 'OpenAI', description: 'Fast and efficient', price: '$0.0005/1K tokens' },
    { id: 'claude-3', name: 'Claude 3 Opus', provider: 'Anthropic', description: 'Advanced reasoning', price: '$0.015/1K tokens' },
    { id: 'gemini', name: 'Google Gemini', provider: 'Google', description: 'Multimodal capabilities', price: '$0.001/1K tokens' },
  ]

  const moreModels = [
    { id: 'llama-2', name: 'Llama 2 70B', provider: 'Meta', description: 'Open-source alternative', price: '$0.0008/1K tokens' },
    { id: 'mistral', name: 'Mistral 7B', provider: 'Mistral AI', description: 'Lightweight & fast', price: '$0.0002/1K tokens' },
    { id: 'cohere', name: 'Command R', provider: 'Cohere', description: 'Enterprise-grade', price: '$0.003/1K tokens' },
    { id: 'palm', name: 'PaLM 2', provider: 'Google', description: 'Versatile language model', price: '$0.0015/1K tokens' },
    { id: 'falcon', name: 'Falcon 180B', provider: 'TII', description: 'High-performance open model', price: '$0.0012/1K tokens' },
    { id: 'alpaca', name: 'Alpaca 13B', provider: 'Stanford', description: 'Instruction-tuned model', price: '$0.0003/1K tokens' },
    { id: 'vicuna', name: 'Vicuna 33B', provider: 'LMSYS', description: 'Chat-optimized model', price: '$0.0005/1K tokens' },
    { id: 'orca', name: 'Orca 2', provider: 'Microsoft', description: 'Reasoning-focused model', price: '$0.0008/1K tokens' },
    { id: 'neural', name: 'Neural Chat 7B', provider: 'Intel', description: 'Efficient chat model', price: '$0.0002/1K tokens' },
  ]

  const handleConnect = () => {
    if (selectedModel) {
      console.log(`Connecting to ${selectedModel}`)
      // Handle connection logic here
    }
  }

  const ModelCard = ({ model }: { model: typeof mainModels[0] }) => (
    <div
      onClick={() => setSelectedModel(model.id)}
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
        selectedModel === model.id
          ? 'border-primary bg-primary/10 shadow-lg'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{model.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{model.provider}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{model.description}</p>
          <p className="text-xs font-medium text-primary mt-1">{model.price}</p>
        </div>
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
            selectedModel === model.id
              ? 'bg-primary border-primary'
              : 'border-border'
          }`}
        >
          {selectedModel === model.id && (
            <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Cloud className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Cloud Models</h2>
        </div>
        <p className="text-muted-foreground">Use online AI models instead of local ones</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="w-full">
          {/* Popular Models Section */}
          <div className="mb-8">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Popular Models</h3>
              <p className="text-sm text-muted-foreground mt-1">Choose from the most popular AI models</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {mainModels.map(model => (
                <ModelCard key={model.id} model={model} />
              ))}
            </div>
          </div>

          {/* See More Section */}
          <div className="mb-8">
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-card/50 transition-colors"
            >
              <span className="font-medium">See More Models</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`}
              />
            </button>

            {showMore && (
              <div className="mt-4 max-h-96 overflow-y-auto pr-2">
                <div className="grid grid-cols-3 gap-3">
                  {moreModels.map(model => (
                    <ModelCard key={model.id} model={model} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* API Configuration Section */}
          <div className="mb-6 p-4 rounded-lg bg-card border border-border">
            <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">API Key</label>
                <input
                  type="password"
                  placeholder="Enter your API key"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Connect Button */}
          <Button
            onClick={handleConnect}
            disabled={!selectedModel}
            className="w-full"
          >
            Connect to {selectedModel ? [...mainModels, ...moreModels].find(m => m.id === selectedModel)?.name : 'Model'}
          </Button>
        </div>
      </div>
    </div>
  )
}
