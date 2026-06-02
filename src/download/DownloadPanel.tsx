import React, { useState } from "react";
import { DownloadForm } from "./DownloadForm";
import { DownloadProgress } from "./DownloadProgress";
import { PostDownloadRestart } from "./PostDownloadRestart";
import { useDownloadLifecycle } from "./hooks/useDownloadLifecycle";
import { PageLayout } from "../shared/components/PageLayout";

export function DownloadPanel() {
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const download = useDownloadLifecycle(() => setShowRestartPrompt(true));

  return (
    <PageLayout title="Download Lua Script">
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
