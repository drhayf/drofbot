import { MapPin, Calendar, Clock } from "lucide-react";
import type { IdentityProfile } from "../../types/identity";
import { Card, CardContent } from "../shared/Card";

interface IdentityCoreProps {
  profile: IdentityProfile | null;
}

export function IdentityCore({ profile }: IdentityCoreProps) {
  if (!profile?.birthData) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-ink-3">
          <p>Set your birth data to unlock your Cosmic Blueprint.</p>
        </CardContent>
      </Card>
    );
  }

  const { birthData, humanDesign, cardology } = profile;
  const date = new Date(birthData.datetime);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-ink-1">Core Identity</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Birth Data Card */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-medium text-ink-2 mb-4 uppercase tracking-wider">
              Birth Moment
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-accent" />
                <span className="text-ink-1">
                  {date.toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-ink-1">
                  {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-accent" />
                <span className="text-ink-1">
                  {birthData.latitude.toFixed(2)}°, {birthData.longitude.toFixed(2)}°
                  {birthData.locationName && ` (${birthData.locationName})`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Human Design Card */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-medium text-ink-2 mb-4 uppercase tracking-wider">
              Human Design
            </h3>
            {humanDesign ? (
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-ink-3 block">Type</span>
                  <span className="text-ink-1 font-medium">{humanDesign.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-ink-3 block">Profile</span>
                    <span className="text-ink-1">{humanDesign.profile}</span>
                  </div>
                  <div>
                    <span className="text-xs text-ink-3 block">Authority</span>
                    <span className="text-ink-1">{humanDesign.authority}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-ink-3 block">Strategy</span>
                  <span className="text-ink-1">{humanDesign.strategy}</span>
                </div>
              </div>
            ) : (
              <div className="text-ink-3 text-sm italic">Not calculated</div>
            )}
          </CardContent>
        </Card>

        {/* Cardology Card */}
        {cardology && (
          <Card>
            <CardContent>
              <h3 className="text-sm font-medium text-ink-2 mb-4 uppercase tracking-wider">
                Cardology
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-16 bg-surface-raised border border-border-subtle rounded flex items-center justify-center text-xl font-display shadow-sm">
                  {cardology.birthCard}
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-xs text-ink-3 block">Birth Card</span>
                    <span className="text-ink-1 font-medium">{cardology.birthCard}</span>
                  </div>
                  <div>
                    <span className="text-xs text-ink-3 block">Zodiac Ruler</span>
                    <span className="text-ink-1 font-medium">{cardology.planetaryRuler}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
