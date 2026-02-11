import { Telescope, BookOpen, Compass, Sun, Brain, TrendingUp, Wrench, User } from "lucide-react";
import { NavLink } from "react-router-dom";

interface NavProps {
  orientation: "vertical" | "horizontal";
}

const NAV_ITEMS = [
  { to: "/", label: "Observatory", subtitle: "Home", icon: Telescope },
  { to: "/journal", label: "Chronicle", subtitle: "Journal", icon: BookOpen },
  { to: "/quests", label: "The Path", subtitle: "Quests", icon: Compass },
  { to: "/cosmos", label: "Weather", subtitle: "Cosmos", icon: Sun },
  { to: "/reflection", label: "The Reflection", subtitle: "Identity", icon: User },
  { to: "/intelligence", label: "The Mirror", subtitle: "Intelligence", icon: Brain },
  { to: "/progression", label: "The Ascent", subtitle: "Progression", icon: TrendingUp },
  { to: "/settings", label: "The Forge", subtitle: "Settings", icon: Wrench },
] as const;

/**
 * Navigation component — adapts to vertical (sidebar) or horizontal (bottom bar).
 */
export function Nav({ orientation }: NavProps) {
  if (orientation === "horizontal") {
    return (
      <div className="flex justify-around py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors duration-fast ${
                isActive ? "text-accent" : "text-ink-3 hover:text-ink-2"
              }`
            }
          >
            <item.icon size={20} strokeWidth={1.5} />
            <span>{item.subtitle}</span>
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-card text-sm transition-all duration-fast ${
              isActive
                ? "bg-accent-subtle text-accent font-medium"
                : "text-ink-2 hover:bg-ground-3 hover:text-ink-1"
            }`
          }
        >
          <item.icon size={18} strokeWidth={1.5} />
          <div className="flex flex-col">
            <span>{item.label}</span>
            <span className="text-xs text-ink-4">{item.subtitle}</span>
          </div>
        </NavLink>
      ))}
    </nav>
  );
}
