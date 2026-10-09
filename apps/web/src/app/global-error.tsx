"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Klar hit an unexpected error</h1>
          <p style={{ color: "#66788a" }}>Your Schoology data isn&rsquo;t affected.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: 0, background: "#0677ba", color: "#fff", fontWeight: 600 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
