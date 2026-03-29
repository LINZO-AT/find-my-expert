# GDPR Implementation Guide — Find My Expert

> **For AI Coding Agents (Cline, Claude Code, etc.):**  
> This document describes concrete, actionable changes. Each section is self-contained.  
> Implement in the order listed.

---

## Overview

The `Experts` entity stores personal data (name, email, country) of SAP employees.  
DSGVO/GDPR Art. 25 (Privacy by Design) requires technical safeguards.

**Data Processing Context:**

The app runs on SAP BTP. Joule (Work Zone) processes expert data via the `searchExperts` action.  
SAP holds a DPA (Data Processing Agreement), operates on EU infrastructure, and does not train  
Foundation Models on customer data — so Joule itself is vertragliche abgesichert.  
The required measures below focus on data minimization, access control, and subject rights.

**Scope of this document:**
1. Data Minimization for Joule (Art. 5 — highest priority)
2. Soft-Delete / Offboarding support (Art. 17)
3. Audit Logging via `@cap-js/audit-logging` (Art. 30)
4. Data Subject Rights endpoints (Art. 15 + Art. 17)

---

## 1. Data Minimization for Joule (Art. 5)

### Why

`searchExperts` currently returns all available fields including `countryName`, `languagesText`,  
and the `reasoning` string. Joule only needs the minimum required to identify and contact an expert.  
Art. 5 DSGVO (Datensparsamkeit) requires that only necessary data is processed.

### What Joule Actually Needs

| Field | Needed | Reason |
|-------|--------|--------|
| `firstName`, `lastName` | ✅ | Joule names the expert in its response |
| `email` | ✅ | Contact info |
| `solutionName`, `topicName` | ✅ | Joule explains why this expert was matched |
| `roleName` | ✅ | Joule can say "Topic Owner" vs "Consultant" |
| `score` | ✅ | Internal ranking, not shown to user |
| `canPresent5M/30M/2H/Demo` | ✅ | Joule can answer "who can do a demo?" |
| `countryName` | ❌ | Not relevant for expert lookup |
| `country_code` | ❌ | Not relevant for expert lookup |
| `isMockMode` | ❌ | Internal flag, irrelevant for Joule |

### Implementation

**File:** `srv/catalog-service.js`

In the `searchExperts` handler, update the return mapping to exclude unnecessary fields:

```javascript
return ranked.map(({ _score, _solutions, _topics, _roles, _matched, ...rest }) => ({
  expertID:      rest.expertID,
  firstName:     rest.firstName,
  lastName:      rest.lastName,
  email:         rest.email,
  solutionName:  [..._solutions].sort().join(', '),
  topicName:     [..._topics].sort().join(', '),
  roleName:      [..._roles].sort().join(', '),
  score:         _score,
  reasoning:     `Keyword match: ${[..._matched].join(', ')}. Role score: ${_score}.`,
  canPresent5M:  rest.canPresent5M,
  canPresent30M: rest.canPresent30M,
  canPresent2H:  rest.canPresent2H,
  canPresentDemo: rest.canPresentDemo,
  isMockMode:    true,
  // country_code and countryName intentionally omitted
}));
```

### Joule Studio — Field-Level Controls

In Joule Studio (Skill Builder), configure the Send Message step to only reference the fields  
listed above. Do not expose all response fields automatically — select only what the response  
text template actually uses.

---

## 2. Soft-Delete / Offboarding (Art. 17)

### Why

When an employee leaves SAP, their record must be removable (Right to Erasure).  
Hard delete via Admin UI works but loses auditability.  
A `isActive` flag allows hiding data without destroying history.

### Schema Changes

**File:** `db/schema.cds`

Add to the `Experts` entity:

```cds
entity Experts : cuid, managed {
  // ... existing fields ...

  @title: 'Active'
  isActive    : Boolean default true;

  @title: 'Deactivated At'
  deletedAt   : Timestamp;
}
```

### Service Changes

**File:** `srv/catalog-service.cds`

Add a `deactivateExpert` action (Admin only):

```cds
@(requires: 'Admin')
action deactivateExpert(expertID: UUID not null) returns { success: Boolean; message: String; };
```

**File:** `srv/catalog-service.js`

Filter inactive experts from search results and add deactivation handler:

```javascript
// Filter inactive experts from ExpertSearch reads
this.before('READ', 'ExpertSearch', (req) => {
  if (!req.query.SELECT.where) {
    req.query.SELECT.where = [{ ref: ['isActive'] }, '=', { val: true }];
  } else {
    req.query.SELECT.where = [
      ...req.query.SELECT.where,
      'and',
      { ref: ['isActive'] }, '=', { val: true }
    ];
  }
});

// Also filter in searchExperts handler: add .where({ isActive: true }) to SELECT.from(ExpertSearch)

// Deactivate action
this.on('deactivateExpert', async (req) => {
  const { expertID } = req.data;
  const result = await UPDATE('findmyexpert.Experts')
    .set({ isActive: false, deletedAt: new Date().toISOString() })
    .where({ ID: expertID });
  if (result === 0) return { success: false, message: `Expert ${expertID} not found.` };
  LOG.info(`Expert ${expertID} deactivated (soft-delete)`);
  return { success: true, message: 'Expert deactivated.' };
});
```

