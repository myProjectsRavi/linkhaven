# LinkHaven Pro Billing Setup Guide

> **Architecture**: Zero-database billing using cryptographically signed license keys

---

## Overview

```
User → LemonSqueezy Payment → Webhook → Vercel Edge Function → Sign License → Email to User
                                                                      ↓
                              LinkHaven ← Paste License Key ← User receives email
```

**Why this works:**
- Ed25519 signatures are unforgeable without private key
- Verification is 100% offline (no API calls)
- No database needed to track subscriptions
- Accept ~1-2% refund abuse risk (cheaper than building sync)

---

## Step 1: Create LemonSqueezy Account

1. Go to [LemonSqueezy.com](https://www.lemonsqueezy.com)
2. Click **"Get Started"** (free account)
3. Complete merchant onboarding:
   - Business name: LinkHaven
   - Country: India (or your location)
   - Payout method: Bank transfer / PayPal
4. **Important**: LemonSqueezy is a [Merchant of Record](https://www.lemonsqueezy.com/help/article/what-is-a-merchant-of-record) - they handle all VAT/GST for EU customers automatically

---

## Step 2: Create Your Product

1. Go to **Store → Products → Add Product**
2. Fill in:
   | Field | Value |
   |-------|-------|
   | Name | LinkHaven Pro |
   | Description | Privacy-first bookmark manager with encrypted vault |
   | Pricing | $24/year (or $2/month) |
   | Type | Subscription |
   | Billing Interval | Yearly |
   
3. Under **Checkout → Confirmation**:
   - Enable "Send license key" option
   - Custom license key template: (leave empty - we'll use webhook)

4. Save and **Publish** the product

---

## Step 3: Generate Ed25519 Key Pair

Run these commands locally (requires OpenSSL 3.0+):

```bash
# Generate private key (KEEP SECRET - never commit to git)
openssl genpkey -algorithm Ed25519 -out linkhaven_private.pem

# Extract public key (safe to share/commit)
openssl pkey -in linkhaven_private.pem -pubout -out linkhaven_public.pem

# Convert public key to base64 for embedding in app
openssl pkey -in linkhaven_public.pem -pubin -outform DER | base64
```

**Store securely:**
- Private key → Vercel Environment Variable `LINKHAVEN_PRIVATE_KEY`
- Public key (base64) → Hardcode in `utils/license.ts`

---

## Step 4: Create Vercel Edge Function

Create file: `/api/generate-license.ts`

```typescript
// api/generate-license.ts
import { sign } from '@noble/ed25519';

export const config = {
    runtime: 'edge',
};

// Private key from environment variable
const PRIVATE_KEY = process.env.LINKHAVEN_PRIVATE_KEY!;

interface LemonSqueezyWebhook {
    data: {
        attributes: {
            user_email: string;
            first_order_item: {
                product_name: string;
            };
        };
    };
}

export default async function handler(req: Request) {
    // Verify webhook signature (optional but recommended)
    const signature = req.headers.get('x-signature');
    
    const body: LemonSqueezyWebhook = await req.json();
    const email = body.data.attributes.user_email;
    
    // Create license payload
    const payload = {
        email,
        expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        features: ['pro'],
        issued: new Date().toISOString(),
        tier: 'pro',
    };
    
    // Sign payload
    const payloadB64 = btoa(JSON.stringify(payload));
    const payloadBytes = new TextEncoder().encode(payloadB64);
    
    // Ed25519 signing
    const privateKeyBytes = Uint8Array.from(atob(PRIVATE_KEY), c => c.charCodeAt(0));
    const signatureBytes = await sign(payloadBytes, privateKeyBytes);
    const signatureB64 = btoa(String.fromCharCode(...signatureBytes));
    
    const licenseKey = `${payloadB64}.${signatureB64}`;
    
    // Return license (LemonSqueezy will email it)
    return new Response(JSON.stringify({
        license_key: licenseKey,
        license_key_instance: {
            id: crypto.randomUUID(),
        },
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
```

---

## Step 5: Configure LemonSqueezy Webhook

1. Go to **Settings → Webhooks → Add Webhook**
2. Configure:
   | Field | Value |
   |-------|-------|
   | URL | `https://linkhaven-beige.vercel.app/api/generate-license` |
   | Events | `order_created` |
   | Signing Secret | Generate and save |

3. Save webhook

---

## Step 6: Update LinkHaven Code

Replace the placeholder in `utils/license.ts`:

```typescript
// Line 30: Replace with your actual public key
const PUBLIC_KEY_BASE64 = 'YOUR_BASE64_PUBLIC_KEY_HERE';
```

---

## Step 7: Add Pro Features UI

Create a settings section for license activation:

```tsx
// In Settings modal
<div>
    <input 
        type="text" 
        placeholder="Paste license key here"
        value={licenseKey}
        onChange={e => setLicenseKey(e.target.value)}
    />
    <button onClick={async () => {
        const status = await activateLicense(licenseKey);
        if (status.valid) {
            showToast('Pro activated!', 'success');
        } else {
            showToast(status.error || 'Invalid license', 'error');
        }
    }}>
        Activate Pro
    </button>
</div>
```

---

## Step 8: Feature Gating

```typescript
import { isPro } from './utils/license';

// In component
const hasPro = await isPro();

if (!hasPro) {
    return <ProUpgradePrompt />;
}

// Pro-only features:
// - Steganographic backup
// - Duress PIN (Panic Mode)
// - Unlimited vault items
// - Priority support
```

---

## Testing

### Development Mode
The license validation currently skips signature verification when the public key is the placeholder. This allows testing without real keys.

### Test License (Development Only)
```javascript
// Create a test payload
const testPayload = btoa(JSON.stringify({
    email: "test@example.com",
    expires: "2030-01-01",
    features: ["pro"],
    issued: new Date().toISOString(),
    tier: "pro"
}));

// Use as license key (without signature)
const testLicense = `${testPayload}.fake-signature`;
```

### Production Testing
1. Create a free/discounted test product in LemonSqueezy
2. Complete a real purchase
3. Verify license email arrives with valid key
4. Activate in LinkHaven and verify Pro features unlock

---

## Handling Refunds

**Accept the risk.** Here's why:

| Approach | Cost | Complexity |
|----------|------|------------|
| Build refund-check server | ~$20/month minimum | High |
| Check on every unlock | Requires internet | Medium |
| **Accept 1-2% abuse** | $0 | Zero |

At $24/year with 1% abuse rate, you'd need 1,000+ users before losing $240/year to fraud. By then, you can afford a server.

---

## Support & Recovery

### Lost License Key
- User contacts you with purchase email
- You verify in LemonSqueezy dashboard
- Manually resend from LemonSqueezy order page

### Expired License
- License validation returns `error: 'License expired'`
- Show renewal prompt with LemonSqueezy checkout link

### Multiple Devices
- License keys are unlimited devices (no tracking)
- This is a feature, not a bug (increases user satisfaction)

---

## Pricing Strategy

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Basic bookmarks, notes, sync codes |
| Pro | $24/year ($2/mo) | Steganography, Duress PIN, Vault, Unlimited |

**Why $24/year:**
- Undercuts Raindrop.io ($28/year)
- Undercuts Pinboard ($22/year setup + ongoing)
- Psychological: "Less than $2/month"
- EU users: VAT included (LemonSqueezy handles)

---

## Checklist

- [ ] Create LemonSqueezy account
- [ ] Complete merchant verification
- [ ] Create "LinkHaven Pro" product
- [ ] Generate Ed25519 key pair
- [ ] Add private key to Vercel environment
- [ ] Deploy edge function
- [ ] Configure webhook
- [ ] Update public key in code
- [ ] Test end-to-end
- [ ] Add Pro features UI
