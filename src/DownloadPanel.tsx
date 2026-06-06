import React, { useState } from "react";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./download/components/DownloadProgress";
import { PostDownloadRestart } from "./download/components/PostDownloadRestart";
import { useDownloadLifecycle } from "./download/hooks/useDownloadLifecycle";
import { PageLayout } from "./shared/components/PageLayout";

export function DownloadPanel() {
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

  return (
    <PageLayout title="Download Lua Script" showBack>
      {!download.isActive && !showRestartPrompt && (
        <DownloadForm onStart={download.start} />
      )}
      {download.isActive && (
        <DownloadProgress state={download.state!} onCancel={download.cancel} />
      )}
      {showRestartPrompt && (
        <PostDownloadRestart onDismiss={() => setShowRestartPrompt(false)} />
      )}
    </PageLayout>
  );
}
