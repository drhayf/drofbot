import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { CosmicRibbon } from "../components/viz";
import { useCosmicStore } from "../stores/cosmic";
import { useJournalStore } from "../stores/journal";

/**
 * New journal entry form with live cosmic context.
 */
export default function JournalCreate() {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createEntry } = useJournalStore();
  const { weather } = useCosmicStore();
  const navigate = useNavigate();

  const card = weather?.card;
  const lunar = weather?.lunar;
  const solar = weather?.solar;
  const gate = weather?.gate;
  const synthesis = weather?.synthesis;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError(null);

    const entry = await createEntry({
      content: content.trim(),
      mood: mood.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSubmitting(false);

    if (entry) {
      navigate(`/journal/${entry.id}`);
    } else {
      setError("Failed to save entry. Please try again.");
    }
  };

  return (
    <div className="space-y-6 page-transition">
      <Link
        to="/journal"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Chronicle
      </Link>

      <h1 className="font-display text-2xl text-ink-1">New Entry</h1>

      {/* Live cosmic context */}
      <Card>
        <CardHeader>
          <h3 className="font-display text-sm text-ink-1">Current Cosmic Weather</h3>
        </CardHeader>
        <CardContent>
          <CosmicRibbon
            card={card?.name}
            moonPhase={lunar?.phase}
            moonIllumination={lunar?.illumination}
            kpIndex={solar?.kpIndex}
            gate={gate ? `${gate.number ?? ""}${gate.line ? `.${gate.line}` : ""}` : undefined}
            resonance={synthesis?.overallResonance}
          />
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label htmlFor="content" className="block text-xs font-medium text-ink-2 mb-1.5">
            What's on your mind?
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            autoFocus
            className="w-full px-3 py-2.5 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y"
            placeholder="Write freely..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="mood" className="block text-xs font-medium text-ink-2 mb-1.5">
              Mood (optional)
            </label>
            <input
              id="mood"
              type="text"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full px-3 py-2 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
              placeholder="reflective, energized..."
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-xs font-medium text-ink-2 mb-1.5">
              Tags (comma separated)
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors"
              placeholder="dream, insight..."
            />
          </div>
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "Save Entry"}
        </button>
      </form>
    </div>
  );
}
