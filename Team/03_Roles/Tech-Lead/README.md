# Technical Lead (Member 1)

**Mandate:** architecture, agent orchestration, backend integration, deployment.

**Owns:** how the buying agent is built and shipped; production health; AI cost and latency.

**Start here (in the repo)**
- `CLAUDE.md` is the accurate current doc. `PRODUCT_OVERVIEW.md` is stale (Jan 2026)
- `app/api/chat/route.ts`: the current fixed 4-model chat pipeline, which the agent replaces
- `lib/providers/`: OpenAI/Anthropic/Gemini/Grok adapters with circuit breakers and cost tracking
- `netlify/functions/`: about 20 scheduled jobs

**Week 1**
1. Tool definitions (input/output schema) for the 5 MVP tools → `02_Projects/buying-agent/specs/tools.md`
2. Agent-loop spike behind a feature flag
3. Board item: in-memory rate limiter and Deal Watch dedupe on serverless
