import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { pruneExpiredCaches } from "./hooks/useMessageCache";

// Clean up stale message caches on startup
pruneExpiredCaches();

createRoot(document.getElementById("root")!).render(
  <App />
);