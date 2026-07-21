import React, { useState } from 'react';

import ChatInterface from '../../chat/view/ChatInterface';
import type { MainContentProps } from '../types/types';
import { useFileOpenResolver } from '../../../hooks/useFileOpenResolver';
import { FilePreviewModal } from '../../file-preview/FilePreviewModal';
import { useUiPreferences } from '../../../hooks/useUiPreferences';

import MobileMenuButton from './subcomponents/MobileMenuButton';
import MainContentTitle from './subcomponents/MainContentTitle';
import MainContentStateView from './subcomponents/MainContentStateView';
import ErrorBoundary from './ErrorBoundary';

// Simplified edition: only the chat tab remains. File tree, shell, git,
// task-master, browser-use, plugin and code-editor panels were removed.
function MainContent({
  selectedProject,
  selectedSession,
  activeTab,
  ws,
  sendMessage,
  isMobile,
  onMenuClick,
  isLoading,
  onInputFocusChange,
  onSessionProcessing,
  onSessionIdle,
  processingSessions,
  onNavigateToSession,
  onSessionEstablished,
  onShowSettings,
  externalMessageUpdate,
  newSessionTrigger,
}: MainContentProps) {
  const { preferences } = useUiPreferences();
  const { showRawParameters, showThinking, sendByCtrlEnter } = preferences;

  const [preview, setPreview] = useState<{ filePath: string; line?: number } | null>(null);

  // Resolve bare/partial refs (e.g. `foo.ts`) against the project file tree,
  // then open the read-only preview modal.
  const handleFileOpen = useFileOpenResolver(selectedProject, (filePath: string) => {
    setPreview({ filePath });
  });

  if (isLoading) {
    return <MainContentStateView mode="loading" isMobile={isMobile} onMenuClick={onMenuClick} />;
  }

  if (!selectedProject) {
    return <MainContentStateView mode="empty" isMobile={isMobile} onMenuClick={onMenuClick} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="pwa-header-safe flex-shrink-0 border-b border-border/60 bg-background px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isMobile && <MobileMenuButton onMenuClick={onMenuClick} />}
            <MainContentTitle
              activeTab={activeTab}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              shouldShowTasksTab={false}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-[200px] flex-1 flex-col overflow-hidden">
          <div className="h-full">
            <ErrorBoundary showDetails>
              <ChatInterface
                selectedProject={selectedProject}
                selectedSession={selectedSession}
                ws={ws}
                sendMessage={sendMessage}
                onFileOpen={handleFileOpen}
                onInputFocusChange={onInputFocusChange}
                onSessionProcessing={onSessionProcessing}
                onSessionIdle={onSessionIdle}
                processingSessions={processingSessions}
                onNavigateToSession={onNavigateToSession}
                onSessionEstablished={onSessionEstablished}
                onShowSettings={onShowSettings}
                showRawParameters={showRawParameters}
                showThinking={showThinking}
                sendByCtrlEnter={sendByCtrlEnter}
                externalMessageUpdate={externalMessageUpdate}
                newSessionTrigger={newSessionTrigger}
                onShowAllTasks={null}
              />
            </ErrorBoundary>
          </div>
        </div>
      </div>

      <FilePreviewModal
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
          }
        }}
        projectId={selectedProject?.projectId}
        filePath={preview?.filePath}
        line={preview?.line}
      />
    </div>
  );
}

export default React.memo(MainContent);
