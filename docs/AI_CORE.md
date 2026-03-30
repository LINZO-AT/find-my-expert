# AI Core Integration — Optional Phase 3

> **Status:** Not implemented. The current `searchExperts` action uses keyword-based matching (`isMockMode: true`).  
> This document describes how to replace it with semantic search via SAP AI Core.  
> **Prerequisite:** BTP deployment (see [BTP_DEPLOYMENT.md](./BTP_DEPLOYMENT.md)) must be completed first.

---

## Overview

The current Smart Search uses field-weighted keyword matching with word-boundary rules. This works well for exact product names ("Signavio", "RISE") but has limitations for natural language queries like:

> "Jemand der bei einer Finance Migration helfen kann"  
> "Wer kennt sich mit Prozessoptimierung aus?"

AI Core replaces the keyword matching in `searchExperts()` with **semantic vector similarity** — understanding intent rather than matching words.

---

## Architecture

```
User Query (natural language)
     │
     ▼
SAP AI Core — Embedding Model (text-embedding-3-small or SAP own)
→ Query Vector: [0.23, -0.41, 0.87, ...]
     │
     ▼
Cosine Similarity against pre-computed Solution/Topic embeddings
→ "Cloud ERP: Finance"     score: 0.91  ✅
→ "S/4HANA Finance"        score: 0.88  ✅
→ "Signavio"               score: 0.12  ❌
     │
     ▼
Top-N matching Solutions → Expert lookup → searchExperts response
```

---

## What Changes in the Code

Only `searchExperts()` in `srv/catalog-service.js` is affected.  
The OData model, Admin UI, and Fiori Search (`$search`) are **untouched**.

### Current (keyword):
```js
const searchScore = computeSearchScore(row, searchTerms, searchPhrase);
// ...
isMockMode: true
```

### With AI Core:
```js
const { AICoreLLMClient } = require('@sap-ai-sdk/ai-core');

const client = new AICoreLLMClient({ deploymentId: process.env.AICORE_DEPLOYMENT_ID });

// 1. Embed the user query
const queryVector = await client.embed(query);

// 2. Compare against pre-computed solution embeddings (cached at startup)
const scoredSolutions = SOLUTION_EMBEDDINGS.map(({ solutionId, vector }) => ({
  solutionId,
  score: cosineSimilarity(queryVector, vector),
})).filter(s => s.score > 0.75).sort((a, b) => b.score - a.score);

// 3. Fetch experts for top matching solutions
// ...existing expert aggregation logic...

isMockMode: false
```

---

## BTP Prerequisites

| What | Service / Plan |
|---|---|
| AI Core instance | `aicore` / `extended` |
| Embedding model deployment | `text-embedding-3-small` (Azure OpenAI) or SAP AI model |
| BTP Destination | `AICORE_DESTINATION` (OAuth2ClientCredentials) |
| npm package | `@sap-ai-sdk/ai-core` |

---

## Embedding Cache

Solution embeddings should be pre-computed and cached at server startup — not on every request:

```js
let SOLUTION_EMBEDDINGS = []; // { solutionId, name, vector }

cds.on('served', async () => {
  const solutions = await cds.db.run(SELECT.from('findmyexpert.Solutions').columns('ID', 'name'));
  SOLUTION_EMBEDDINGS = await Promise.all(
    solutions.map(async s => ({
      solutionId: s.ID,
      name: s.name,
      vector: await client.embed(s.name),
    }))
  );
  LOG.info(`AI Core: ${SOLUTION_EMBEDDINGS.length} solution embeddings cached`);
});
```

When a new solution is created via Admin UI, the cache needs a refresh — either via server restart or a dedicated admin action (`refreshEmbeddings()`).

---

## Cosine Similarity Helper

```js
const cosineSimilarity = (a, b) => {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
};
```

---

## Environment Variables

Add to `.env` (dev) and BTP environment (prod):

```
AICORE_DEPLOYMENT_ID=d1234abcd   # From AI Core Deployments UI
AICORE_RESOURCE_GROUP=default
```

---

## Fallback Strategy

Keep the keyword-based `computeSearchScore()` as fallback:

```js
try {
  // AI Core path
  results = await semanticSearch(query);
} catch (err) {
  LOG.warn('AI Core unavailable, falling back to keyword search', err.message);
  results = keywordSearch(allRows, searchTerms, searchPhrase);
}
```

This ensures the app stays functional if AI Core is not yet deployed or temporarily unavailable.

---

## Impact on Joule Skill

When AI Core is active, `isMockMode` returns `false` and the `reasoning` field will contain the similarity score instead of keyword match details. The Joule Skill response template in [joule-skill/README.md](./joule-skill/README.md) does not need to change — Joule's Foundation Model handles the response formulation regardless.
