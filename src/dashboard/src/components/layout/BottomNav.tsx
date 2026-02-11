import { Telescope, BookOpen, Compass, Sun, Brain, TrendingUp, Wrench, User } from "lucide-react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Telescope },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/quests", label: "Quests", icon: Compass },
  { to: "/cosmos", label: "Cosmos", icon: Sun },
  { to: "/reflection", label: "Identity", icon: User },
  { to: "/intelligence", label: "Mirror", icon: Brain },
  { to: "/progression", label: "Ascent", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Wrench },
] as const;

/**
 * Mobile bottom tab bar — fixed at bottom of viewport on mobile.
 * Mimics iOS native tab bar patterns: icon + small label, 44px min touch target.
 */
export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-surface-raised/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex justify-around items-stretch">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] py-1.5 px-1 text-[10px] leading-tight transition-colors duration-fast ${
                isActive ? "text-accent font-medium" : "text-ink-3"
              }`
            }
          >
            <item.icon size={20} strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
