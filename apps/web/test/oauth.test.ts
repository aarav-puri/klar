import { describe, expect, it } from "vitest";
import { authorizationHeader, parseTokenResponse, percentEncode, sign, signatureBaseString } from "@/server/schoology/oauth";

describe("OAuth 1.0a signing", () => {
  // Test vector from the OAuth 1.0 specification (Appendix A.5).
  it("matches the specification example signature", () => {
    const params: [string, string][] = [
      ["oauth_consumer_key", "dpf43f3p2l4k3l03"],
      ["oauth_token", "nnch734d00sl2jdk"],
      ["oauth_signature_method", "HMAC-SHA1"],
      ["oauth_timestamp", "1191242096"],
      ["oauth_nonce", "kllo9940pd9333jh"],
      ["oauth_version", "1.0"],
    ];
    const base = signatureBaseString("GET", "http://photos.example.net/photos?file=vacation.jpg&size=original", params);
    expect(base).toBe(
      "GET&http%3A%2F%2Fphotos.example.net%2Fphotos&file%3Dvacation.jpg%26oauth_consumer_key%3Ddpf43f3p2l4k3l03%26oauth_nonce%3Dkllo9940pd9333jh%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1191242096%26oauth_token%3Dnnch734d00sl2jdk%26oauth_version%3D1.0%26size%3Doriginal",
    );
    expect(sign(base, "kd94hf93k423kf44", "pfkkdhi9sl3r4s00")).toBe("tR3+Ty81lMeYAr/Fid0kMTYa/WM=");
  });

  it("builds a header with the Schoology realm and encoded values", () => {
    const h = authorizationHeader("GET", "https://api.schoology.com/v1/users/me", { consumerKey: "k", consumerSecret: "s", token: "t", tokenSecret: "ts" }, {}, { nonce: "n", timestamp: "1" });
    expect(h.startsWith('OAuth realm="Schoology API", ')).toBe(true);
    expect(h).toContain('oauth_token="t"');
    expect(h).toMatch(/oauth_signature="[^"]+"/);
  });

  it("percent-encodes reserved characters per RFC 3986", () => {
    expect(percentEncode("a b!*'()")).toBe("a%20b%21%2A%27%28%29");
  });

  it("parses token responses", () => {
    expect(parseTokenResponse("oauth_token=abc&oauth_token_secret=def")).toEqual({ token: "abc", secret: "def" });
    expect(parseTokenResponse("error=nope")).toBeNull();
  });
});
