import { type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { Nav } from "./Nav";
import { OfflineBanner } from "./OfflineBanner";
import { ToastContainer } from "./Toast";

interface ShellProps {
  children: ReactNode;
}

/**
 * App Shell — the persistent layout wrapping all pages.
 * Desktop: sidebar nav + header + content area.
 * Mobile: header + content + bottom tab nav (BottomNav component).
 */
export default function Shell({ children }: ShellProps) {
  return (
    <div className="flex h-screen bg-ground-1">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-border-subtle bg-ground-2">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border-subtle">
          <span className="font-display text-lg text-ink-1">Drofbot</span>
        </div>
        <Nav orientation="vertical" />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <OfflineBanner />
        <main className="flex-1 overflow-auto">
          <div className="page-enter max-w-content mx-auto px-4 md:px-6 lg:px-8 py-6 pb-24 md:pb-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar — 44px touch targets, safe area padding */}
        <BottomNav />
      </div>

      {/* Toast notifications — top-right overlay */}
      <ToastContainer />
    </div>
  );
}
