# GDPR Implementation Guide — Find My Expert

> **For AI Coding Agents (Cline, Claude Code, etc.):**  
> This document describes concrete, actionable changes. Each section is self-contained.  
> Implement in the order listed. Do not skip sections — each builds on the previous.

---

## Overview

The `Experts` entity stores personal data (name, email, country) of SAP employees.  
DSGVO/GDPR Art. 25 (Privacy by Design) requires technical safeguards — especially when AI processes this data.

**Scope of this document:**
1. Pseudonymization for AI/Joule integration (highest priority)
2. Soft-Delete / Offboarding support
3. Audit Logging via `@cap-js/audit-logging`
4. Data Subject Rights endpoints

---

## 1. Pseudonymization for `searchExperts` (AI Path)

### Why

When `searchExperts` is called via Joule or any AI backend (SAP AI Core, Foundation Models),  
the current implementation passes full names and emails into the AI context.  
This violates DSGVO Art. 25. The AI only needs non-personal attributes to rank experts.

### How It Works

```
DB (real data)
  → [pseudonymize in-memory, per-request, ephemeral]
  → AI sees: { id: "EXP-001", solution, topic, role, score, capabilities }
  → AI returns: [{ id: "EXP-001", score: 95, reasoning: "..." }]
  → [de-pseudonymize server-side]
  → Joule / Caller receives: { firstName: "Max", lastName: "Mustermann", ... }
```

The pseudonym map exists **only in memory for the duration of a single request**.  
It is never persisted. This makes the approach fully GDPR-compliant (no persistent pseudonym mapping required).

### Implementation

**File:** `srv/catalog-service.js`

Replace the `searchExperts` handler (the block starting with `this.on('searchExperts', ...)`)  
with the following implementation:

