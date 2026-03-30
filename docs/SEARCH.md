# Smart Search — Architecture & Implementation

## Overview

ExpertSearch uses a custom **Smart Search system** in `srv/catalog-service.js` that replaces CAP's default search (`@cds.search` → `LIKE '%term%'`). It was built to solve typical substring-search problems:

| Problem | Example | Solution |
|---------|---------|----------|
| Acronym false positives | `AI` matches "Toolch**ai**n" | Word-boundary matching for acronyms |
| Short-term false positives | `RISE` matches "Enterp**rise**" | Acronym detection + word boundary |
| CamelCase not resolved | `Cloud ERP` doesn't find "CloudERP" | CamelCase normalization |
| No relevance sorting | Random ordering of results | Field-weighted scoring |
| Case-insensitive acronym mismatch | `rise` matches "Enterprise" | Known-terms list (see below) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Fiori Elements List Report (findmyexpert-search)                   │
│  FilterBar → $search=<term> via OData V4                            │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ GET /api/catalog/ExpertSearch?$search=...
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CAP Runtime (CatalogService)                                        │
│                                                                      │
│  1. Intercept $search → extractSearchString()                        │
│  2. DELETE req.query.SELECT.search  (prevents CAP LIKE '%..%')       │
│  3. Load ALL rows from ExpertSearch (DB view)                        │
│  4. Smart Matching in JS: computeSearchScore() per row               │
│  5. Deduplication per expert (aggregate solutions/topics/roles)      │
│  6. Sort: searchScore → roleScore → lastName                         │
│  7. Paginate ($top / $skip)                                          │
│  8. Return OData response with $count                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Why not standard `@cds.search`?

CAP's `@cds.search` annotation generates `WHERE ... LIKE '%term%'` SQL conditions. Fine for simple cases, but has critical limitations:

1. **No word-boundary awareness**: "AI" matches anything containing the letters "ai"
2. **No relevance sorting**: all hits are equal — no field weighting
3. **No phrase detection**: "Cloud ERP" becomes two independent `LIKE` conditions
4. **No CamelCase resolution**: "CloudERP" is not found when searching "Cloud ERP"

The Smart Search intercepts the `$search` parameter **before** CAP processes it, removes it from the query, and runs all matching logic in JavaScript.

---

## ExpertSearch — Data Foundation

`ExpertSearch` is a **flat, denormalized view** across multiple entities:

```
ExpertRoles  →  Experts    (expert.*)
             →  Solutions  (solution.name)
             →  Topics     (solution.topic.name)
             →  Roles      (role.name, role.priority)
```

**One expert has multiple ExpertRoles** → one DB row per expert-solution-role combination. The Smart Search deduplicates these into one row per expert, aggregating solutions, topics, and roles as comma-separated strings.

### CDS Definition (`srv/catalog-service.cds`)

```cds
@readonly
@cds.search: { firstName, lastName, email, solutionName, topicName, roleName }
entity ExpertSearch as SELECT from findmyexpert.ExpertRoles {
    key expert.ID              as ID : UUID,
    expert.ID                  as expertID,
    expert.firstName           as firstName,
    expert.lastName            as lastName,
    (expert.lastName || ' ' || expert.firstName) as fullName : String(200),
    expert.email               as email,
    expert.country.code        as country_code,
    expert.country.name        as countryName,
    solution.name              as solutionName,
    solution.topic.name        as topicName,
    role.name                  as roleName,
    role.priority              as rolePriority,
    canPresent5M,
    canPresent30M,
    canPresent2H,
    canPresentDemo,
    notes,
    virtual relevanceScore : Integer,
    expertRoles : Association to many ExpertRoles on expertRoles.expert.ID = expertID
};
```

> **Note:** The `@cds.search` annotation is still present but overridden by the service handler — the `$search` parameter is removed before the DB query runs.

---

## Matching Algorithm

### Term Classification

Each search term is classified before matching:

