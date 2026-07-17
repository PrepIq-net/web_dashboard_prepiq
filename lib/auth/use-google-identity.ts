"use client";

import { useEffect, useRef, useState } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
      use_fedcm_for_prompt?: boolean;
    }) => void;
    prompt: () => void;
  };
};

type GoogleWindow = Window & {
  google?: {
    accounts?: GoogleAccounts;
  };
};

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export type UseGoogleIdentityOptions = {
  /** Receives the Google ID token after the user completes the popup. */
  onCredential: (idToken: string) => void | Promise<void>;
  /** Surfaced for config/script/credential failures. */
  onError: (message: string) => void;
};

/**
 * Loads the Google Identity Services script (client id fetched from
 * /api/auth/google/config) and exposes a `prompt()` to open the sign-in
 * flow. Shared by the login and register pages.
 */
export function useGoogleIdentity({ onCredential, onError }: UseGoogleIdentityOptions) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Keep the latest callbacks without re-initializing the GSI client.
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/auth/google/config", { cache: "no-store" });
        const payload = (await response.json()) as { clientId?: string; message?: string };

        if (!response.ok || !payload.clientId) {
          throw new Error(payload.message ?? "Google sign-in is not configured.");
        }
        if (active) {
          setClientId(payload.clientId);
        }
      } catch (error) {
        if (active) {
          onErrorRef.current(
            error instanceof Error ? error.message : "Failed to initialize Google login.",
          );
        }
      }
    }

    loadConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const initialize = () => {
      const accounts = (window as GoogleWindow).google?.accounts;

      if (!accounts?.id) {
        onErrorRef.current("Google Identity script did not load correctly.");
        return;
      }

      accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        callback: (response) => {
          if (!response.credential) {
            onErrorRef.current("Google sign-in failed. Missing credential token.");
            return;
          }
          void onCredentialRef.current(response.credential);
        },
      });

      setReady(true);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_SRC}"]`,
    );

    if (existingScript) {
      initialize();
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    script.onerror = () => {
      onErrorRef.current("Unable to load Google Identity script.");
    };

    document.head.appendChild(script);
  }, [clientId]);

  function prompt() {
    if (!ready) {
      return false;
    }
    (window as GoogleWindow).google?.accounts?.id.prompt();
    return true;
  }

  return { ready, configured: Boolean(clientId), prompt };
}