```javascript
// ─── searchExperts: Pseudonymized AI-ready search ──────────────────────────
this.on('searchExperts', async (req) => {
  const query = (req.data.query || '').toLowerCase().trim();
  LOG.info(`searchExperts called — query: "${query}"`);
  if (!query) return [];

  const { ExpertSearch } = this.entities;
  const allRows = await cds.db.run(SELECT.from(ExpertSearch));

  // ── Step 1: Build ephemeral pseudonym map (in-memory, this request only) ──
  // Key: expertID (UUID) → pseudo: "EXP-001"
  // This map is NEVER logged, NEVER persisted.
  const expertIds = [...new Set(allRows.map(r => r.expertID).filter(Boolean))];
  const pseudoMap  = new Map(); // expertID → "EXP-001"
  const reverseMap = new Map(); // "EXP-001" → { expertID, firstName, lastName, email, country_code }

  expertIds.forEach((id, i) => {
    const pseudo = `EXP-${String(i + 1).padStart(3, '0')}`;
    pseudoMap.set(id, pseudo);
    const row = allRows.find(r => r.expertID === id);
    reverseMap.set(pseudo, {
      expertID:    id,
      firstName:   row?.firstName   ?? '',
      lastName:    row?.lastName    ?? '',
      email:       row?.email       ?? '',
      country_code: row?.country_code ?? '',
      countryName: row?.countryName ?? '',
    });
  });

  // ── Step 2: Build pseudonymized expert list for AI ranking ────────────────
  // IMPORTANT: No firstName, lastName, email in this structure.
  const pseudoExperts = [];
  const expertAggMap = new Map(); // expertID → aggregated capabilities

  for (const row of allRows) {
    const pseudo = pseudoMap.get(row.expertID);
    if (!pseudo) continue;

    let entry = expertAggMap.get(row.expertID);
    if (!entry) {
      entry = {
        id:            pseudo,        // pseudonym — AI sees this, NOT the UUID
        solution:      [],
        topic:         new Set(),
        role:          [],
        rolePriority:  row.rolePriority ?? 5,
        canPresent5M:  row.canPresent5M  ?? false,
        canPresent30M: row.canPresent30M ?? false,
        canPresent2H:  row.canPresent2H  ?? false,
        canPresentDemo: row.canPresentDemo ?? false,
      };
      expertAggMap.set(row.expertID, entry);
    } else {
      if ((row.rolePriority ?? 5) > entry.rolePriority) entry.rolePriority = row.rolePriority ?? 5;
      entry.canPresent5M   = entry.canPresent5M   || (row.canPresent5M   ?? false);
      entry.canPresent30M  = entry.canPresent30M  || (row.canPresent30M  ?? false);
      entry.canPresent2H   = entry.canPresent2H   || (row.canPresent2H   ?? false);
      entry.canPresentDemo = entry.canPresentDemo || (row.canPresentDemo ?? false);
    }
    if (row.solutionName) entry.solution.push(row.solutionName);
    if (row.topicName)    entry.topic.add(row.topicName);
    if (row.roleName)     entry.role.push(row.roleName);
  }

  for (const entry of expertAggMap.values()) {
    entry.topic    = [...entry.topic];
    entry.solution = [...new Set(entry.solution)];
    entry.role     = [...new Set(entry.role)];
    pseudoExperts.push(entry);
  }

  // ── Step 3: AI ranking (currently keyword-based; swap callAI() for AI Core) ─
  // The rankExperts function only operates on pseudonymized data.
  const tokens = query.split(/\s+/).filter(t => t.length > 1);

  const ranked = pseudoExperts
    .map(e => {
      const searchText = [
        ...e.solution, ...e.topic, ...e.role
      ].join(' ').toLowerCase();

      let matchCount = 0;
      const matchedTokens = [];
      for (const token of tokens) {
        if (searchText.includes(token)) { matchCount++; matchedTokens.push(token); }
      }
      if (matchCount === 0) return null;

      const score = e.rolePriority + matchCount * 5
        + (e.canPresent2H    ? 3 : 0)
        + (e.canPresentDemo  ? 2 : 0)
        + (e.canPresent30M   ? 1 : 0)
        + (e.canPresent5M    ? 1 : 0);

      return {
        id:            e.id,    // still pseudonym at this point
        score,
        matchedTokens,
        canPresent5M:   e.canPresent5M,
        canPresent30M:  e.canPresent30M,
        canPresent2H:   e.canPresent2H,
        canPresentDemo: e.canPresentDemo,
        solutionName:   e.solution.sort().join(', '),
        topicName:      e.topic.sort().join(', '),
        roleName:       e.role.sort().join(', '),
        // Reasoning text uses pseudonym — personal data never enters AI text
        reasoning: `Keyword match: ${matchedTokens.join(', ')}. Role score: ${score}.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  // ── Step 4: De-pseudonymize — enrich with real personal data server-side ──
  // This happens AFTER AI ranking. Real names/emails are injected here, not before.
  return ranked.map(r => {
    const real = reverseMap.get(r.id); // lookup by pseudonym
    return {
      expertID:      real?.expertID    ?? '',
      firstName:     real?.firstName   ?? '',
      lastName:      real?.lastName    ?? '',
      email:         real?.email       ?? '',
      country_code:  real?.country_code ?? '',
      countryName:   real?.countryName  ?? '',
      solutionName:  r.solutionName,
      topicName:     r.topicName,
      roleName:      r.roleName,
      score:         r.score,
      reasoning:     r.reasoning,       // no real name in AI-generated text
      canPresent5M:  r.canPresent5M,
      canPresent30M: r.canPresent30M,
      canPresent2H:  r.canPresent2H,
      canPresentDemo: r.canPresentDemo,
      isMockMode:    true,
    };
  });
});
```

### Notes for AI Core Integration (Phase 2)

When replacing the keyword ranking with a real LLM call (SAP AI Core / Foundation Models),  
pass only `pseudoExperts` to the model. The response will contain pseudonym IDs which are  
de-pseudonymized in Step 4 — the logic stays identical.

```javascript
// Example: swap Step 3 with real AI Core call
const aiResponse = await callAICore(query, pseudoExperts);
// aiResponse: [{ id: "EXP-001", score: 95, reasoning: "EXP-001 is a strong match because..." }]
// Step 4 de-pseudonymizes the same way.
```

---

## 2. Soft-Delete / Offboarding

### Why

When an employee leaves SAP, their record must be removable (DSGVO Art. 17 — Right to Erasure).  
Hard delete via Admin UI works but loses auditability.  
A `deletedAt` flag allows hiding data without losing history.

### Schema Changes

**File:** `db/schema.cds`

Add to the `Experts` entity:

```cds
entity Experts : cuid, managed {
  // ... existing fields ...

  @title: 'Active'
  @PersonalData.IsPotentiallyPersonal: false
  isActive    : Boolean default true;

  @title: 'Deactivated At'
  deletedAt   : Timestamp;
}
```

### Service Changes

**File:** `srv/catalog-service.cds`

Add a `deactivateExpert` action:

```cds
action deactivateExpert(expertID: UUID not null) returns { success: Boolean; message: String; };
```

**File:** `srv/catalog-service.js`

Add handler — filter out inactive experts and implement deactivation:

```javascript
// Filter inactive experts from ExpertSearch
this.before('READ', 'ExpertSearch', (req) => {
  const w = req.query.SELECT;
  const inactiveFilter = { ref: ['isActive'] };
  // Add isActive = true filter if not already present
  if (!w.where) w.where = [{ ref: ['expert', 'isActive'] }, '=', { val: true }];
});