| Type | Detection | Matching strategy | Examples |
|------|-----------|-------------------|---------|
| **Known SAP term** | In `SAP_KNOWN_TERMS` set (case-insensitive) | Strict word boundary (`\b`) | `rise`, `Rise`, `RISE`, `btp`, `ai` |
| **Structural acronym** | `/^[A-Z0-9]+$/` with min. 1 letter | Strict word boundary (`\b`) | `HCM`, `S4`, `BW4` |
| **Short (≤2 chars)** | Non-acronym, length ≤ 2 | Word boundary (`\b`) | `fi`, `pp` |
| **Medium (3 chars)** | Non-acronym, length = 3 | Word boundary + CamelCase substring | `erp`, `sap` |
| **Long (≥4 chars)** | Non-acronym, length ≥ 4 | Substring (safe for long terms) | `Cloud`, `Signavio`, `Toolchain` |

### `isAcronym(term)` — Acronym Detection

```javascript
const SAP_KNOWN_TERMS = new Set([
  'rise', 'btp', 'ai', 'hcm', 'bdc', 'erp', 's4', 'ti',
  'clouderp', 'toolchain', 'signavio', 'leanix',
]);

const isAcronym = (term) => {
  // Known SAP topic/solution term — always word-boundary regardless of case
  if (SAP_KNOWN_TERMS.has(term.toLowerCase())) return true;
  // Structural fallback: all uppercase + digits
  return /^[A-Z0-9]+$/.test(term) && /[A-Z]/.test(term);
};
```

The `SAP_KNOWN_TERMS` set ensures that known topic and solution names always use word-boundary matching, regardless of how the user types them. Without this, `rise` (lowercase) would fall through to substring matching and incorrectly match "Enterprise".

**Examples:**

| Term | isAcronym | Reason |
|------|-----------|--------|
| `RISE` | ✅ | Structural: all uppercase |
| `Rise` | ✅ | In `SAP_KNOWN_TERMS` (`rise`) |
| `rise` | ✅ | In `SAP_KNOWN_TERMS` (`rise`) |
| `AI` | ✅ | Structural: all uppercase |
| `ai` | ✅ | In `SAP_KNOWN_TERMS` (`ai`) |
| `BTP` | ✅ | Structural: all uppercase |
| `S4` | ✅ | Structural: uppercase + digit |
| `Cloud` | ❌ | Mixed case, not in known terms → substring |
| `42` | ❌ | No letters |

### `matchesTerm(text, term)` — Single Term Matching

```
text: "LeanIX Enterprise Architecture Advisory"
term: "rise"

1. isAcronym("rise") → true  (SAP_KNOWN_TERMS hit)
2. Regex: /\brise\b/i
3. Test against "LeanIX Enterprise Architecture Advisory" → false
4. Test against CamelCase-normalized → false
5. Result: NO match ✅  ("Enterprise" contains "rise" as substring but not as a word)
```

**CamelCase normalization:**
```
"CloudERP"        → "Cloud ERP"
"GenAI"           → "Gen AI"
"SAP Business AI" → "SAP Business AI"  (no change)
```

### `matchesPhrase(text, phrase)` — Phrase Matching

Checks whether the full search expression appears as a contiguous phrase in a field:

1. **Direct substring**: `"cloud erp (generic)"` contains `"cloud erp"` → ✅
2. **CamelCase-normalized**: `"CloudERP"` → `"cloud erp"` contains `"cloud erp"` → ✅
3. **No-space comparison**: `"clouderp"` contains `"clouderp"` → ✅

---

## Scoring System

### Field Weights

Each searchable field has a weight reflecting its relevance:

| Field | Weight | Reason |
|-------|--------|--------|
| `topicName` | 60 | Core categorization — highest relevance |
| `solutionName` | 50 | Specific product/solution |
| `firstName` | 25 | Person search |
| `lastName` | 25 | Person search |
| `roleName` | 15 | Role type |
| `notes` | 8 | Contextual keywords |
| `email` | 5 | Low relevance |

### Score Calculation (`computeSearchScore`)

```
For each search term:
  → Check if at least one field contains the term (AND semantics)
  → If a term is not found in any field → row excluded (score = 0)

For each field:
  → Phrase match (all terms together in one field)? → weight × 2 (phrase bonus)
  → Otherwise: weight × (number of matching terms / total terms)
```

**Example: searching "Cloud ERP"**

