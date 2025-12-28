import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "transition-transform duration-300 ease-in-out z-50",
        isMobile ? "fixed inset-y-0 left-0" : "relative",
        isMobile && !sidebarOpen && "-translate-x-full"
      )}>
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        {isMobile && (
          <header className="flex items-center justify-between p-4 border-b border-border bg-background shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-bold">FlowBoard</span>
            <div className="w-10" /> {/* Spacer for centering */}
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      <AIAssistant />
    </div>
  );
}
