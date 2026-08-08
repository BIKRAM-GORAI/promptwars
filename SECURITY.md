# Security Policy (SECURITY.md)

ResolveAI is designed with production-ready security standards to defend customer data, prevent payment fraud (carding), and block AI exploitation.

## Enforced Security Controls

### 1. HTTP Security Headers (Helmet)
Express handles headers using the `helmet` middleware. The following controls are explicitly configured:
- **Content Security Policy (CSP)**: Locked down to only load scripts, styles, frames, and connections from trusted domains:
  - **Styles & Fonts**: Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`).
  - **Auth**: Firebase Google domains (`*.googleapis.com`, `*.firebaseapp.com`, `*.firebaseio.com`, `identitytoolkit.googleapis.com`, `www.gstatic.com`).
  - **Payment**: Razorpay integrations (`api.razorpay.com`, `checkout.razorpay.com`).
  - **Images**: Cloudinary secure servers (`res.cloudinary.com`) and Google user photos (`lh3.googleusercontent.com`).
- **MIME Sniffing Prevention**: Enforces `X-Content-Type-Options: nosniff`.
- **Clickjacking Protection**: Restricts framing to `X-Frame-Options: SAMEORIGIN`.
- **HSTS Enforcement**: Directs modern browsers to only connect via HTTPS.

### 2. Multi-Tier Rate Limiting
To prevent abuse of APIs, artificial intelligence, and transaction gates, rate limiters are mounted using `express-rate-limit`:
- **General APIs (`/api/`)**: Evaluates a maximum limit of **200 requests per 15 minutes** from a single IP.
- **Fintech Gateways (`/api/payments/`)**: Prevents automated carding/checkout attacks with a limit of **15 requests per 15 minutes** per IP.
- **AI Audit System (`/api/disputes/`)**: Prevents spamming Gemini generative model endpoints (DoS vectors) with a limit of **10 dispute filings per hour** per IP.

### 3. Authentication & Authorization
- **Customer Identity**: Verified at the backend routing level using Firebase Admin SDK verification. Decoded Firebase user details populate user permissions inside MongoDB.
- **Admin Isolation**: Admin routes are protected by a cryptographically checked Mock Token (`resolveai-admin-session-token`), isolating customer records from privilege escalation vectors.
- **Double Refund Prevention**: The API validates database records to prevent duplicate dispute submissions on the same order line-item if a refund is already pending, processing, or resolved.

### 4. Multimodal Verification (Fraud Check)
To prevent customers from submitting images of mismatching damaged items (e.g. keyboard image for mouse refund), the backend prompts Google Gemini to visually cross-reference the picture content with the exact expected item metadata populated from DB order logs.

---

## Reporting a Vulnerability

If you discover a security issue or vulnerability within this application, please follow the guidelines below:

1. **Responsible Disclosure**: Do not disclose vulnerability details publicly (such as via Git issues or open channels) until the issue has been patched.
2. **Contact Email**: Submit vulnerability details via email to `security@resolveai.com`.
3. **Information to Include**:
   - Step-by-step instructions to reproduce the issue.
   - Proof of Concept (PoC) scripts or screenshots.
   - Expected impact on customer data or system availability.
