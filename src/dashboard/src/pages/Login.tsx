import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

/**
 * Login page — single token input field.
 * Uses DROFBOT_DASHBOARD_TOKEN for auth.
 */
export default function Login() {
  const [token, setToken] = useState("");
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    const ok = await login(token.trim());
    if (ok) {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-ground-default flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-ink-primary mb-2">Drofbot</h1>
          <p className="text-ink-secondary text-sm">Enter your dashboard token to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-xs font-medium text-ink-secondary mb-1.5">
              Dashboard Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter token..."
              autoFocus
              className="w-full px-3 py-2.5 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-primary placeholder:text-ink-ghost focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent-main transition-colors"
            />
          </div>

          {error && <p className="text-sm text-semantic-error">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || !token.trim()}
            className="w-full py-2.5 px-4 bg-accent-main text-white rounded-lg text-sm font-medium hover:bg-accent-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-ink-ghost mt-6">
          Set via DROFBOT_DASHBOARD_TOKEN environment variable
        </p>
      </div>
    </div>
  );
}
