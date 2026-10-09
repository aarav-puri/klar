/**
 * Gradebook reader. Injected only on https://<school>/grades/grades.
 *
 * It first asks the background worker whether the student has consented to
 * Klar reading this host. Only then does it read the rendered gradebook
 * (never cookies, storage or form fields) and hand the result back.
 */
import { parseGradesPage } from "@klar/core/schoology-dom";

const WAIT_MS = 6_000;

function waitForGradebook(): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(".gradebook-course")) return resolve();
    const observer = new MutationObserver(() => {
      if (document.querySelector(".gradebook-course")) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, WAIT_MS);
  });
}

async function main() {
  const { read } = (await chrome.runtime.sendMessage({ kind: "capture-hello" })) as { read: boolean };
  if (!read) return;
  await waitForGradebook();
  const outcome = parseGradesPage(document, location.href);
  await chrome.runtime.sendMessage({ kind: "capture-result", outcome });
}

main().catch(() => undefined);
