import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { HardDrive, Trash2, RefreshCw, CheckCircle, Play } from 'lucide-react'

export default function SettingsPage() {
  const [externalDriveConfigured, setExternalDriveConfigured] = useState(false)
  const [drivePath, setDrivePath] = useState('')
  const [mountedDrives, setMountedDrives] = useState<any[]>([])
  const [selectedDrive, setSelectedDrive] = useState<string | null>(null)
  const [isStartingOllama, setIsStartingOllama] = useState(false)
  const [ollamaMessage, setOllamaMessage] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [justConfigured, setJustConfigured] = useState(false)
  const [hasAttemptedAutoStart, setHasAttemptedAutoStart] = useState(() => {
    // Load from localStorage to persist across page navigation
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hasAttemptedOllamaAutoStart') === 'true'
    }
    return false
  })

  useEffect(() => {
    // Check if external drive is configured and get mounted drives
    const checkConfig = async (isInitialCheck = false) => {
      try {
        const result = await (window as any).ipcRenderer?.invoke('check-external-drive-config')
        const drivesResult = await (window as any).ipcRenderer?.invoke('get-mounted-drives')
        
        if (drivesResult?.drives) {
          setMountedDrives(drivesResult.drives)
        }
        
        if (result?.configured) {
          // Extract the drive path (e.g., /Volumes/A005 from /Volumes/A005/ollama-models)
          const drivePath = result.path.split('/ollama-models')[0]
          
          // Check if the drive itself is mounted
          const configuredDriveExists = drivesResult?.drives?.some((d: any) => d.path === drivePath)
          
          if (configuredDriveExists || justConfigured) {
            // Drive is configured AND (mounted OR just configured) - show as configured
            console.log('✅ Configured drive found:', result.path)
            setExternalDriveConfigured(true)
            setDrivePath(result.path || '')
            
            // Auto-start Ollama on app startup if drive is configured and mounted (only once per session)
            if (isInitialCheck && configuredDriveExists && !hasAttemptedAutoStart) {
              setHasAttemptedAutoStart(true)
              localStorage.setItem('hasAttemptedOllamaAutoStart', 'true')
              console.log('🚀 Auto-starting Ollama with previously configured drive...')
              setOllamaMessage('Auto-starting Ollama with external drive...')
              
              try {
                const ollamaResult = await (window as any).ipcRenderer?.invoke('start-ollama')
                if (ollamaResult?.success) {
                  setOllamaMessage('✓ Ollama started with external drive!')
                  setTimeout(() => setOllamaMessage(''), 3000)
                }
              } catch (error) {
                console.error('Error auto-starting Ollama:', error)
              }
            }
          } else {
            // Drive is configured but NOT mounted - show as not configured
            console.log('⚠️ Configured drive not mounted:', result.path)
            setExternalDriveConfigured(false)
            setDrivePath('')
          }
        } else {
          // Not configured
          setExternalDriveConfigured(false)
          setDrivePath('')
        }
      } catch (error) {
        console.error('Error checking config:', error)
      }
    }
    
    // Check immediately on mount - this loads the saved configuration
    console.log('📀 Checking for saved drive configuration on app startup...')
    checkConfig(true)

    // Auto-refresh drives every 2 seconds to detect ejections/connections
    // (increased from 1 second to reduce flashing)
    const interval = setInterval(() => checkConfig(false), 2000)
    return () => clearInterval(interval)
  }, [justConfigured, ollamaMessage])

  const handleStartOllama = async () => {
    setIsStartingOllama(true)
    setOllamaMessage('Starting Ollama...')
    try {
      const result = await (window as any).ipcRenderer?.invoke('start-ollama')
      if (result?.success) {
        setOllamaMessage('✓ Ollama started! Give it a moment to fully initialize.')
        // Keep message visible for longer so user sees success
        setTimeout(() => setOllamaMessage(''), 8000)
        // Disable button for a bit after successful start
        setTimeout(() => setIsStartingOllama(false), 3000)
      } else {
        setOllamaMessage(`Error starting Ollama: ${result?.error}`)
        setIsStartingOllama(false)
      }
    } catch (error) {
      console.error('Error starting Ollama:', error)
      setOllamaMessage('Error starting Ollama')
      setIsStartingOllama(false)
    }
  }

  const handleConfigureDrive = async () => {
    if (!selectedDrive) return

    try {
      const drive = mountedDrives.find((d: any) => d.path === selectedDrive)
      if (!drive) return

      console.log('🔧 Configuring drive:', drive.name, drive.path)
      
      // Use the original 'use-for-models' handler which automatically restarts Ollama
      const result = await (window as any).ipcRenderer?.invoke('use-for-models', drive.name, drive.path)
      
      console.log('🔧 Configure result:', result)

      if (result?.success) {
        console.log('✅ Drive configured successfully!')
        setExternalDriveConfigured(true)
        setDrivePath(result.modelsPath)
        setSelectedDrive(null)
        setJustConfigured(true)
        
        // Keep the configured state for 10 seconds
        setTimeout(() => setJustConfigured(false), 10000)
        
        // Auto-start Ollama after configuration
        console.log('🚀 Auto-starting Ollama with external drive...')
        setIsStartingOllama(true)
        setOllamaMessage('Starting Ollama with external drive...')
        
        try {
          const ollamaResult = await (window as any).ipcRenderer?.invoke('start-ollama')
          if (ollamaResult?.success) {
            setOllamaMessage('✓ Ollama started with external drive!')
            setTimeout(() => setOllamaMessage(''), 3000)
          } else {
            setOllamaMessage(`Error starting Ollama: ${ollamaResult?.error}`)
          }
        } catch (error) {
          console.error('Error auto-starting Ollama:', error)
          setOllamaMessage('Error starting Ollama')
        } finally {
          setIsStartingOllama(false)
        }
      }
    } catch (error) {
      console.error('Error configuring drive:', error)
    }
  }

  const handleRefreshDrives = async () => {
    setIsRefreshing(true)
    try {
      console.log('🔄 Manually refreshing drives...')
      const drivesResult = await (window as any).ipcRenderer?.invoke('get-mounted-drives')
      console.log('🔄 Refresh result:', drivesResult)
      if (drivesResult?.drives) {
        console.log('🔄 Found drives:', drivesResult.drives.length)
        setMountedDrives(drivesResult.drives)
      }
    } catch (error) {
      console.error('Error refreshing drives:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Settings</h2>
        </div>
        <p className="text-muted-foreground">Configure your Ollama Chat application</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* External Drive Section */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <HardDrive className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">External Drive</h3>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Select an external drive to store your AI models.
              </p>

              {/* Refresh Button */}
              <Button 
                onClick={handleRefreshDrives}
                disabled={isRefreshing}
                variant="outline"
                className="w-full mb-4 gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Drives'}
              </Button>

              {/* Current Configuration */}
              {externalDriveConfigured && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-green-700">Configured</p>
                      <p className="text-xs text-green-600">{drivePath}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mounted Drives List */}
              {mountedDrives.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 mb-4">
                  {externalDriveConfigured ? 'No other drives available' : 'No drives detected'}
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {mountedDrives.map(drive => (
                    <div 
                      key={drive.path}
                      className={`p-3 border rounded-lg cursor-pointer transition ${
                        selectedDrive === drive.path 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:bg-accent/50'
                      }`}
                      onClick={() => setSelectedDrive(drive.path)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{drive.name}</p>
                          <p className="text-xs text-muted-foreground">{drive.path}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-medium">{drive.available}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedDrive && (
                <Button 
                  onClick={handleConfigureDrive}
                  className="w-full"
                >
                  Use {mountedDrives.find(d => d.path === selectedDrive)?.name} for Models
                </Button>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Ollama Server Section */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="text-lg font-semibold mb-4">Ollama Server</h3>
              
              <Button 
                onClick={handleStartOllama}
                disabled={isStartingOllama}
                className="w-full gap-2"
              >
                <Play className={`w-4 h-4 ${isStartingOllama ? 'animate-spin' : ''}`} />
                {isStartingOllama ? 'Starting Ollama...' : 'Start Ollama'}
              </Button>

              {ollamaMessage && (
                <div className={`mt-3 p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  ollamaMessage.includes('✓')
                    ? 'bg-green-500/10 text-green-700 border border-green-500/30'
                    : ollamaMessage.includes('Auto-starting') || ollamaMessage.includes('Starting')
                    ? 'bg-blue-500/10 text-blue-700 border border-blue-500/30'
                    : 'bg-red-500/10 text-red-700 border border-red-500/30'
                }`}>
                  {ollamaMessage.includes('✓') && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                  {(ollamaMessage.includes('Auto-starting') || ollamaMessage.includes('Starting')) && <Play className="w-4 h-4 animate-spin flex-shrink-0" />}
                  {ollamaMessage.includes('Error') && <span className="text-lg">⚠️</span>}
                  <span>{ollamaMessage}</span>
                </div>
              )}
            </div>

            {/* Model Management Section */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="text-lg font-semibold mb-4">Model Management</h3>
              
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh Model List
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Trash2 className="w-4 h-4" />
                  Clear Cache
                </Button>
              </div>
            </div>

            {/* About Section */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="text-lg font-semibold mb-4">About</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span>1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ollama:</span>
                  <span>Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage:</span>
                  <span>External Drive</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