---

## 3. Audit Logging (Art. 30)

### Why

DSGVO Art. 30 requires a Record of Processing Activities.  
CAP has built-in support via `@cap-js/audit-logging` and the existing `@PersonalData` annotations.

### Setup

```bash
npm add @cap-js/audit-logging
```

**File:** `.cdsrc.json` — add audit log config:

```json
{
  "requires": {
    "audit-log": {
      "kind": "audit-log-to-console"
    }
  }
}
```

> For BTP production: use `kind: "audit-log"` and bind the `auditlog` CF service in `mta.yaml`.

### No Additional Code Required

The `@PersonalData` annotations already exist in `db/schema.cds`.  
CAP's audit plugin reads these automatically.

Verify these annotations are present (they are as of current schema):
```cds
@PersonalData.EntitySemantics: 'DataSubject'    // on Experts entity
@PersonalData.FieldSemantics: 'GivenName'       // firstName
@PersonalData.FieldSemantics: 'FamilyName'      // lastName
@PersonalData.FieldSemantics: 'EMail'           // email
@PersonalData.IsPotentiallyPersonal             // country
```

CAP will automatically log READ/WRITE/DELETE access to these annotated fields.

---

## 4. Data Subject Rights (Art. 15 + Art. 17)

### Why

DSGVO Art. 15 (Right of Access) and Art. 17 (Right to Erasure) require that on request,  
data subjects can receive a copy of their data and request permanent deletion.

### Implementation

**File:** `srv/catalog-service.cds`

```cds
@(requires: 'Admin')
action exportExpertData(expertID: UUID not null) returns LargeString;

@(requires: 'Admin')
action anonymizeExpert(expertID: UUID not null) returns { success: Boolean; message: String; };
```

**File:** `srv/catalog-service.js`

```javascript
// Art. 15 — Export all personal data for a data subject
this.on('exportExpertData', async (req) => {
  const { expertID } = req.data;
  const expert = await SELECT.one.from('findmyexpert.Experts').where({ ID: expertID });
  if (!expert) req.error(404, `Expert ${expertID} not found`);

  const roles = await SELECT.from('findmyexpert.ExpertRoles').where({ expert_ID: expertID });
  const langs = await SELECT.from('findmyexpert.ExpertLanguages').where({ expert_ID: expertID });

  LOG.info(`Data export for expert ${expertID} (Art. 15 DSGVO)`);
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    expert,
    roles,
    languages: langs,
  }, null, 2);
});

// Art. 17 — Anonymize (irreversible, replaces personal data with placeholders)
this.on('anonymizeExpert', async (req) => {
  const { expertID } = req.data;
  const result = await UPDATE('findmyexpert.Experts').set({
    firstName:  'ANONYMIZED',
    lastName:   'ANONYMIZED',
    email:      `anonymized-${expertID.substring(0, 8)}@deleted.invalid`,
    country_ID: null,
    isActive:   false,
    deletedAt:  new Date().toISOString(),
  }).where({ ID: expertID });
  if (result === 0) return { success: false, message: `Expert ${expertID} not found.` };
  LOG.info(`Expert ${expertID} anonymized (Art. 17 DSGVO)`);
  return { success: true, message: 'Expert data anonymized.' };
});
```

---

## Implementation Order

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1 | **Data minimization in `searchExperts`** | `srv/catalog-service.js` | ~15 min |
| 2 | **Soft-Delete schema + handler** | `db/schema.cds`, `srv/catalog-service.cds`, `srv/catalog-service.js` | ~30 min |
| 3 | **Audit Logging setup** | `package.json`, `.cdsrc.json` | ~15 min |
| 4 | **Data Subject Rights actions** | `srv/catalog-service.cds`, `srv/catalog-service.js` | ~30 min |

---

## Testing

### Data Minimization

```bash
curl -X POST http://localhost:4004/api/catalog/searchExperts \
  -H "Content-Type: application/json" \
  -d '{"query": "Signavio"}'
# Verify: response contains NO country_code or countryName fields
```

### Soft-Delete

```bash
curl -X POST http://localhost:4004/api/catalog/deactivateExpert \
  -H "Content-Type: application/json" \
  -d '{"expertID": "<uuid>"}'

# Verify expert no longer appears in search
curl -X POST http://localhost:4004/api/catalog/searchExperts \
  -H "Content-Type: application/json" \
  -d '{"query": "Signavio"}'
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

- **Joule / Work Zone** processes data via SAP's own infrastructure — SAP holds a DPA and  
  does not train on customer data. Pseudonymization is **not required** for the Joule path.
- Pseudonymization would only be relevant if `searchExperts` itself calls an external or  
  self-hosted LLM for ranking — this is not the current or planned architecture.
- For BTP production: replace `audit-log-to-console` with the bound `auditlog` CF service in `mta.yaml`.
- `deactivateExpert` and `anonymizeExpert` should be accessible from the Admin UI —  
  consider adding them as OData bound actions on `AdminExperts`.
- Remove `isMockMode: true` from `searchExperts` response once keyword ranking is considered final.
