import React from "react";
import { showModal } from "@decky/ui";
import { DownloadForm } from "./DownloadForm";
import { DownloadModal } from "./download/components/DownloadModal";
import { PageLayout } from "./shared/components/PageLayout";

export function DownloadPanel() {
  return (
    <PageLayout title="Download Lua Script" showBack>
      <DownloadForm onStart={(appid, source, imgUrl, name) => {
        const handle = showModal(
          <DownloadModal
            appid={appid}
            name={name}
            imgUrl={imgUrl}
            source={source}
            onClose={() => handle.Close()}
          />
        );
      }} />
    </PageLayout>
  );
}