// Deactivate action
this.on('deactivateExpert', async (req) => {
  const { expertID } = req.data;
  const result = await UPDATE('findmyexpert.Experts')
    .set({ isActive: false, deletedAt: new Date().toISOString() })
    .where({ ID: expertID });
  if (result === 0) return { success: false, message: `Expert ${expertID} not found.` };
  LOG.info(`Expert ${expertID} deactivated (soft-delete)`);
  return { success: true, message: `Expert deactivated.` };
});
```

---

## 3. Audit Logging

### Why

DSGVO Art. 30 requires a Record of Processing Activities.  
CAP has built-in support via `@cap-js/audit-logging`.

### Setup

```bash
npm add @cap-js/audit-logging
```

**File:** `package.json` — verify the dependency is added.

**File:** `.cdsrc.json` — enable audit logging:

```json
{
  "requires": {
    "audit-log": {
      "kind": "audit-log-to-console"
    }
  }
}
```

> For BTP: use `kind: "audit-log"` + bind the `auditlog` service in `mta.yaml`.

### Schema Changes

The `@PersonalData` annotations already exist in `db/schema.cds`.  
CAP's audit plugin reads these automatically — **no additional code required** for basic logging.

Verify these annotations are present on `Experts` (they are as of current schema):
```cds
@PersonalData.EntitySemantics: 'DataSubject'    // on entity
@PersonalData.FieldSemantics: 'GivenName'       // firstName
@PersonalData.FieldSemantics: 'FamilyName'      // lastName
@PersonalData.FieldSemantics: 'EMail'           // email
@PersonalData.IsPotentiallyPersonal             // country
```

CAP will automatically log READ/WRITE/DELETE access to these annotated fields.

---

## 4. Data Subject Rights

### Why

DSGVO Art. 15 (Right of Access) and Art. 17 (Right to Erasure) require that data subjects  
can request their data and request deletion.

### Implementation

**File:** `srv/catalog-service.cds`

Add these actions (require `Admin` role):

```cds
@(requires: 'Admin')
action exportExpertData(expertID: UUID not null) returns LargeString;

@(requires: 'Admin')
action anonymizeExpert(expertID: UUID not null) returns { success: Boolean; message: String; };
```

**File:** `srv/catalog-service.js`

```javascript
// Art. 15 — Export all data for a data subject
this.on('exportExpertData', async (req) => {
  const { expertID } = req.data;
  const expert = await SELECT.one.from('findmyexpert.Experts')
    .where({ ID: expertID });
  if (!expert) req.error(404, `Expert ${expertID} not found`);

  const roles = await SELECT.from('findmyexpert.ExpertRoles').where({ expert_ID: expertID });
  const langs = await SELECT.from('findmyexpert.ExpertLanguages').where({ expert_ID: expertID });

  const export_ = {
    exportedAt: new Date().toISOString(),
    expert,
    roles,
    languages: langs,
  };

  LOG.info(`Data export for expert ${expertID} (Art. 15 DSGVO)`);
  return JSON.stringify(export_, null, 2);
});

// Art. 17 — Anonymize (irreversible, replaces personal data with placeholders)
this.on('anonymizeExpert', async (req) => {
  const { expertID } = req.data;
  const anon = {
    firstName:  'ANONYMIZED',
    lastName:   'ANONYMIZED',
    email:      `anonymized-${expertID.substring(0, 8)}@deleted.invalid`,
    country_ID: null,
    isActive:   false,
    deletedAt:  new Date().toISOString(),
  };
  const result = await UPDATE('findmyexpert.Experts').set(anon).where({ ID: expertID });
  if (result === 0) return { success: false, message: `Expert ${expertID} not found.` };
  LOG.info(`Expert ${expertID} anonymized (Art. 17 DSGVO)`);
  return { success: true, message: `Expert data anonymized.` };
});
```

---

## Implementation Order

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1 | **Pseudonymized `searchExperts`** | `srv/catalog-service.js` | ~60 min |
| 2 | **Soft-Delete schema + handler** | `db/schema.cds`, `srv/catalog-service.cds`, `srv/catalog-service.js` | ~30 min |
| 3 | **Audit Logging setup** | `package.json`, `.cdsrc.json` | ~15 min |
| 4 | **Data Subject Rights actions** | `srv/catalog-service.cds`, `srv/catalog-service.js` | ~30 min |

---

## Testing

### Pseudonymization

```bash
# Call searchExperts — verify response contains real names
curl -X POST http://localhost:4004/api/catalog/searchExperts \
  -H "Content-Type: application/json" \
  -d '{"query": "Signavio"}'
# Expected: firstName/lastName are real names in response

# Verify AI never saw real names: add temporary LOG.info(JSON.stringify(pseudoExperts))
# in the handler before the ranking step and check server logs.
# pseudoExperts should contain ONLY "EXP-001"-style IDs, solutions, topics, roles.
```

### Soft-Delete

```bash
# Deactivate an expert
curl -X POST http://localhost:4004/api/catalog/deactivateExpert \
  -H "Content-Type: application/json" \
  -d '{"expertID": "<uuid>"}'

# Verify expert no longer appears in ExpertSearch
curl http://localhost:4004/api/catalog/ExpertSearch
```

### Data Export

```bash
curl -X POST http://localhost:4004/api/catalog/exportExpertData \
  -H "Content-Type: application/json" \
  -d '{"expertID": "<uuid>"}'
# Expected: JSON with expert, roles, languages
```

---

## Notes

- All pseudonym maps are **ephemeral** — they exist only for the duration of a single `searchExperts` call and are never logged or persisted.
- The `isMockMode: true` flag in the `searchExperts` response should be removed once real AI Core integration is active.
- For BTP production: replace `audit-log-to-console` with the bound `auditlog` CF service in `mta.yaml`.
- The `deactivateExpert` and `anonymizeExpert` actions should be accessible from the Admin UI — consider adding them as OData bound actions on `AdminExperts`.
