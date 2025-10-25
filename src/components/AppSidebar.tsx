import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuItem,
  SidebarMenuButton,
} from "./ui/sidebar"
import { MessageCircle, BookOpen, Code2, Settings, BarChart3, Zap } from "lucide-react"

interface AppSidebarProps {
  currentPage?: string
  onNavigate?: (page: string) => void
}

export function AppSidebar({ currentPage = "chat", onNavigate }: AppSidebarProps) {
  const navItems = [
    { label: "Chat", icon: MessageCircle, page: "chat" },
    { label: "Models", icon: BarChart3, page: "models" },
    { label: "Learning", icon: BookOpen, page: "learning" },
    { label: "Analyzer", icon: Zap, page: "analyzer" },
    { label: "Coder", icon: Code2, page: "coder" },
    { label: "Settings", icon: Settings, page: "settings" },
  ]

  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-2 py-4 mb-4">
          <h1 className="text-lg font-bold">🤖 Ollama Chat</h1>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.page}>
                  <SidebarMenuButton
                    onClick={() => onNavigate?.(item.page)}
                    isActive={currentPage === item.page}
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
