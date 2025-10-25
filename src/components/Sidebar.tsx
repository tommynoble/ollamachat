import { Button } from './ui/button'
import { Menu, Plus, Settings, RotateCcw } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="md:hidden fixed top-4 left-4 z-50"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? 'w-64' : 'w-0'
        } bg-card border-r border-border transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="p-4 border-b border-border">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent Chats
          </div>
          {/* Placeholder for chat history */}
          <div className="text-sm text-muted-foreground text-center py-8">
            No chats yet
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <RotateCcw className="w-4 h-4" />
            Clear History
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-40"
          onClick={onToggle}
        />
      )}
    </>
  )
}
