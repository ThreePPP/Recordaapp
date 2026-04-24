"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_RECORDER_CONFIG,
  normalizeRecorderConfig,
  type RecorderConfig,
} from "@/types/config";

const LOCAL_CONFIG_KEY = "recordapp.desktop-config";

type SaveState = "idle" | "saving" | "saved" | "error";

export function useAppConfig() {
  const [config, setConfig] = useState<RecorderConfig>(DEFAULT_RECORDER_CONFIG);
  const [configPath, setConfigPath] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusText, setStatusText] = useState("Loading configuration...");

  const isDesktopMode =
    typeof window !== "undefined" &&
    Boolean(window.electronAPI?.getAppConfig && window.electronAPI?.saveAppConfig);

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        if (window.electronAPI?.getAppConfig) {
          const loadedConfig = await window.electronAPI.getAppConfig();
          if (!isMounted) {
            return;
          }

          setConfig(normalizeRecorderConfig(loadedConfig));
          setStatusText("Configuration loaded from desktop profile");

          if (window.electronAPI.getAppConfigPath) {
            const loadedPath = await window.electronAPI.getAppConfigPath();
            if (isMounted) {
              setConfigPath(loadedPath);
            }
          }
        } else {
          const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
          const localConfig = raw
            ? normalizeRecorderConfig(JSON.parse(raw) as Partial<RecorderConfig>)
            : DEFAULT_RECORDER_CONFIG;

          if (!isMounted) {
            return;
          }

          setConfig(localConfig);
          setStatusText("Configuration loaded from browser storage");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setConfig(DEFAULT_RECORDER_CONFIG);
        setStatusText("Failed to read config. Fallback to defaults.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveConfig = useCallback(async (nextConfig: RecorderConfig) => {
    const normalized = normalizeRecorderConfig(nextConfig);
    setSaveState("saving");

    try {
      if (window.electronAPI?.saveAppConfig) {
        const savedConfig = await window.electronAPI.saveAppConfig(normalized);
        setConfig(normalizeRecorderConfig(savedConfig));
        setStatusText("Configuration saved to desktop profile");
      } else {
        localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(normalized));
        setConfig(normalized);
        setStatusText("Configuration saved to browser storage");
      }

      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      setStatusText("Failed to save configuration");
      return false;
    }
  }, []);

  const updateConfig = useCallback(
    async (partial: Partial<RecorderConfig>) => {
      return saveConfig({ ...config, ...partial });
    },
    [config, saveConfig],
  );

  return {
    config,
    configPath,
    isLoading,
    isDesktopMode,
    saveState,
    statusText,
    saveConfig,
    updateConfig,
  };
}
