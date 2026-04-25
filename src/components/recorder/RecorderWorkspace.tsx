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

  return (
    <section className="workspace">
      <RecorderControlPanel
        isElectronBridgeReady={recorder.isElectronBridgeReady}
        sources={recorder.sources}
        selectedSourceId={recorder.selectedSourceId}
        statusText={recorder.statusText}
        isSharing={recorder.isSharing}
        isRecording={recorder.isRecording}
        isPaused={recorder.isPaused}
        latestRecordingPath={recorder.latestRecordingPath}
        recordingDuration={recorder.recordingDuration}
        hasCrop={recorder.hasCrop}
        // ── Audio props (now direct booleans instead of a label string)
        includeSystemAudio={appConfig.config.includeSystemAudio}
        includeMicrophone={appConfig.config.includeMicrophone}
        microphoneDeviceId={appConfig.config.microphoneDeviceId}
        configLoading={appConfig.isLoading}
        configSaving={appConfig.saveState === "saving"}
        videoBitrateKbps={appConfig.config.videoBitrateKbps}
        maxRecordingMinutes={appConfig.config.maxRecordingMinutes}
        onSourceChange={recorder.setSelectedSourceId}
        onVideoBitrateChange={(kbps) => void appConfig.updateConfig({ videoBitrateKbps: kbps })}
        onMaxRecordingMinutesChange={(min) => void appConfig.updateConfig({ maxRecordingMinutes: min })}
        onSystemAudioChange={(enabled) => void appConfig.updateConfig({ includeSystemAudio: enabled })}
        onMicrophoneChange={(enabled) => void appConfig.updateConfig({ includeMicrophone: enabled })}
        onMuteAll={() => void appConfig.updateConfig({ includeSystemAudio: false, includeMicrophone: false })}
        onMicrophoneDeviceChange={(id) => void appConfig.updateConfig({ microphoneDeviceId: id })}
        onRefreshSources={recorder.refreshElectronSources}
        onStartSharing={recorder.startSharing}
        onStopSharing={recorder.stopSharing}
        onStartRecording={recorder.startRecording}
        onStopRecording={recorder.stopRecording}
        onPauseRecording={recorder.pauseRecording}
        onResumeRecording={recorder.resumeRecording}
        onClearCrop={recorder.clearCrop}
      />

      <RecorderPreviewPane
        overlayRef={recorder.overlayRef}
        previewVideoRef={recorder.previewVideoRef}
        isSharing={recorder.isSharing}
        isRecording={recorder.isRecording}
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
