import React, { useState, memo } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft } from 'lucide-react';

interface ChatLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  defaultLayout?: number[];
  isChatSelected?: boolean;
  onBackToSidebar?: () => void;
}

const ChatLayout: React.FC<ChatLayoutProps> = memo(({
  sidebar,
  children,
  defaultLayout = [26, 74],
  isChatSelected = false,
  onBackToSidebar,
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex h-[100dvh] w-full overflow-hidden">
        {/* Sidebar panel — shown when no chat selected */}
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col bg-sidebar-background transition-transform duration-300 ease-in-out",
            isChatSelected ? "-translate-x-full" : "translate-x-0"
          )}
        >
          {sidebar}
        </div>

        {/* Chat panel — shown when chat selected */}
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col bg-background transition-transform duration-300 ease-in-out",
            isChatSelected ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Mobile back button injected into chat header area */}
          <div className="flex items-center h-14 border-b border-border px-3 bg-card/80 backdrop-blur-sm flex-shrink-0 gap-2">
            <button
              onClick={onBackToSidebar}
              className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-accent/60 transition-colors flex-shrink-0"
              aria-label="Back to chats"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {/* Chat header content rendered by children via portal-like approach */}
            <div className="flex-1 min-w-0" id="mobile-chat-header-slot" />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Desktop — resizable panels
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen max-h-screen"
      onLayout={(sizes: number[]) => {
        try { document.cookie = `rp:layout=${JSON.stringify(sizes)}`; } catch {}
      }}
    >
      <ResizablePanel
        defaultSize={defaultLayout[0]}
        minSize={18}
        maxSize={32}
        className="bg-sidebar-background border-r border-border"
      >
        {sidebar}
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-border/40 hover:bg-[hsl(var(--accent-primary)/0.3)] transition-colors w-px" />
      <ResizablePanel defaultSize={defaultLayout[1]} minSize={40} className="bg-background">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
});

ChatLayout.displayName = 'ChatLayout';
export default ChatLayout;
