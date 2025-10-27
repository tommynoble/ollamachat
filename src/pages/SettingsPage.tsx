import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { HardDrive, Trash2, RefreshCw, CheckCircle } from 'lucide-react'

export default function SettingsPage() {
  const [externalDriveConfigured, setExternalDriveConfigured] = useState(false)
  const [drivePath, setDrivePath] = useState('')

  useEffect(() => {
    // Check if external drive is configured
    const checkConfig = async () => {
      try {
        const result = await (window as any).ipcRenderer?.invoke('check-external-drive-config')
        if (result?.configured) {
          setExternalDriveConfigured(true)
          setDrivePath(result.path || '')
        }
      } catch (error) {
        console.error('Error checking config:', error)
      }
    }
    checkConfig()
  }, [])

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
              
              <p className="text-sm text-muted-foreground mb-6">
                Your external drive configuration for storing AI models.
              </p>

              {externalDriveConfigured ? (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-700 mb-1">External Drive Configured</p>
                      <p className="text-sm text-green-600">{drivePath}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-700">
                    No external drive configured. Models will be stored locally.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
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
