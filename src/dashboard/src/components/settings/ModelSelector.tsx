import { useEffect, useState, useCallback } from "react";
import { useModelsStore } from "../../stores/models";
import { Card, CardContent, CardHeader } from "../shared/Card";
import { LoadingPulse } from "../shared/LoadingPulse";

/**
 * Model Selector component for the Settings / Forge page.
 * Shows current model, allows browsing/searching OpenRouter models,
 * and switching or resetting the active model.
 */
export function ModelSelector() {
  const {
    models,
    currentModel,
    isLoading,
    isApplying,
    error,
    searchQuery,
    fetchModels,
    fetchCurrent,
    setModel,
    clearModel,
    refreshRegistry,
    setSearchQuery,
  } = useModelsStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (q.trim().length >= 2) {
        fetchModels(q.trim());
        setShowList(true);
      } else if (q.trim().length === 0) {
        setShowList(false);
      }
    },
    [fetchModels, setSearchQuery],
  );

  const handleBrowse = useCallback(() => {
    fetchModels(searchQuery || undefined);
    setShowList(true);
  }, [fetchModels, searchQuery]);

  const handleApply = useCallback(async () => {
    if (!selectedId) return;
    await setModel(selectedId);
    setSelectedId(null);
    setShowList(false);
  }, [selectedId, setModel]);

  const handleReset = useCallback(async () => {
    await clearModel();
    setSelectedId(null);
  }, [clearModel]);

  const selectedModel = models.find((m) => m.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base text-ink-1">Model</h2>
          <button
            onClick={() => refreshRegistry()}
            className="text-xs text-ink-3 hover:text-accent transition-colors"
            title="Refresh model list from OpenRouter"
          >
            ↻ Refresh
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Model */}
          <div className="p-3 bg-surface-inset rounded-lg border border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-2">Active Model</p>
                <p className="text-sm font-mono text-ink-1 mt-0.5">
                  {currentModel?.model ?? "Loading..."}
                </p>
                {currentModel?.name && (
                  <p className="text-xs text-ink-3 mt-0.5">{currentModel.name}</p>
                )}
              </div>
              <div className="text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                    currentModel?.source === "preference"
                      ? "bg-accent/20 text-accent"
                      : "bg-ground-3 text-ink-3"
                  }`}
                >
                  {currentModel?.source === "preference" ? "Custom" : "Default"}
                </span>
              </div>
            </div>
            {currentModel?.pricing && (
              <p className="text-xs text-ink-3 mt-2">{currentModel.pricing}</p>
            )}
            {currentModel?.contextLength && (
              <p className="text-xs text-ink-3">
                Context: {(currentModel.contextLength / 1000).toFixed(0)}k tokens
              </p>
            )}
          </div>

          {/* Reset Button */}
          {currentModel?.source === "preference" && (
            <button
              onClick={handleReset}
              disabled={isApplying}
              className="text-sm text-ink-3 hover:text-negative transition-colors disabled:opacity-50"
            >
              ← Reset to default ({currentModel.envDefault})
            </button>
          )}

          {/* Search / Browse */}
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search models (e.g. claude, gpt, deepseek)..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1 bg-surface-inset border border-border rounded-lg px-3 py-2 text-sm text-ink-1 placeholder:text-ink-3"
              />
              <button
                onClick={handleBrowse}
                className="px-3 py-2 bg-ground-3 text-ink-2 rounded-lg text-sm hover:bg-ground-4 transition-colors"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Model List */}
          {showList && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {isLoading ? (
                <LoadingPulse />
              ) : models.length === 0 ? (
                <p className="text-sm text-ink-3 py-2">No models found.</p>
              ) : (
                models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
                      m.id === selectedId
                        ? "bg-accent/10 border border-accent/30"
                        : m.id === currentModel?.model
                          ? "bg-surface-inset border border-border-subtle"
                          : "hover:bg-surface-inset border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-ink-1 truncate">{m.id}</p>
                        <p className="text-xs text-ink-3 truncate">{m.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-xs text-ink-3">{m.pricing}</p>
                        <p className="text-xs text-ink-3">
                          {(m.contextLength / 1000).toFixed(0)}k ctx
                        </p>
                      </div>
                    </div>
                    {m.id === currentModel?.model && (
                      <span className="text-xs text-accent mt-1 inline-block">Current</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected Model Details + Apply */}
          {selectedId && selectedModel && selectedId !== currentModel?.model && (
            <div className="p-3 bg-surface-inset rounded-lg border border-accent/30">
              <p className="text-sm text-ink-1 font-medium">{selectedModel.name}</p>
              <p className="font-mono text-xs text-ink-2 mt-0.5">{selectedModel.id}</p>
              <p className="text-xs text-ink-3 mt-1">{selectedModel.pricing}</p>
              <p className="text-xs text-ink-3">
                Context: {(selectedModel.contextLength / 1000).toFixed(0)}k tokens
              </p>
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="mt-3 px-4 py-1.5 bg-accent text-white rounded-lg text-sm hover:bg-accent-light transition-colors disabled:opacity-50"
              >
                {isApplying ? "Applying..." : "Apply Model"}
              </button>
            </div>
          )}

          {/* Error display */}
          {error && <p className="text-sm text-negative">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
