import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { BrowserNotificationManager } from "@/components/layout/browser-notification-manager";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { TopBar } from "@/components/layout/top-bar";
import { TourOverlay } from "@/components/layout/tour-overlay";
import { getServerAuthSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/signin");
  }

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen bg-surface">
        <Sidebar sessionUser={session.user} />
        <main className="md:ml-64 flex min-h-screen flex-1 flex-col bg-surface min-w-0 overflow-hidden">
          <TopBar />
          <BrowserNotificationManager />
          <div className="flex-1 p-4 md:p-8 min-w-0 overflow-hidden">{children}</div>
        </main>
        <TourOverlay />
      </div>
    </MobileNavProvider>
  );
}
