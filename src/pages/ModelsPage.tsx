import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Download, Trash2, FolderOpen, BarChart3, RefreshCw, Loader2 } from 'lucide-react'

// Persist download state across navigations
const downloadState = {
  inFlight: new Set<string>(),
  progress: {} as { [key: string]: { message: string; percentage: number | null; status?: 'downloading' | 'completed' | 'error' } }
}

export default function ModelsPage() {
  const [models, setModels] = useState<any[]>([])
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set())
  const [storageLocation, setStorageLocation] = useState('Local')
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set(downloadState.inFlight))
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: { message: string; percentage: number | null; status?: 'downloading' | 'completed' | 'error' } }>(
    () => ({ ...downloadState.progress })
  )
  const [confirmDeleteModel, setConfirmDeleteModel] = useState<string | null>(null)

  useEffect(() => {
    loadModels()
    checkStorageLocation()
    getDownloadedModels()
    const ipcRenderer = (window as any).ipcRenderer
    let cleanup: (() => void) | undefined
    if (ipcRenderer) {
      const handleProgress = (_event: any, data: any) => {
        if (!data?.model) return
        setDownloadProgress(prev => ({
          ...prev,
          [data.model]: {
            message: data.message || 'Downloading...',
            percentage: typeof data.percentage === 'number' ? data.percentage : null,
            status: data.status || 'downloading'
          }
        }))
        downloadState.progress[data.model] = {
          message: data.message || 'Downloading...',
          percentage: typeof data.percentage === 'number' ? data.percentage : null,
          status: data.status || 'downloading'
        }
        if (data.status === 'completed') {
          setDownloadingModels(prev => {
            const ns = new Set(prev)
            ns.delete(data.model)
            downloadState.inFlight.delete(data.model)
            return ns
          })
          setDownloadedModels(prev => new Set(prev).add(data.model.split(':')[0]))
        }
      }
      ipcRenderer.on('download-progress', handleProgress)
      cleanup = () => ipcRenderer.removeListener('download-progress', handleProgress)
    }

    const interval = setInterval(getDownloadedModels, 1000)
    return () => {
      clearInterval(interval)
      if (cleanup) cleanup()
    }
  }, [])

  const loadModels = async () => {
    // Load available models from Ollama
    setModels([
      // General chat (small/efficient)
      { name: 'llama3.1:8b', size: '≈4.7GB (q4_K)', description: 'Meta Llama 3.1 8B — strong general chat' },
      { name: 'phi3.5:3.8b', size: '≈2.5GB (q4_K)', description: 'Phi-3.5 Mini — tiny, fast, capable' },
      { name: 'gemma2:9b', size: '≈5.2GB (q4_K)', description: 'Gemma 2 9B — great balance of quality/size' },
      { name: 'mistral:7b-instruct', size: '≈4.1GB (q4_K)', description: 'Mistral 7B Instruct — efficient, solid outputs' },

      // Coding-focused
      { name: 'codegemma:7b-instruct', size: '≈4.2GB (q4_K)', description: 'CodeGemma 7B — coding & reasoning' },
      { name: 'codellama:7b-instruct', size: '≈3.8GB (q4_K)', description: 'Code Llama 7B — code generation' },

      // Lightweight alternates
      { name: 'phi3:3.8b', size: '≈2.2GB (q4_K)', description: 'Phi-3 Mini — ultra lightweight' },
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
      } else {
        setDownloadedModels(new Set())
      }
    } catch (error) {
      console.error('Error getting downloaded models:', error)
      setDownloadedModels(new Set())
    }
  }

  const handleDownloadModel = async (modelName: string) => {
    setDownloadingModels(prev => new Set(prev).add(modelName))
    downloadState.inFlight.add(modelName)
    setDownloadProgress(prev => ({ ...prev, [modelName]: { message: '📥 Starting download...', percentage: null, status: 'downloading' } }))
    downloadState.progress[modelName] = { message: '📥 Starting download...', percentage: null, status: 'downloading' }

    try {
      const result = await ipcRenderer?.invoke('download-model', modelName)
      if (result?.success) {
        setDownloadedModels(prev => new Set(prev).add(modelName))
        setDownloadProgress(prev => ({ ...prev, [modelName]: { message: '✅ Downloaded!', percentage: 100, status: 'completed' } }))
        downloadState.progress[modelName] = { message: '✅ Downloaded!', percentage: 100, status: 'completed' }
        setTimeout(() => {
          setDownloadProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[modelName]
            return newProgress
          })
          delete downloadState.progress[modelName]
        }, 2000)
      } else {
        setDownloadProgress(prev => ({ ...prev, [modelName]: { message: `❌ Error: ${result?.error}`, percentage: null, status: 'error' } }))
        downloadState.progress[modelName] = { message: `❌ Error: ${result?.error}`, percentage: null, status: 'error' }
      }
    } catch (error) {
      setDownloadProgress(prev => ({ ...prev, [modelName]: { message: '❌ Download failed', percentage: null, status: 'error' } }))
      downloadState.progress[modelName] = { message: '❌ Download failed', percentage: null, status: 'error' }
      console.error('Error downloading model:', error)
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev)
        newSet.delete(modelName)
        return newSet
      })
      downloadState.inFlight.delete(modelName)
    }
  }

  const handleDeleteModel = async (modelName: string) => {
    try {
      const targets = [modelName]
      const baseName = modelName.split(':')[0]
      if (baseName !== modelName) targets.push(baseName)

      let hadError = false
      for (const target of targets) {
        const result = await (window as any).ipcRenderer?.invoke('delete-model', target)
        if (!result?.success) {
          hadError = true
          console.error('Error deleting model:', target, result?.error)
        }
      }

      setDownloadedModels(prev => {
        const newSet = new Set(prev)
        targets.forEach(t => newSet.delete(t))
        return newSet
      })

      // Clear any progress entries for these models
      setDownloadProgress(prev => {
        const next = { ...prev }
        targets.forEach(t => {
          delete next[t]
        })
        return next
      })

      if (!hadError) {
        await getDownloadedModels()
      }

      if (hadError) {
        alert('Some parts of the model could not be deleted. Please check the drive is mounted and try again. The model has been removed from the list.')
      }
    } catch (error) {
      console.error('Error deleting model:', error)
      alert('Delete failed. Please ensure the drive is mounted and try again.')
    }
  }

  return (
    <>
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Model Management</h2>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
            onClick={() => getDownloadedModels()}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
        <p className="text-muted-foreground mb-4">Download and manage AI models</p>
        
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Storage: </span>
            <span className="font-medium">{storageLocation}</span>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              try {
                await (window as any).ipcRenderer?.invoke('open-models-location')
              } catch (error) {
                console.error('Failed to open models folder:', error)
              }
            }}
          >
            <FolderOpen className="w-4 h-4" />
            Open Models Folder
          </Button>
        </div>
      </div>

      {/* Downloaded Models Section */}
      {downloadedModels.size > 0 && (
        <div className="border-b border-border bg-card/50 p-6">
          <h3 className="text-lg font-semibold mb-3">📥 Downloaded Models ({downloadedModels.size})</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(downloadedModels).map(modelName => (
              <div 
                key={modelName}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/50"
              >
                <span className="text-sm font-medium text-green-700">✅ {modelName}</span>
                <button
                  className="text-green-800 hover:text-destructive transition-colors text-xs"
                  title="Delete model"
                  onClick={() => setConfirmDeleteModel(modelName)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Models Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(model => {
            const baseName = model.name.split(':')[0]
            const isDownloaded = downloadedModels.has(model.name) || downloadedModels.has(baseName)
            const isDownloading = downloadingModels.has(model.name)
            const progressValue = Math.min(Math.max(downloadProgress[model.name]?.percentage ?? 10, 10), 100)
            const progressStatus = downloadProgress[model.name]?.status
            return (
              <div key={model.name} className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 transition">
                <h3 className="font-semibold mb-2">{model.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{model.description}</p>
                <p className="text-xs text-muted-foreground mb-4">Size: {model.size}</p>
                
                {isDownloading ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">Downloading model</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {downloadProgress[model.name]?.message || 'Starting...'}
                    </p>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  </div>
                ) : progressStatus === 'error' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive">
                      {downloadProgress[model.name]?.message || 'Download failed'}
                    </p>
                    <Button 
                      variant="default" 
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleDownloadModel(model.name)}
                    >
                      <Download className="w-4 h-4" />
                      Retry
                    </Button>
                  </div>
                ) : isDownloaded ? (
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
            )
          })}
        </div>
      </div>
    </div>

    {confirmDeleteModel && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
        <div className="w-[360px] rounded-xl border border-border bg-card shadow-xl p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Delete model?</h3>
            <p className="text-sm text-muted-foreground">
              This will remove <span className="font-medium text-foreground">{confirmDeleteModel}</span> from disk. You can redownload it later if needed.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteModel(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteModel) {
                  handleDeleteModel(confirmDeleteModel)
                  setConfirmDeleteModel(null)
                }
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
