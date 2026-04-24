import { AppShell } from "@/components/layout/AppShell";
import { RecorderWorkspace } from "@/components/recorder/RecorderWorkspace";

export default function Home() {
  return (
    <AppShell>
      <RecorderWorkspace />
    </AppShell>
  );
}
