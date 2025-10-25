import { useState } from 'react'
import { Button } from '../components/ui/button'
import { HardDrive, Trash2, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const [drives, setDrives] = useState<any[]>([
    { name: 'SD_Card', path: '/Volumes/SD_Card', size: '64GB', used: '32GB' }
  ])
  const [selectedDrive, setSelectedDrive] = useState<string | null>(null)

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <h2 className="text-2xl font-bold mb-2">⚙️ Settings</h2>
        <p className="text-muted-foreground">Configure your Ollama Chat application</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* External Drive Section */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">External Drive Configuration</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Select an external drive to store your AI models. This keeps your computer lightweight.
            </p>

            <div className="space-y-3">
              {drives.map(drive => (
                <div 
                  key={drive.name}
                  className={`p-4 border rounded-lg cursor-pointer transition ${
                    selectedDrive === drive.name 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedDrive(drive.name)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{drive.name}</p>
                      <p className="text-sm text-muted-foreground">{drive.path}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{drive.used} / {drive.size}</p>
                      <p className="text-muted-foreground">Used</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedDrive && (
              <Button className="w-full mt-4">
                Use {selectedDrive} for Models
              </Button>
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
  )
}
