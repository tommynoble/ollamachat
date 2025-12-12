import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Brain, Upload, Play, Loader2 } from 'lucide-react'

export default function TrainModelPage() {
  const [trainingData, setTrainingData] = useState('')
  const [modelName, setModelName] = useState('')
  const [isTraining, setIsTraining] = useState(false)
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [trainingStatus, setTrainingStatus] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setTrainingData(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const handleStartTraining = async () => {
    if (!trainingData.trim() || !modelName.trim()) {
      alert('Please provide training data and model name')
      return
    }

    setIsTraining(true)
    setTrainingStatus('Starting training...')
    setTrainingProgress(0)

    try {
      // TODO: Send to IPC for model training
      // This will be implemented in main.js
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500))
        setTrainingProgress(i)
        setTrainingStatus(`Training progress: ${i}%`)
      }
      setTrainingStatus('Training completed successfully!')
    } catch (error) {
      setTrainingStatus(`Error: ${error}`)
    } finally {
      setIsTraining(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Train Model</h2>
        </div>
        <p className="text-muted-foreground">Fine-tune a model with your own training data</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., ghana-farming-guide"
              className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isTraining}
            />
          </div>

          {/* Training Data Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Training Data</label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-accent/50 transition">
              <input
                type="file"
                accept=".txt,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isTraining}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">TXT, CSV, or JSON files</p>
              </label>
            </div>
            {trainingData && (
              <p className="text-sm text-muted-foreground mt-2">
                ✓ Data loaded ({Math.round(trainingData.length / 1024)} KB)
              </p>
            )}
          </div>

          {/* Training Data Preview */}
          {trainingData && (
            <div>
              <label className="block text-sm font-medium mb-2">Data Preview</label>
              <textarea
                value={trainingData.substring(0, 500)}
                readOnly
                className="w-full h-32 p-4 border border-border rounded-lg bg-muted/50 text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Showing first 500 characters of {trainingData.length} total characters
              </p>
            </div>
          )}

          {/* Training Progress */}
          {isTraining && (
            <div>
              <label className="block text-sm font-medium mb-2">Training Progress</label>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${trainingProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {trainingStatus}
              </p>
            </div>
          )}

          {/* Training Status */}
          {trainingStatus && !isTraining && (
            <div className="p-4 bg-accent/50 rounded-lg border border-border">
              <p className="text-sm">{trainingStatus}</p>
            </div>
          )}

          {/* Start Training Button */}
          <Button
            onClick={handleStartTraining}
            disabled={!trainingData || !modelName || isTraining}
            className="w-full gap-2"
          >
            {isTraining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Training...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Training
              </>
            )}
          </Button>

          {/* Info */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <h3 className="font-medium mb-2">Training Tips:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Prepare training data in TXT, CSV, or JSON format</li>
              <li>• Include diverse examples relevant to your use case</li>
              <li>• Larger datasets produce better results</li>
              <li>• Training may take several minutes depending on data size</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
