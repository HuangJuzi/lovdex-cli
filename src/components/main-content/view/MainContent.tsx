import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ChatInterface from '../../chat/view/ChatInterface';
import type { MainContentProps } from '../types/types';
import { useFileOpenResolver } from '../../../hooks/useFileOpenResolver';
import { useLinkedTask } from '../../../hooks/useLinkedTask';
import { FilePreviewModal } from '../../file-preview/FilePreviewModal';
import { useUiPreferences } from '../../../hooks/useUiPreferences';
import { STATUS_META } from '../../tasks/taskStatus';
import { ViewSwitcher } from '../../tasks/ViewSwitcher';

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
  onResumeSession,
  onSwitchToNewSession,
  externalMessageUpdate,
  newSessionTrigger,
}: MainContentProps) {
  const { preferences } = useUiPreferences();
  const { showRawParameters, showThinking, sendByCtrlEnter } = preferences;

  const [preview, setPreview] = useState<{ filePath: string; line?: number } | null>(null);

  const navigate = useNavigate();
  const { task: linkedTask } = useLinkedTask(selectedSession?.id ?? null);

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
            <ViewSwitcher active="chat" className="w-40 flex-shrink-0 sm:w-44" />
            <MainContentTitle
              activeTab={activeTab}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              shouldShowTasksTab={false}
            />
          </div>
          {linkedTask && (
            <button
              type="button"
              onClick={() => navigate(`/task/${linkedTask.task_id}`)}
              className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 text-sm text-foreground transition-colors hover:bg-accent"
              title="查看任务"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STATUS_META[linkedTask.status].color }}
              />
              查看任务
            </button>
          )}
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
                onResumeSession={onResumeSession}
                onSwitchToNewSession={onSwitchToNewSession}
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
