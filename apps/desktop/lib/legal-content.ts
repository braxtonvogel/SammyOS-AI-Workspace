// lib/legal-content.ts
// Local copies of the Terms of Service and Privacy Policy.
// Rendered directly in the login page modal — no network request required,
// so it works even if braxtonvogel.com is unreachable or DNS fails inside
// the Tauri webview.
//
// Keep this in sync with the hosted versions at:
//   https://braxtonvogel.com/sammyos-terms.html
//   https://braxtonvogel.com/sammyos-privacy.html

export const TERMS_OF_SERVICE = `
Last updated: June 2026

1. ACCEPTANCE OF TERMS
By creating an account or using SammyOS, you agree to these Terms of Service.
If you do not agree, do not use the application.

2. WHAT SAMMY OS IS
SammyOS is a personal portfolio project built by Braxton Vogel. It is a desktop
AI workspace application provided for demonstration and personal productivity
purposes.

3. SERVICE PROVIDED "AS-IS"
SammyOS is provided "as-is" and "as-available," without warranties of any kind,
express or implied, including but not limited to warranties of merchantability,
fitness for a particular purpose, or non-infringement. Braxton Vogel makes no
guarantee that the service will be uninterrupted, secure, or error-free.

4. NO LIABILITY FOR DATA LOSS OR DOWNTIME
Braxton Vogel is not liable for any loss of data, downtime, service
interruption, or damages arising from your use of, or inability to use,
SammyOS. This includes but is not limited to loss of vault files, research
reports, chat history, or account data.

4A. LIMITATION OF LIABILITY
To the maximum extent permitted by law, Braxton Vogel's total liability to
you for any claim arising from or related to SammyOS shall not exceed the
amount you paid to use SammyOS, which, as a free portfolio project, is zero
dollars ($0). In no event shall Braxton Vogel be liable for any indirect,
incidental, special, consequential, or punitive damages.

4B. INDEMNIFICATION
You agree to indemnify and hold Braxton Vogel harmless from any claims,
damages, losses, liabilities, and expenses (including reasonable attorneys'
fees) arising out of or related to: (a) your use of SammyOS; (b) your
violation of these Terms; (c) your violation of any law or the rights of a
third party; or (d) content you submit, upload, or process through the
service.

5. PORTFOLIO PROJECT — SUBJECT TO CHANGE OR SHUTDOWN
SammyOS is a portfolio project, not a commercial product. It may be modified,
restricted, or shut down at any time, without notice, at Braxton Vogel's sole
discretion.

6. YOUR API KEYS ARE YOUR RESPONSIBILITY
If you choose to provide your own API keys (OpenAI, Anthropic, Groq, or a
custom endpoint), you are solely responsible for those keys, any usage charges
incurred, and complying with the terms of the respective provider. Braxton
Vogel is not responsible for costs, misuse, or exposure of user-provided keys.

7. ACCEPTABLE USE
You agree not to use SammyOS to: violate any applicable law; attempt to gain
unauthorized access to the service's infrastructure; upload or process content
you do not have the right to use; or use the service to generate content that
is illegal, harmful, or abusive.

8. ACCOUNT TERMINATION
Braxton Vogel reserves the right to suspend or terminate any account, at any
time, for any reason, including suspected violation of these terms.

9. GOVERNING LAW
These Terms are governed by the laws of the State of Texas, without regard to
its conflict of law provisions.

10. CHANGES TO THESE TERMS
These Terms may be updated from time to time. Continued use of SammyOS after
changes are posted constitutes acceptance of the revised Terms.

11. CONTACT
Questions about these Terms can be directed to Braxton Vogel via
braxtonvogel.com.
`.trim();

export const PRIVACY_POLICY = `
Last updated: June 2026

1. OVERVIEW
This Privacy Policy explains what information SammyOS collects, what it does
not collect, and how it is used.

2. WHAT IS COLLECTED
 • Aggregate usage counts (e.g. number of messages sent, research jobs
   started) — no personal content is included in these counts.
 • Your account email address and a hashed (not plaintext) password.
 • Any API keys you choose to provide (OpenAI, Anthropic, Groq, Gemini,
   Cerebras, Brave, or a custom endpoint), encrypted at rest.

3. WHAT IS NOT COLLECTED
 • Chat message content
 • Vault file contents
 • Research report contents
These never leave your machine and are not transmitted to or stored on any
server.

4. VAULT FILES ARE LOCAL-ONLY
The Knowledge Vault is intentionally local-only. Vault file contents are
never uploaded, synced, or transmitted anywhere. The only vault-related data
that reaches a server is an anonymous usage counter (how many times the
upload feature has been used across all users).

5. HOW API KEYS ARE STORED
If you provide your own API keys, they are encrypted at rest in the backend
database (Upstash Redis) and are only decrypted server-side at request time
to route your AI requests to your chosen provider.

6. NO ADS, NO SELLING DATA
SammyOS does not display ads and does not sell, rent, or share your data with
third parties for marketing purposes.

7. THIRD-PARTY AI PROVIDERS
If you use your own API keys, your requests are sent directly to that
provider (e.g. OpenAI, Anthropic, Groq). Each provider has its own privacy
policy governing how they handle that data — SammyOS has no control over
their practices.

8. DATA RETENTION
Account records (email, hashed password, encrypted keys) are retained until
you request deletion. Aggregate usage counters have no personally
identifiable information attached and are retained indefinitely for
portfolio/demo purposes.

9. YOUR RIGHTS
You may request account deletion at any time, which will remove your stored
email, password hash, and any encrypted API keys from the database.

10. CHANGES TO THIS POLICY
This Privacy Policy may be updated from time to time. Continued use of
SammyOS after changes are posted constitutes acceptance of the revised
policy.

11. CONTACT
Questions about this Privacy Policy can be directed to Braxton Vogel via
braxtonvogel.com.
`.trim();