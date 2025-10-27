import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "./ui/sidebar"
import { MessageCircle, BookOpen, Code2, Settings, BarChart3, Zap, GitCompare, ChevronDown, TrendingUp, Briefcase, Wrench, Cloud } from "lucide-react"

interface AppSidebarProps {
  currentPage?: string
  onNavigate?: (page: string) => void
}

interface NavCategory {
  label: string
  icon: any
  items: Array<{ label: string; icon: any; page: string; description?: string }>
}

export function AppSidebar({ currentPage = "chat", onNavigate }: AppSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    chat: true,
    finance: false,
    student: false,
    marketer: false,
    developer: false,
    utilities: false,
  })

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newState = Object.keys(prev).reduce((acc, key) => {
        acc[key] = false
        return acc
      }, {} as Record<string, boolean>)
      newState[category] = !prev[category]
      return newState
    })
  }

  const categories: Record<string, NavCategory> = {
    chat: {
      label: "Chat",
      icon: MessageCircle,
      items: [
        { label: "Chat", icon: MessageCircle, page: "chat" },
      ]
    },
    finance: {
      label: "Finance",
      icon: TrendingUp,
      items: [
        { label: "Financial Analysis", icon: TrendingUp, page: "analyzer" },
      ]
    },
    student: {
      label: "Student",
      icon: BookOpen,
      items: [
        { label: "Learning Center", icon: BookOpen, page: "learning" },
        { label: "Code Assistant", icon: Code2, page: "coder" },
      ]
    },
    marketer: {
      label: "Marketer",
      icon: Briefcase,
      items: [
        { label: "Content Creation", icon: Briefcase, page: "chat" },
      ]
    },
    developer: {
      label: "Developer",
      icon: Code2,
      items: [
        { label: "Code Assistant", icon: Code2, page: "coder" },
        { label: "Learning Center", icon: BookOpen, page: "learning" },
      ]
    },
    utilities: {
      label: "Utilities",
      icon: Wrench,
      items: [
        { label: "Analyzer", icon: Zap, page: "analyzer" },
        { label: "Compare Models", icon: GitCompare, page: "comparison" },
      ]
    },
  }

  const renderNavItem = (item: { label: string; icon: any; page: string }) => {
    return (
      <button
        key={item.page}
        onClick={() => onNavigate?.(item.page)}
        className={`w-full flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          currentPage === item.page
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`}
      >
        <span>{item.label}</span>
      </button>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-2 py-4 mb-4">
          <h1 className="text-lg font-bold">🤖 Ollama Chat</h1>
        </div>

        {Object.entries(categories).map(([key, category], idx) => {
          const Icon = category.icon
          const isExpanded = expandedCategories[key]
          
          return (
            <div key={key}>
              {idx > 0 && <div className="border-b border-sidebar-foreground/12 my-2" />}
              <SidebarGroup>
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-sidebar-foreground/80 uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{category.label}</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              
              {isExpanded && (
                <SidebarGroupContent>
                  <div className="flex flex-col pl-4">
                    {category.items.map((item, idx) => (
                      <div key={item.page}>
                        {renderNavItem(item)}
                        {idx < category.items.length - 1 && (
                          <div className="h-px bg-sidebar/30" />
                        )}
                      </div>
                    ))}
                  </div>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
            </div>
          )
        })}

        {/* App Settings Section */}
        <SidebarGroup className="mt-auto border-t border-sidebar/20 pt-4">
          <SidebarGroupLabel>App Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-1">
              {[
                { label: "Models", icon: BarChart3, page: "models" },
                { label: "Settings", icon: Settings, page: "settings" },
                { label: "Go Online", icon: Cloud, page: "online" },
              ].map(item => renderNavItem(item))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
