"use client";

import { RecorderControlPanel } from "@/components/recorder/RecorderControlPanel";
import { RecorderPreviewPane } from "@/components/recorder/RecorderPreviewPane";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useDesktopRecorder } from "@/hooks/useDesktopRecorder";

export function RecorderWorkspace() {
  const appConfig = useAppConfig();
  const recorder = useDesktopRecorder({
    config: appConfig.config,
    configReady: !appConfig.isLoading,
  });

  const audioProfileLabel = appConfig.config.includeSystemAudio
    ? appConfig.config.includeMicrophone
      ? "System + microphone"
      : "System audio"
    : appConfig.config.includeMicrophone
      ? "Microphone only"
      : "Muted";

  return (
    <section className="grid items-start gap-4 lg:grid-cols-[400px_1fr]">
      <RecorderControlPanel
        isElectronBridgeReady={recorder.isElectronBridgeReady}
        sources={recorder.sources}
        selectedSourceId={recorder.selectedSourceId}
        statusText={recorder.statusText}
        isSharing={recorder.isSharing}
        isRecording={recorder.isRecording}
        recordingDuration={recorder.recordingDuration}
        hasCrop={recorder.hasCrop}
        audioProfileLabel={audioProfileLabel}
        configLoading={appConfig.isLoading}
        configSaving={appConfig.saveState === "saving"}
        videoBitrateKbps={appConfig.config.videoBitrateKbps}
        maxRecordingMinutes={appConfig.config.maxRecordingMinutes}
        onSourceChange={recorder.setSelectedSourceId}
        onVideoBitrateChange={(bitrateKbps) => {
          void appConfig.updateConfig({ videoBitrateKbps: bitrateKbps });
        }}
        onMaxRecordingMinutesChange={(minutes) => {
          void appConfig.updateConfig({ maxRecordingMinutes: minutes });
        }}
        onRefreshSources={recorder.refreshElectronSources}
        onStartSharing={recorder.startSharing}
        onStopSharing={recorder.stopSharing}
        onStartRecording={recorder.startRecording}
        onStopRecording={recorder.stopRecording}
        onClearCrop={recorder.clearCrop}
      />

      <RecorderPreviewPane
        overlayRef={recorder.overlayRef}
        previewVideoRef={recorder.previewVideoRef}
        isSharing={recorder.isSharing}
        displayedCrop={recorder.displayedCrop}
        previewWidth={recorder.previewWidth}
        previewHeight={recorder.previewHeight}
        onPointerDown={recorder.beginCropSelection}
        onPointerMove={recorder.moveCropSelection}
        onPointerUp={recorder.endCropSelection}
        onPointerLeave={recorder.endCropSelection}
      />
    </section>
  );
}