| Expert | topicName | solutionName | Score calculation |
|--------|-----------|--------------|-------------------|
| Lechner Sandra | CloudERP | Cloud ERP (generic), ... | topic: 60×2=120 (phrase) + solution: 50×2=100 (phrase) = **220** |
| Winkler Sophie | CloudMigration | Cloud Migration | Only "Cloud" in topic: 60×0.5=30 + "Cloud" in solution: 50×0.5=25 = **55** (no "ERP" → 0 ❌) |

### AND Semantics

**All** search terms must appear in at least one field. If a single term is not found anywhere, the row gets score 0 and is excluded.

```
Search: "Cloud ERP"
  → Term "Cloud": found somewhere ✅
  → Term "ERP":   found somewhere ✅
  → Both found → row is scored

Search: "Cloud Quantum"
  → Term "Cloud":   found ✅
  → Term "Quantum": not found anywhere ❌
  → Score = 0 → row excluded
```

### Sort Order

Results are sorted as follows:

1. **Search score** (descending) — keyword match relevance
2. **Role score** (descending) — admin-configurable role priority
3. **Last name** (alphabetical) — tiebreaker

**Without search** (no `$search` parameter):
1. **Role score** (descending)
2. **Last name** (alphabetical)

### Role Score (Base Relevance)

Computed independently of the search query — the admin-configurable relevance of an expert:

```javascript
roleScore = role.priority           // admin-configurable (default: 5)
           + (canPresent2H   ? 3 : 0)
           + (canPresentDemo ? 2 : 0)
           + (canPresent30M  ? 1 : 0)
           + (canPresent5M   ? 1 : 0)
```

---

## Deduplication

Since `ExpertSearch` is based on `ExpertRoles`, there are **multiple DB rows per expert** (one per solution-role combination). The Smart Search deduplicates to one row per expert:

```
Input (DB):
  Row 1: Lechner Sandra | Cloud ERP (generic) | Realization Lead
  Row 2: Lechner Sandra | Cloud ERP: Finance   | Realization Consultant
  Row 3: Lechner Sandra | Cloud ERP: Sales     | Realization Consultant

Output (deduplicated):
  Lechner Sandra
    solutionName:   "Cloud ERP (generic), Cloud ERP: Finance, Cloud ERP: Sales"
    roleName:       "Realization Consultant, Realization Lead"
    topicName:      "CloudERP"
    relevanceScore: MAX(roleScore) across all rows
    searchScore:    MAX(searchScore) across all rows
    canPresent*:    OR-merged across all rows
```

---

## OData Integration

### Fiori Elements FilterBar → Smart Search

The Fiori Elements List Report sends search queries as an OData `$search` parameter:

```
GET /api/catalog/ExpertSearch?$search=Cloud%20ERP&$top=30&$skip=0
```

CAP translates `$search` internally into a CQN search expression:

```javascript
// CQN format: [{val:'Cloud'},'and',{val:'ERP'}]
// or:         [{val:'Cloud ERP'}]
```

`extractSearchString()` extracts the raw search string from various CQN formats:

```javascript
function extractSearchString(searchExpr) {
  // string → return as-is
  // array  → extract all {val:...} objects and join with ' '
  // object → extract .val
}
```

### $filter is preserved

Standard OData filters (`$filter`) set via the FilterBar (topic, location, etc.) are **not** affected by Smart Search. They are passed as a `WHERE` clause to the database:

```
GET /api/catalog/ExpertSearch?$search=ERP&$filter=topicName eq 'CloudERP'
```

→ Filter applied at DB level, Smart Search runs on the filtered result set.

### Pagination

Smart Search paginates manually after scoring:

```javascript
const page = results.slice(skip, skip + top);
page.$count = total;  // total count for Fiori "X of Y"
```

---

## searchExperts Action

In addition to the OData `$search` integration, there is a separate **CDS action** `searchExperts` — the entry point for the Joule Skill:

```
POST /api/catalog/searchExperts
Content-Type: application/json
{"query": "Cloud ERP"}
```

Uses the same matching algorithm (`computeSearchScore`) but returns additional diagnostic fields:

| Field | Type | Description |
|-------|------|-------------|
| `score` | Integer | Combined score (searchScore + roleScore) |
| `reasoning` | String | e.g. "Search match: 120 pts across [Cloud, ERP]. Role priority: 7." |
| `isMockMode` | Boolean | `true` — prepared for future AI Core replacement (see [AI_CORE.md](./AI_CORE.md)) |

