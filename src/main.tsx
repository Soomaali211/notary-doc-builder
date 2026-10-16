import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { isOffline } from "./lib/notary/offlineMode";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const NewDocument = lazy(() => import("./pages/NewDocument.tsx"));
const NewDocumentInterview = lazy(() => import("./pages/NewDocumentInterview.tsx"));
const DocumentDetailPage = lazy(() => import("./pages/DocumentDetail.tsx"));
const Documents = lazy(() => import("./pages/Documents.tsx"));
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const Templates = lazy(() => import("./pages/Templates.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
// The four tabs whose page rebuilds come next; one line each until then.
import Soon from "./pages/Soon.tsx";
import Clients from "./pages/Clients.tsx";
import Payments from "./pages/Payments.tsx";

/** Redirect that carries the query string along (?q=…, ?status=…). */
function Redirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Waa la soo rarayaa…</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Qalad ayaa la sameeyay</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * §3 — THE OFFLINE BOOT.
 *
 * In offline mode (the default) the app never constructs a Convex client and
 * never mounts a Convex provider. That is deliberate: a reactive provider
 * above the tree would let any `useQuery` still present in a code path try to
 * open a socket and fail noisily. Without it, the offline notary app is a
 * plain React app with a plain router — which is what it actually is.
 *
 * The flag is read synchronously on purpose: a value in localStorage must not
 * make the app flash a spinner before it knows what it is.
 */
const OFFLINE = isOffline();
const convex = OFFLINE
  ? null
  : new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** Every route. Rendered either inside or outside the cloud provider. */
function App() {
  return (
    <BrowserRouter>
      <RouteSyncer />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/auth"
            element={<AuthPage redirectAfterAuth="/documents" />}
          />
          {/* The front page is the document archive. */}
          <Route
            path="/documents"
            element={
              <RequireAuth>
                <Documents />
              </RequireAuth>
            }
          />
          {/* old front page + old archive path keep their links alive */}
          <Route path="/dashboard" element={<Redirect to="/documents" />} />
          <Route path="/archive" element={<Redirect to="/documents" />} />
          <Route
            path="/new"
            element={
              <RequireAuth>
                <NewDocument />
              </RequireAuth>
            }
          />
          <Route
            path="/documents/:docId"
            element={
              <RequireAuth>
                <NewDocumentInterview />
              </RequireAuth>
            }
          />
          <Route
            path="/archive/:docId"
            element={
              <RequireAuth>
                <DocumentDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/catalog"
            element={
              <RequireAuth>
                <Catalog />
              </RequireAuth>
            }
          />
          <Route
            path="/templates"
            element={
              <RequireAuth>
                <Templates />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          {/* The other four tabs — rebuilt one page per step. */}
          <Route
            path="/clients"
            element={
              <RequireAuth>
                <Clients />
              </RequireAuth>
            }
          />
          <Route
            path="/payments"
            element={
              <RequireAuth>
                <Payments />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <Soon titleKey="soonTitleReports" />
              </RequireAuth>
            }
          />
          <Route
            path="/habayn"
            element={
              <RequireAuth>
                <Soon titleKey="soonTitleSettings" />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      {convex ? (
        <ConvexAuthProvider client={convex}>
          <App />
        </ConvexAuthProvider>
      ) : (
        <App />
      )}
      <Toaster />
    </RootErrorBoundary>
  </StrictMode>,
);