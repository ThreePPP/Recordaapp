"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  // Memoize once — never changes after the initial render
  const isDesktopMode = useRef(
    typeof window !== "undefined" &&
    Boolean(window.electronAPI?.getAppConfig && window.electronAPI?.saveAppConfig),
  ).current;

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      try {
        let loaded: RecorderConfig;

        if (window.electronAPI?.getAppConfig) {
          const raw = await window.electronAPI.getAppConfig();
          loaded = normalizeRecorderConfig(raw);
          if (isMounted && window.electronAPI.getAppConfigPath) {
            setConfigPath(await window.electronAPI.getAppConfigPath());
          }
          if (isMounted) setStatusText("Configuration loaded from desktop profile");
        } else {
          const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
          loaded = raw
            ? normalizeRecorderConfig(JSON.parse(raw) as Partial<RecorderConfig>)
            : DEFAULT_RECORDER_CONFIG;
          if (isMounted) setStatusText("Configuration loaded from browser storage");
        }

        if (isMounted) setConfig(loaded);
      } catch {
        if (isMounted) {
          setConfig(DEFAULT_RECORDER_CONFIG);
          setStatusText("Failed to read config. Fallback to defaults.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadConfig();
    return () => { isMounted = false; };
  }, []);

  const saveConfig = useCallback(async (nextConfig: RecorderConfig) => {
    const normalized = normalizeRecorderConfig(nextConfig);
    setSaveState("saving");
    try {
      if (window.electronAPI?.saveAppConfig) {
        const saved = await window.electronAPI.saveAppConfig(normalized);
        setConfig(normalizeRecorderConfig(saved));
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
    async (partial: Partial<RecorderConfig>) => saveConfig({ ...config, ...partial }),
    [config, saveConfig],
  );

  return { config, configPath, isLoading, isDesktopMode, saveState, statusText, saveConfig, updateConfig };
}
