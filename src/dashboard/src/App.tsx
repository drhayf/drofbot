import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell";
import Cosmos from "./pages/Cosmos";
import Home from "./pages/Home";
import { Identity } from "./pages/Identity";
import HypothesisDetail from "./pages/HypothesisDetail";
import Intelligence from "./pages/Intelligence";
import Journal from "./pages/Journal";
import JournalCreate from "./pages/JournalCreate";
import JournalEntry from "./pages/JournalEntry";
import Login from "./pages/Login";
import Progression from "./pages/Progression";
import Quests from "./pages/Quests";
import Settings from "./pages/Settings";
import { useAuthStore } from "./stores/auth";

function ProtectedRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/journal/new" element={<JournalCreate />} />
        <Route path="/journal/:id" element={<JournalEntry />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/cosmos" element={<Cosmos />} />
        <Route path="/reflection" element={<Identity />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/intelligence/:id" element={<HypothesisDetail />} />
        <Route path="/progression" element={<Progression />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={isAuthenticated ? <ProtectedRoutes /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