---

## Configuration & Extension

### Changing field weights

Weights are defined in `SEARCH_FIELD_WEIGHTS` in `srv/catalog-service.js`:

```javascript
const SEARCH_FIELD_WEIGHTS = {
  topicName:    60,
  solutionName: 50,
  firstName:    25,
  lastName:     25,
  roleName:     15,
  email:         5,
  notes:         8,
};
```

Server restart required after changes.

### Adding new searchable fields

1. Add field to `ExpertSearch` view in `srv/catalog-service.cds`
2. Add field with weight to `SEARCH_FIELD_WEIGHTS`
3. Restart server

### Adding known SAP terms

If a new topic or solution is added that could cause false positives via substring matching, add its lowercase name to `SAP_KNOWN_TERMS` in `srv/catalog-service.js`:

```javascript
const SAP_KNOWN_TERMS = new Set([
  'rise', 'btp', 'ai', 'hcm', 'bdc', 'erp', 's4', 'ti',
  'clouderp', 'toolchain', 'signavio', 'leanix',
  // add new terms here
]);
```

---

## Test Cases

### Manual tests via curl

```bash
# TEST 1: "AI" acronym — no false positive on "Toolchain"
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=AI" | jq '.value[] | .lastName'
# Expected: only AI-topic experts

# TEST 2: "rise" lowercase — no false positive on "Enterprise"
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=rise" | jq '.value[] | {n:.lastName, t:.topicName}'
# Expected: only RISE-topic experts (Krammer, Hollerweger, Rothbauer, Knapitsch)
# NOT expected: Hartmann (Integrated Toolchain), Schindler (BDC/SAC)

# TEST 3: Phrase "Cloud ERP" — CloudERP experts first
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=Cloud%20ERP" | jq '.value[] | {n:.lastName, t:.topicName}'
# Expected: Lechner, Gruber, Hollerweger, ... (all Topic "CloudERP")

# TEST 4: Substring "Toolchain" — Integrated Toolchain found
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=Toolchain" | jq '.value[] | .lastName'
# Expected: Friedl, Hartmann, Steindl, Weissenböck, Pöchhacker

# TEST 5: No search — all experts sorted by role score
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$top=5" | jq '.value[] | {n:.lastName, s:.relevanceScore}'
# Expected: sorted by relevanceScore descending
```

### Edge Cases

| Input | Behavior | Reason |
|-------|----------|--------|
| `RISE` (uppercase) | Word boundary | Structural acronym |
| `Rise` (mixed case) | Word boundary | In `SAP_KNOWN_TERMS` |
| `rise` (lowercase) | Word boundary | In `SAP_KNOWN_TERMS` |
| `ai` (lowercase) | Word boundary | In `SAP_KNOWN_TERMS` (2-char, would otherwise be boundary anyway) |
| `CloudERP` (one word) | Found | CamelCase normalization: "CloudERP" → "Cloud ERP" |
| `SAP` | Word boundary | Structural acronym |
| `Cloud` | Substring | Mixed case, not in known terms → safe at 5 chars |

---

## Performance Notes

The current implementation loads **all rows** from the `ExpertSearch` view and runs matching in JavaScript. This works well for the current data size (~85 ExpertRole rows, ~20 experts).

**If data grows significantly** (>1000 experts), consider:
- PostgreSQL Full-Text Search (`tsvector` / `tsquery`) as a DB-side pre-filter
- Caching ExpertSearch data in the service handler
- Indexing frequently searched fields (topicName, solutionName)

For semantic/natural language search, see [AI_CORE.md](./AI_CORE.md).

---

## File Overview

| File | Responsibility |
|------|----------------|
| `srv/catalog-service.js` | Smart Search implementation (matching, scoring, deduplication) |
| `srv/catalog-service.cds` | ExpertSearch view definition, `@cds.search` annotation, `searchExperts` action |
| `app/findmyexpert-search/annotations.cds` | UI annotations for the List Report (FilterBar, columns, etc.) |
| `app/findmyexpert-search/webapp/manifest.json` | Fiori Elements configuration (OData model, routing) |
| `docs/AI_CORE.md` | Optional Phase 3: semantic search via SAP AI Core |
