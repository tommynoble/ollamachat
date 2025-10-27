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
  }, [])

  const loadModels = async () => {
    // Load available models
    setModels([
      { name: 'llama2', size: '3.8GB', description: 'General purpose model' },
      { name: 'mistral', size: '4.1GB', description: 'Fast and efficient' },
      { name: 'neural-chat', size: '3.9GB', description: 'Optimized for chat' },
      { name: 'dolphin-mixtral', size: '26GB', description: 'Powerful multi-expert model' },
      { name: 'orca-mini', size: '1.3GB', description: 'Lightweight model' },
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
        setDownloadedModels(new Set(result.models))
      }
    } catch (error) {
      console.error('Error getting downloaded models:', error)
    }
  }

  const handleDownloadModel = async (modelName: string) => {
    setDownloadingModels(prev => new Set(prev).add(modelName))
    setDownloadProgress(prev => ({ ...prev, [modelName]: 'Starting...' }))

    try {
      const result = await (window as any).ipcRenderer?.invoke('download-model', modelName)
      if (result?.success) {
        setDownloadedModels(prev => new Set(prev).add(modelName))
        setDownloadProgress(prev => ({ ...prev, [modelName]: 'Downloaded!' }))
        setTimeout(() => {
          setDownloadProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[modelName]
            return newProgress
          })
        }, 2000)
      } else {
        setDownloadProgress(prev => ({ ...prev, [modelName]: `Error: ${result?.error}` }))
      }
    } catch (error) {
      setDownloadProgress(prev => ({ ...prev, [modelName]: 'Download failed' }))
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
              
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  size="sm"
                  className="flex-1 gap-2"
                  disabled={downloadedModels.has(model.name) || downloadingModels.has(model.name)}
                  onClick={() => handleDownloadModel(model.name)}
                >
                  <Download className="w-4 h-4" />
                  {downloadingModels.has(model.name) ? 'Downloading...' : downloadedModels.has(model.name) ? 'Downloaded' : 'Download'}
                </Button>
                {downloadedModels.has(model.name) && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteModel(model.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {downloadProgress[model.name] && (
                <p className="text-xs text-muted-foreground mt-2">{downloadProgress[model.name]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
