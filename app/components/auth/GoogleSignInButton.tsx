import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  clientId?: string;
  text?: "signin_with" | "signup_with" | "continue_with";
  onCredential: (credential: string) => void;
}

export function GoogleSignInButton({
  clientId,
  text = "continue_with",
  onCredential,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity="true"]'
    );

    const renderButton = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            onCredential(response.credential);
          }
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text,
        shape: "pill",
        width: 320,
      });
    };

    if (existingScript) {
      if (window.google?.accounts?.id) renderButton();
      else existingScript.addEventListener("load", renderButton, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.addEventListener("load", renderButton, { once: true });
    document.head.appendChild(script);
  }, [clientId, onCredential, text]);

  if (!clientId) return null;

  return <div ref={buttonRef} style={{ display: "flex", justifyContent: "center" }} />;
}
