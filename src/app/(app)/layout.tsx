import { FlashMessage } from "@/components/flash-message";
import { SetupNeeded } from "@/components/setup-needed";
import { Sidebar } from "@/components/sidebar";
import { isSupabaseConfigured } from "@/lib/env";

export default function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="px-4 py-16">
        <SetupNeeded />
      </main>
    );
  }

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <FlashMessage />
    </div>
  );
}
