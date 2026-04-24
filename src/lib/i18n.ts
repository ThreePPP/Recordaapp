/**
 * Minimal bilingual (Thai / English) i18n for ScreenStudio.
 * Add keys here — both languages must have the same keys.
 */

export type Lang = "en" | "th";

export const LANGUAGES: Record<Lang, string> = {
  en: "English",
  th: "ภาษาไทย",
};

export type Translations = Record<keyof typeof en, string>;

const en = {
  // ── App shell ────────────────────────────────────────────────
  appTagline: "Desktop Recorder",
  appName: "ScreenStudio",
  appDesc: "Record your screen with optional audio and configurable defaults.",
  navRecorder: "Recorder",
  navSettings: "Settings",
  updateAvailable: "Downloading update",
  updateReady: "Update ready — restart to install",
  updateInstall: "Restart & Install",

  // ── Control Panel ────────────────────────────────────────────
  consoleTitle: "Console",
  engineLabel: "ENGINE",
  engineOk: "ELECTRON ✓",
  engineDisconnected: "DISCONNECTED",
  audioLabel: "AUDIO",
  displayWindow: "Display / Window",
  refreshBtn: "Refresh",
  searchingSources: "Searching for sources…",
  audioInput: "Audio Input",
  systemAudio: "System Audio",
  microphone: "Microphone",
  muteAll: "Mute all audio",
  videoBitrate: "Video Bitrate",
  autoStop: "Auto-Stop",
  noLimit: "No limit",
  bestFor: "Best for:",
  preview: "Preview",
  stop: "Stop",
  startRecording: "Start Recording",
  recording: "Recording…",
  finish: "Finish",
  clearCrop: "Clear Crop",
  electronDisconnected: "Electron engine disconnected — restart the app to restore capture.",
  hotkeys: "Hotkeys",

  // ── Preview Pane ─────────────────────────────────────────────
  previewMonitor: "Preview Monitor",
  previewHint: "Drag on the preview to select a crop region",
  previewIdle: "Select a source and click Preview to begin",
  noSignal: "No signal",

  // ── Settings ─────────────────────────────────────────────────
  settingsTitle: "Application Settings",
  settingsDesc: "Set default behavior for recording sessions.",
  langSection: "Language / ภาษา",
  langHint: "Choose the display language for the interface.",
  systemAudioLabel: "Include system audio",
  systemAudioDesc: "Capture the playback of internal system sounds if supported by the OS.",
  saveSettings: "Save settings",
  saving: "Saving…",
  resetForm: "Reset form",
  statusLabel: "Status",
  runtimeLabel: "Runtime",
  runtimeDesktop: "Electron desktop profile",
  runtimeBrowser: "Browser fallback profile",
  configPathLabel: "Config Path",
  // ── Save path ─────────────────────────────────────────────────
  savePathSection: "Recording Save Location",
  savePathHint: "Choose the folder where recordings will be saved.",
  savePathNotSet: "Not configured — you will be prompted before recording",
  savePathBrowse: "Browse…",
  savePathChange: "Change Folder",
  savePathRequired: "Please select a save folder before recording.",
  savePathSaved: "Saved to:",
} as const;

const th: Translations = {
  // ── App shell ────────────────────────────────────────────────
  appTagline: "โปรแกรมบันทึกหน้าจอ",
  appName: "ScreenStudio",
  appDesc: "บันทึกหน้าจอพร้อมเสียง และตั้งค่าได้ตามต้องการ",
  navRecorder: "บันทึก",
  navSettings: "ตั้งค่า",
  updateAvailable: "กำลังดาวน์โหลดอัปเดต",
  updateReady: "อัปเดตพร้อมแล้ว — รีสตาร์ทเพื่อติดตั้ง",
  updateInstall: "รีสตาร์ทและติดตั้ง",

  // ── Control Panel ────────────────────────────────────────────
  consoleTitle: "แผงควบคุม",
  engineLabel: "เอนจิน",
  engineOk: "ELECTRON ✓",
  engineDisconnected: "ไม่เชื่อมต่อ",
  audioLabel: "เสียง",
  displayWindow: "หน้าจอ / หน้าต่าง",
  refreshBtn: "รีเฟรช",
  searchingSources: "กำลังค้นหาแหล่งสัญญาณ…",
  audioInput: "แหล่งเสียง",
  systemAudio: "เสียงระบบ",
  microphone: "ไมโครโฟน",
  muteAll: "ปิดเสียงทั้งหมด",
  videoBitrate: "คุณภาพวิดีโอ",
  autoStop: "หยุดอัตโนมัติ",
  noLimit: "ไม่จำกัด",
  bestFor: "เหมาะสำหรับ:",
  preview: "แสดงตัวอย่าง",
  stop: "หยุด",
  startRecording: "เริ่มบันทึก",
  recording: "กำลังบันทึก…",
  finish: "สิ้นสุด",
  clearCrop: "ล้างพื้นที่",
  electronDisconnected: "เอนจิน Electron ขาดการเชื่อมต่อ — กรุณารีสตาร์ทแอป",
  hotkeys: "ทางลัดคีย์บอร์ด",

  // ── Preview Pane ─────────────────────────────────────────────
  previewMonitor: "จอมอนิเตอร์",
  previewHint: "ลากบนหน้าจอตัวอย่างเพื่อเลือกพื้นที่บันทึก",
  previewIdle: "เลือกแหล่งสัญญาณ แล้วกด 'แสดงตัวอย่าง'",
  noSignal: "ไม่มีสัญญาณ",

  // ── Settings ─────────────────────────────────────────────────
  settingsTitle: "การตั้งค่าแอปพลิเคชัน",
  settingsDesc: "กำหนดค่าเริ่มต้นสำหรับการบันทึก",
  langSection: "Language / ภาษา",
  langHint: "เลือกภาษาที่ใช้แสดงผลในหน้าจอ",
  systemAudioLabel: "รวมเสียงระบบ",
  systemAudioDesc: "บันทึกเสียงที่เล่นจากระบบ (ถ้า OS รองรับ)",
  saveSettings: "บันทึกการตั้งค่า",
  saving: "กำลังบันทึก…",
  resetForm: "รีเซ็ตฟอร์ม",
  statusLabel: "สถานะ",
  runtimeLabel: "โหมด",
  runtimeDesktop: "โปรไฟล์เดสก์ท็อป Electron",
  runtimeBrowser: "โปรไฟล์เบราว์เซอร์",
  configPathLabel: "ที่อยู่ไฟล์ตั้งค่า",
  // ── Save path ─────────────────────────────────────────────────
  savePathSection: "โฟลเดอร์บันทึกวิดีโอ",
  savePathHint: "เลือกโฟลเดอร์สำหรับจัดเก็บไฟล์วิดีโอที่บันทึกไว้",
  savePathNotSet: "ยังไม่ได้ตั้งค่า — จะถามก่อนเริ่มบันทึก",
  savePathBrowse: "เลือกโฟลเดอร์…",
  savePathChange: "เปลี่ยนโฟลเดอร์",
  savePathRequired: "กรุณาเลือกโฟลเดอร์บันทึกก่อนเริ่มอัดวิดีโอ",
  savePathSaved: "บันทึกไปที่:",
};

export const translations: Record<Lang, Translations> = { en, th };
