---
name: OpenAI SDK testing
description: Test OpenAI-backed code without depending on provider credentials, balance, or network.
---

OpenAI SDK fetch configuration may be captured during SDK or client initialization, so replacing `globalThis.fetch` after import may not intercept requests.

**Why:** Tests need deterministic provider responses without using real credentials or making network calls.

**How to apply:** Inject a fake OpenAI client into service tests rather than stubbing global fetch after importing the SDK.