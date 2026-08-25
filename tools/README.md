# Developer Tools

## Test Generator (local sub-agents)

These scripts use the `claude` CLI to generate test skeletons from source files. Run them locally on demand.

**Prerequisite:** Claude Code CLI installed and authenticated.
```bash
claude --version   # verify
```

### Java — JUnit 5 + Mockito

```bash
chmod +x tools/generate-tests.sh

./tools/generate-tests.sh \
  ai-cookbook-java-backend/src/main/java/in/ai/chatbot/service/RagService.java
# → writes RagServiceTest.java alongside the source
```

The generated test class uses:
- `@ExtendWith(MockitoExtension.class)`
- `@Mock` / `@InjectMocks` for dependency injection
- Descriptive method names: `should_<result>_when_<condition>`

### React — Jest + React Testing Library

```bash
chmod +x tools/generate-react-tests.sh

./tools/generate-react-tests.sh ai-cookbook-frontend/src/components/RAGChatbot.js
# → writes RAGChatbot.test.js in the same directory
```

The generated test file covers renders, user interactions, loading states, and mocked axios calls.

---

## PR Code Reviewer (GitHub Actions sub-agent)

Defined in `.github/workflows/pr-reviewer.yml`. Fires automatically on every PR open or update.

**What it does:**
1. Computes the diff between the PR branch and `main`
2. Sends the diff to Claude Haiku via the Anthropic API
3. Posts a structured markdown review as a PR comment

**Setup required (one-time):**
1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add a repository secret: `ANTHROPIC_API_KEY` = your Anthropic API key

**Review format:**
```
## Summary
## Issues Found   (🔴 Critical / 🟠 Major / 🟡 Minor)
## Suggestions
## Verdict        (✅ Approve / ⚠️ Needs Changes)
```

---

## Product / Bill Data Generators

| Script | Purpose |
|---|---|
| `generate_products.py` | Generates `sample_products.xlsx` (100 products) for the Product Search feature |
| `generate_bills.py` | Generates sample bill data |

```bash
pip install -r tools/requirements.txt
python3 tools/generate_products.py
```
