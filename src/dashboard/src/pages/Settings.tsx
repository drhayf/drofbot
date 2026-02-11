import { useEffect, useState, useCallback } from "react";
import { ModelSelector } from "../components/settings/ModelSelector";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import { usePreferencesStore } from "../stores/preferences";

const COSMIC_SYSTEMS = [
  "cardology",
  "iching",
  "humandesign",
  "astrology",
  "solar",
  "lunar",
  "genekeys",
] as const;

const CHANNELS = ["telegram", "discord", "whatsapp", "signal", "web", "slack"] as const;

/**
 * The Forge — settings and preferences management.
 */
export default function Settings() {
  const { preferences, briefings, isLoading, fetch, fetchBriefings, update, updateBriefings } =
    usePreferencesStore();

  const [saved, setSaved] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<Record<string, unknown>>({});
  const [localBriefings, setLocalBriefings] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetch();
    fetchBriefings();
  }, [fetch, fetchBriefings]);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    if (briefings) setLocalBriefings(briefings as Record<string, unknown>);
  }, [briefings]);

  const handleSave = useCallback(async () => {
    await update(localPrefs);
    await updateBriefings(localBriefings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [localPrefs, localBriefings, update, updateBriefings]);

  const setPref = (key: string, value: unknown) => {
    setLocalPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const setBriefing = (key: string, value: unknown) => {
    setLocalBriefings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSystem = (system: string) => {
    const current = (localPrefs.activeSystems as string[]) ?? [];
    const next = current.includes(system)
      ? current.filter((s) => s !== system)
      : [...current, system];
    setPref("activeSystems", next);
  };

  const toggleChannel = (channel: string) => {
    const current = (localBriefings.channels as string[]) ?? [];
    const next = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    setBriefing("channels", next);
  };

  if (isLoading) return <LoadingPulse />;

  const theme = (localPrefs.theme as string) ?? "system";
  const density = (localPrefs.density as string) ?? "comfortable";
  const animations = (localPrefs.animations as boolean) ?? true;
  const notifications = (localPrefs.notifications as boolean) ?? true;
  const activeSystems = (localPrefs.activeSystems as string[]) ?? [];
  const briefingTime = (localBriefings.morningTime as string) ?? "08:00";
  const eveningTime = (localBriefings.eveningTime as string) ?? "20:00";
  const briefingChannels = (localBriefings.channels as string[]) ?? [];
  const briefingSystems = (localBriefings.systems as string[]) ?? [];

  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink-1">The Forge</h1>
          <p className="text-sm text-ink-3 mt-1">Preferences and configuration</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-positive animate-fade-in">Saved!</span>}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-light transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-base text-ink-1">Display</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-ink-2 mb-1" htmlFor="theme">
                Theme
              </label>
              <select
                id="theme"
                value={theme}
                onChange={(e) => setPref("theme", e.target.value)}
                className="w-full max-w-xs bg-surface-inset border border-border rounded-lg px-3 py-2 text-sm text-ink-1"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-ink-2 mb-1" htmlFor="density">
                Density
              </label>
              <select
                id="density"
                value={density}
                onChange={(e) => setPref("density", e.target.value)}
                className="w-full max-w-xs bg-surface-inset border border-border rounded-lg px-3 py-2 text-sm text-ink-1"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </div>

            <div className="flex items-center justify-between max-w-xs">
              <label className="text-sm text-ink-2" htmlFor="animations">
                Animations
              </label>
              <input
                id="animations"
                type="checkbox"
                checked={animations}
                onChange={(e) => setPref("animations", e.target.checked)}
                className="rounded"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <ModelSelector />

      {/* Cosmic Preferences */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-base text-ink-1">Cosmic Systems</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-3 mb-3">
            Choose which systems to include in weather and analysis.
          </p>
          <div className="flex flex-wrap gap-2">
            {COSMIC_SYSTEMS.map((system) => (
              <button
                key={system}
                onClick={() => toggleSystem(system)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  activeSystems.includes(system)
                    ? "bg-accent text-white"
                    : "bg-ground-3 text-ink-2 hover:bg-ground-4"
                }`}
              >
                {system}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Briefing Preferences */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-base text-ink-1">Briefing Schedule</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div>
                <label className="block text-sm text-ink-2 mb-1" htmlFor="morningTime">
                  Morning
                </label>
                <input
                  id="morningTime"
                  type="time"
                  value={briefingTime}
                  onChange={(e) => setBriefing("morningTime", e.target.value)}
                  className="w-full bg-surface-inset border border-border rounded-lg px-3 py-2 text-sm text-ink-1"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-2 mb-1" htmlFor="eveningTime">
                  Evening
                </label>
                <input
                  id="eveningTime"
                  type="time"
                  value={eveningTime}
                  onChange={(e) => setBriefing("eveningTime", e.target.value)}
                  className="w-full bg-surface-inset border border-border rounded-lg px-3 py-2 text-sm text-ink-1"
                />
              </div>
            </div>

            <div>
              <p className="text-sm text-ink-2 mb-2">Briefing channels</p>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => toggleChannel(channel)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      briefingChannels.includes(channel)
                        ? "bg-accent text-white"
                        : "bg-ground-3 text-ink-2 hover:bg-ground-4"
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-ink-2 mb-2">Briefing systems</p>
              <div className="flex flex-wrap gap-2">
                {COSMIC_SYSTEMS.map((system) => (
                  <button
                    key={system}
                    onClick={() => toggleSystem(system)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      (briefingSystems ?? []).includes(system)
                        ? "bg-accent text-white"
                        : "bg-ground-3 text-ink-2 hover:bg-ground-4"
                    }`}
                  >
                    {system}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-base text-ink-1">Notifications</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between max-w-xs">
            <label className="text-sm text-ink-2" htmlFor="notifications">
              Enable notifications
            </label>
            <input
              id="notifications"
              type="checkbox"
              checked={notifications}
              onChange={(e) => setPref("notifications", e.target.checked)}
              className="rounded"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
