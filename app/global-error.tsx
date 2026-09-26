"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[aperio] global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#f7f8fc",
          color: "#111522",
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: "#4f46e5" }}>
            Application error
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: 26, letterSpacing: "-.03em" }}>Aperio needs to reload.</h1>
          <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#6c7488" }}>
            A critical error stopped the app. Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              height: 40,
              padding: "0 20px",
              borderRadius: 10,
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
