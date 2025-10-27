import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Download, Trash2, FolderOpen, BarChart3 } from 'lucide-react'

export default function ModelsPage() {
  const [models, setModels] = useState<any[]>([])
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set())
  const [storageLocation, setStorageLocation] = useState('Local')
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set())
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    loadModels()
    checkStorageLocation()
    getDownloadedModels()
    
    // Auto-refresh downloaded models every 2 seconds to detect new downloads
    const interval = setInterval(getDownloadedModels, 2000)
    return () => clearInterval(interval)
  }, [])

  const loadModels = async () => {
    // Load available models from Ollama
    setModels([
      // Qwen models
      { name: 'qwen3-coder:30b', size: '19GB', description: 'Code generation specialist' },
      { name: 'qwen3:30b', size: '19GB', description: 'Qwen 3 - 30B parameters' },
      { name: 'qwen3:8b', size: '5.2GB', description: 'Qwen 3 - 8B parameters' },
      { name: 'qwen3:4b', size: '2.6GB', description: 'Qwen 3 - 4B parameters (lightweight)' },
      
      // Gemma models
      { name: 'gemma3:27b', size: '16GB', description: 'Gemma 3 - 27B parameters' },
      { name: 'gemma3:12b', size: '7.2GB', description: 'Gemma 3 - 12B parameters' },
      { name: 'gemma3:4b', size: '2.5GB', description: 'Gemma 3 - 4B parameters' },
      { name: 'gemma3:1b', size: '1.2GB', description: 'Gemma 3 - 1B parameters (ultra-lightweight)' },
      
      // GPT-OSS models
      { name: 'gpt-oss:120b-cloud', size: '70GB', description: 'GPT-OSS 120B (cloud)' },
      { name: 'gpt-oss:20b-cloud', size: '12GB', description: 'GPT-OSS 20B (cloud)' },
      { name: 'gpt-oss:120b', size: '70GB', description: 'GPT-OSS 120B' },
      { name: 'gpt-oss:20b', size: '12GB', description: 'GPT-OSS 20B' },
      
      // Llama models
      { name: 'llama2', size: '3.8GB', description: 'Meta Llama 2 - General purpose' },
      
      // Deepseek models
      { name: 'deepseek-v3:671b-cloud', size: '400GB', description: 'Deepseek V3 671B (cloud)' },
      { name: 'deepseek-r1:8b', size: '4.7GB', description: 'Deepseek R1 - 8B parameters' },
      
      // Mistral models
      { name: 'mistral', size: '4.1GB', description: 'Mistral - Fast and efficient' },
      
      // Other models
      { name: 'neural-chat', size: '3.9GB', description: 'Neural Chat - Optimized for chat' },
      { name: 'dolphin-mixtral', size: '26GB', description: 'Dolphin Mixtral - Powerful multi-expert' },
      { name: 'orca-mini', size: '1.3GB', description: 'Orca Mini - Lightweight' },
      { name: 'glm-4.6:cloud', size: '28GB', description: 'GLM 4.6 (cloud)' },
      { name: 'codellama', size: '3.8GB', description: 'Code Llama - Code generation' },
      { name: 'phi3', size: '2.2GB', description: 'Phi 3 - Efficient small model' },
    ])
  }

  const checkStorageLocation = async () => {
    // Check from IPC
    try {
      const result = await (window as any).ipcRenderer?.invoke('check-external-drive-config')
      if (result?.configured) {
        setStorageLocation(`External Drive (${result.path})`)
      } else {
        setStorageLocation('Local Storage')
      }
    } catch (error) {
      setStorageLocation('Local Storage')
    }
  }

  const getDownloadedModels = async () => {
    // Get list of downloaded models
    try {
      const result = await (window as any).ipcRenderer?.invoke('get-downloaded-models')
      if (result?.success && result.models) {
        // Extract model names from both string and object formats
        const modelNames = result.models.map((m: any) => {
          if (typeof m === 'string') {
            return m.split(':')[0] // Remove variant like :latest
          } else if (typeof m === 'object' && m.name) {
            return m.name.split(':')[0]
          }
          return null
        }).filter((m: any) => m !== null)
        
        setDownloadedModels(new Set(modelNames))
      }
    } catch (error) {
      console.error('Error getting downloaded models:', error)
    }
  }

  const handleDownloadModel = async (modelName: string) => {
    setDownloadingModels(prev => new Set(prev).add(modelName))
    setDownloadProgress(prev => ({ ...prev, [modelName]: '📥 Starting download...' }))

    // Listen for download progress updates
    const ipcRenderer = (window as any).ipcRenderer
    if (ipcRenderer) {
      ipcRenderer.on('download-progress', (_event: any, data: any) => {
        if (data.model === modelName) {
          const percent = data.percentage ? ` ${data.percentage}%` : ''
          const speed = data.speed ? ` (${data.speed})` : ''
          const message = `${data.message}${percent}${speed}`
          setDownloadProgress(prev => ({ ...prev, [modelName]: message }))
        }
      })
    }

    try {
      const result = await ipcRenderer?.invoke('download-model', modelName)
      if (result?.success) {
        setDownloadedModels(prev => new Set(prev).add(modelName))
        setDownloadProgress(prev => ({ ...prev, [modelName]: '✅ Downloaded!' }))
        setTimeout(() => {
          setDownloadProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[modelName]
            return newProgress
          })
        }, 2000)
      } else {
        setDownloadProgress(prev => ({ ...prev, [modelName]: `❌ Error: ${result?.error}` }))
      }
    } catch (error) {
      setDownloadProgress(prev => ({ ...prev, [modelName]: '❌ Download failed' }))
      console.error('Error downloading model:', error)
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev)
        newSet.delete(modelName)
        return newSet
      })
    }
  }

  const handleDeleteModel = async (modelName: string) => {
    try {
      const result = await (window as any).ipcRenderer?.invoke('delete-model', modelName)
      if (result?.success) {
        setDownloadedModels(prev => {
          const newSet = new Set(prev)
          newSet.delete(modelName)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error deleting model:', error)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Model Management</h2>
        </div>
        <p className="text-muted-foreground mb-4">Download and manage AI models</p>
        
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Storage: </span>
            <span className="font-medium">{storageLocation}</span>
          </div>
          <Button variant="outline" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Open Models Folder
          </Button>
        </div>
      </div>

      {/* Models Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(model => (
            <div key={model.name} className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 transition">
              <h3 className="font-semibold mb-2">{model.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{model.description}</p>
              <p className="text-xs text-muted-foreground mb-4">Size: {model.size}</p>
              
              {downloadingModels.has(model.name) ? (
                // Show progress bar while downloading
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Downloading model</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{downloadProgress[model.name] || 'Starting...'}</p>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{width: '100%'}} />
                  </div>
                </div>
              ) : downloadedModels.has(model.name) ? (
                // Show downloaded state
                <div className="flex gap-2">
                  <Button 
                    variant="default" 
                    size="sm"
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    disabled
                  >
                    <Download className="w-4 h-4" />
                    Downloaded
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteModel(model.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                // Show download button
                <Button 
                  variant="default" 
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleDownloadModel(model.name)}
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
