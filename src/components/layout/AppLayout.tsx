import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AIAssistant } from "@/components/ai/AIAssistant";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
      <AIAssistant />
    </div>
  );
}
