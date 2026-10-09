/**
 * Bridge content script. Runs only on allow-listed Klar web app origins.
 *
 * The page cannot call chrome.runtime directly without knowing the extension
 * id, so it posts window messages that this script validates and relays. Any
 * message that is not from this exact window and origin, or does not match
 * the protocol schema, is ignored.
 */
import { EXT_SOURCE, isAllowedOrigin, parseAppEnvelope, PROTOCOL_VERSION } from "@klar/core/protocol";

const VERSION = __EXT_VERSION__;

if (isAllowedOrigin(location.origin, __APP_ORIGINS__)) {
  // Lets the page detect the extension synchronously, without a round trip.
  document.documentElement.dataset.klarExtension = VERSION;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const envelope = parseAppEnvelope(event.data);
    if (!envelope) return;

    chrome.runtime
      .sendMessage({ kind: "app-request", envelope })
      .then((response) => window.postMessage(response, location.origin))
      .catch((error: unknown) => {
        // Typically "Extension context invalidated" after an update/reload.
        window.postMessage(
          {
            source: EXT_SOURCE,
            version: PROTOCOL_VERSION,
            id: envelope.id,
            result: {
              ok: false,
              error: {
                code: "INTERNAL",
                message: error instanceof Error && /invalidated/.test(error.message)
                  ? "The extension was updated. Reload this page."
                  : "The extension did not respond.",
              },
            },
          },
          location.origin,
        );
      });
  });

  // Events pushed by the background worker (sync progress, new captures).
  chrome.runtime.onMessage.addListener((message: unknown, sender) => {
    if (sender.id !== chrome.runtime.id) return;
    if (typeof message === "object" && message && (message as { kind?: string }).kind === "ext-event") {
      window.postMessage((message as { event: unknown }).event, location.origin);
    }
  });
}
