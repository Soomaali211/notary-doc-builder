import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { isOffline } from "@/lib/notary/offlineMode";

/**
 * Who the notary is, on THIS machine.
 *
 * §3 — the offline notary system has no account to sign into: the office's
 * data lives on the office's own computer, and there is no server to ask. So
 * in offline mode this hook returns a LOCAL identity and never reaches for a
 * cloud provider — the pages that call it (Landing, RequireAuth, the logo
 * menu) render exactly as they always did, without a socket that an offline
 * machine cannot open.
 *
 * The branch is decided ONCE, at module load, and never again. That matters:
 * a hook cannot change which hooks it calls between renders, and "offline"
 * cannot change either, because the Convex provider is mounted or not mounted
 * at boot by `main.tsx`. Turning offline mode off in Settings therefore takes
 * effect on the next reload — which is stated to the user there — instead of
 * tearing down half the hook tree mid-session.
 */
const OFFLINE_BOOT = isOffline();

/** The local office identity. No email, no avatar: it is one office, one machine. */
const LOCAL_USER = {
  name: "Xafiiska",
  email: undefined,
  image: undefined,
  isAnonymous: true,
  role: "user" as const,
};

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  /** The signed-in user, or null when nobody is signed in. */
  user: typeof LOCAL_USER | null;
  /**
   * The real cloud sign-in takes a provider name and its params; the local
   * no-op accepts and ignores them so the call sites never change. The params
   * are typed as the call sites actually use them (a form body or nothing)
   * rather than as the cloud library's own type, so this hook does not drag
   * its generics into every page that signs in.
   */
  signIn: (
    provider: string,
    params?: FormData | Record<string, unknown>,
  ) => void | Promise<void>;
  signOut: () => void | Promise<void>;
}

/** The cloud identity — the original behaviour, unchanged. */
function useCloudAuth(): AuthState {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user: (user as AuthState["user"]) ?? null,
    // Wrapped so this hook's own signature stays simple for the pages that
    // call it; the cloud library still owns what actually happens.
    signIn: async (provider: string, params?: FormData | Record<string, unknown>) => {
      await signIn(provider, params as never);
    },
    signOut,
  };
}

/** The local identity — always signed in, because there is nothing to sign into. */
function useLocalAuth(): AuthState {
  return {
    isLoading: false,
    isAuthenticated: true,
    user: LOCAL_USER,
    // The office's machine has no sign-in flow. Both are honest no-ops: the
    // notary is already "in", and signing out would only lock them out of
    // their own data.
    signIn: () => undefined,
    signOut: () => undefined,
  };
}

export function useAuth(): AuthState {
  return OFFLINE_BOOT ? useLocalAuth() : useCloudAuth();
}