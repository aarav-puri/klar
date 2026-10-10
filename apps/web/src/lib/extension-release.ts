/**
 * The extension download students install until Klar is on the Chrome Web
 * Store. When publishing a new release zip, update the version, the hash and
 * the VirusTotal result for that exact file.
 */
export const EXTENSION_RELEASE = {
  version: "0.1.0",
  downloadUrl: "https://github.com/aarav-puri/klar/releases/download/extension-v0.1.0/klar-extension.zip",
  releaseUrl: "https://github.com/aarav-puri/klar/releases/tag/extension-v0.1.0",
  sha256: "1259f083cc7a9f8fcec519f2463a27a0682cd1b6d021c2a8384da505ff32535d",
  virusTotal: {
    url: "https://www.virustotal.com/gui/file/1259f083cc7a9f8fcec519f2463a27a0682cd1b6d021c2a8384da505ff32535d",
    flagged: 0,
    engines: 65,
  },
} as const;
