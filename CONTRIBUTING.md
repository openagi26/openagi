# Contributing to OpenAGI

Thank you for your interest in contributing. This guide covers everything you need to go from zero to a merged pull request.

---

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+ and pnpm (`npm i -g pnpm`)
- [Ollama](https://ollama.ai) (optional, for local model testing)

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/openagi.git
cd openagi
```

### 2. Backend

```bash
cp .env.example .env        # fill in at least one API key, or use Ollama
pip install -e ".[dev]"     # installs fastapi, pytest, ruff, etc.
make dev                    # starts backend on :8888
```

### 3. Frontend (separate terminal)

```bash
cd web
pnpm install
cd ..
make web                    # starts Next.js on :3000
```

> **Do not** run `pnpm dev` or `next dev` directly — use `make web` which sets safe memory limits.

---

## Running Tests

```bash
# Backend (pytest)
make test

# Or directly
pytest tests/ -v

# Frontend type check
cd web && pnpm tsc --noEmit
```

---

## Coding Standards

These are derived from the project's P0 principles:

### Simplicity first
- Write the minimum code that solves the problem
- Do not add features that were not requested
- If your change is 200 lines but could be 50, rewrite it

### Surgical edits
- Only touch what you must — do not "improve" unrelated code
- Match the existing code style, even if you'd write it differently
- Remove imports/variables made unused by your change; leave pre-existing dead code alone

### Goal-driven execution
- Convert each task into a verifiable goal before coding:
  - "Fix bug X" → write a test that reproduces X, then make it pass
  - "Add feature Y" → write a test for Y, then implement

---

## Pull Request Process

1. **Branch naming**: `feat/short-description`, `fix/short-description`, `chore/short-description`

2. **One concern per PR** — keep PRs focused and reviewable

3. **Business assertion evidence** — for any PR that touches user-facing behavior, include at least one of:
   - Network tab screenshot showing the real API call + non-empty response
   - DOM screenshot showing actual LLM-generated text (not placeholder/mock)
   - Test output proving the acceptance criterion is met end-to-end

4. **Checklist before opening PR**:
   - [ ] `make test` passes locally
   - [ ] `cd web && pnpm tsc --noEmit` passes
   - [ ] No `.env` or secret files staged
   - [ ] Evidence screenshot/log attached if behavior changed

5. **PR description template**:
   ```
   ## What
   One sentence describing the change.

   ## Why
   Why this change is needed.

   ## Evidence
   Screenshot or test output showing the feature works end-to-end.
   ```

---

## Project Structure Reference

```
openagi/          Backend (FastAPI)
  api/            HTTP routes
  cortex/         Governance & LLM adapters
  memory/         ChromaDB persistent memory
  tools/          MCP tools & browser automation
web/              Frontend (Next.js 16 + TypeScript)
tests/            pytest test suite
docs/             Documentation
Makefile          All dev commands
```

---

## Getting Help

- Open a GitHub Issue for bugs or feature requests
- For questions about architecture, read `docs/` first

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

*OpenAGI is MIT licensed. By contributing, you agree your contributions are licensed under the same terms.*
