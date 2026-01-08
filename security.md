# LinkHaven - Security Features

> **Purpose**: Document all security features implemented for audit and developer reference.

---

## 1. PIN Authentication

### Implementation
- **Location**: `components/LockScreen.tsx`
- **Storage**: PIN hash stored in localStorage
- **Algorithm**: SHA-256 hashing

### Flow
1. First use → Set PIN (4 digits min)
2. Return visits → Enter PIN to unlock
3. Lock button in header → Re-lock session

---

## 2. Data Encryption at Rest

### Implementation
- All bookmark and note data stored in localStorage
- Data is protected by PIN-gated access
- No plaintext credentials stored

---

## 3. Secure Note Sharing (AES-256-GCM)

### Encryption Specification
| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key Derivation | PBKDF2 |
| PBKDF2 Iterations | 600,000 (OWASP 2025) |
| Hash Function | SHA-256 |
| Salt Length | 16 bytes (random) |
| IV Length | 12 bytes (random) |
| Key Length | 256 bits |

### Implementation Files
- `components/SecureNoteShare.tsx` - Encryption
- `components/UnlockNote.tsx` - Decryption

### Code Flow
```typescript
// Encryption
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const keyMaterial = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
);

const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
const result = btoa(String.fromCharCode(...[...salt, ...iv, ...new Uint8Array(encrypted)]));
```

### Security Properties
- **Forward Secrecy**: Each share generates unique salt + IV
- **Password Protection**: Recipient needs password (shared separately)
- **Tamper Detection**: GCM authentication tag
- **No Server Storage**: Encryption happens entirely client-side

---

## 4. Keyboard Shortcut Protection

### Problem
Global keyboard shortcuts (e.g., `/` for search) were triggering while typing in input fields.

### Solution
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
    if (isTyping) return; // Don't trigger shortcuts while typing
    // ... handle shortcuts
};
```

---

## 5. Input Sanitization

### Tag Input
- Special characters stripped: `/[^a-z0-9-_]/g`
- Prevents injection attacks
- Location: `components/TagInput.tsx`

### URL Validation
- URLs validated before storage
- Protocol enforcement (http/https)

---

## 6. Cross-Site Scripting (XSS) Prevention

- React's built-in JSX escaping
- No `dangerouslySetInnerHTML` usage
- User content rendered as text nodes

---

## 7. Client-Side Only Architecture

### Benefits
- No server = No server vulnerabilities
- No network attacks possible on stored data
- User data never leaves their device (except explicit sync)

### Trade-offs
- Single device storage (mitigated by sync codes)
- localStorage size limits (~5-10MB)

---

## 8. Sync Code Security

### QR Sync (v2)
- **Version Flag**: Identifies data format
- **Compression**: Reduces code size
- **Encoding**: Base64 for transport

### Future Enhancements
- [ ] AES-256-GCM encryption for sync codes
- [ ] Password protection for full sync
- [ ] Code expiration timestamps

---

## Security Audit Checklist

| Area | Status | Notes |
|------|--------|-------|
| PIN Storage | ✅ | SHA-256 hashed |
| Note Encryption | ✅ | AES-256-GCM |
| Input Sanitization | ✅ | Tags sanitized |
| XSS Prevention | ✅ | React escaping |
| CSRF | N/A | No server |
| SQL Injection | N/A | No database |
| Session Management | ✅ | PIN-locked |

---

## Reporting Security Issues

Contact: [Repository Issues](https://github.com/myProjectsRavi/linkhaven/issues)
