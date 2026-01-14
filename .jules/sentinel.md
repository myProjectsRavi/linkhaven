## 2026-01-14 - [High] JSON Import XSS Vulnerability
**Vulnerability:** The bookmark import functionality (JSON format) lacked URL validation, allowing `javascript:` and `data:` protocols to be imported as valid bookmarks.
**Learning:** Parsing JSON directly into internal data structures without validation is a common source of Stored XSS, even in "safe" environments like React (as hrefs are often unmonitored).
**Prevention:** Implement strict schema validation and protocol whitelisting (http/https) at the ingress point (import functions) before data enters the application state.

## 2025-02-14 - [Critical] Hardcoded Steganography Key
**Vulnerability:** The steganographic backup feature used a hardcoded key `'linkhaven_stego_key'` for AES-GCM encryption, making the "hidden" backup accessible to anyone inspecting the source code.
**Learning:** Privacy features like steganography become mere "security theater" if the underlying encryption relies on static, public keys.
**Prevention:** Ensure all encryption keys for sensitive user data are derived dynamically from user-provided secrets (passwords/PINs), never from static constants.
