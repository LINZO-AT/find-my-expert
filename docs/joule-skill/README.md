# Joule Skill: FindMyExpert

## Overview

This Joule Skill enables natural language expert search via SAP Joule Copilot.
Users can ask in plain language (English or German) who their expert is for a given SAP product, solution, or topic — and get back a list of qualified SAP Austria consultants.

**Skill Name:** `FindMyExpert`
**Backend:** CAP OData Action `POST /api/catalog/searchExperts`
**Destination:** `FINDMYEXPERT_BACKEND`

---

## Skill Description (for Joule Studio)

Copy this exactly into the Skill Description field — Joule uses it for intent matching:

```
Find SAP Austria experts by product, solution, or topic.
Use when a user asks: "Who is my expert for [product]?",
"Find an expert for [topic]", "Wer ist mein Experte für [Produkt]?",
"Welcher Experte kann [Produkt] präsentieren?", or
"Show me experts for [solution]".
Returns qualified SAP Austria consultants with contact details
and presentation capabilities.
```

---

## Full Setup Instructions

See **[docs/BTP_DEPLOYMENT.md → Step 7: Joule Skill Setup](../BTP_DEPLOYMENT.md#step-7-joule-skill-setup)** for the complete walkthrough including:

- BTP Destination configuration (with required Additional Properties)
- Registering destination in SAP Build Control Tower
- Creating the Action Project from the CAP OData service
- Building and configuring the Joule Skill in Skill Builder
- Testing in Joule Playground
- Deploying to production

---

## skill-definition.json

The `skill-definition.json` in this directory is a **reference document** describing the skill's intent, action, and response format. It is **not imported directly into Joule Studio** — Joule Studio has no import function for this format.

Use it as a reference when configuring the skill manually in Joule Studio's visual Skill Builder.

### Mapping: skill-definition.json → Joule Studio

| JSON field | Joule Studio equivalent |
|------------|------------------------|
| `intents` | Skill Description (use as input for the description text) |
| `action.destinationName` | BTP Destination name |
| `action.path` | OData Action endpoint in Action Project |
| `action.body.query` | Input parameter mapping in Skill Builder |
| `responseTemplate` | Send Message step content |

---

## Example Queries

```
"Who is my expert for Signavio?"
"Wer ist mein Experte für S/4HANA Finance?"
"Find an expert for SAP BTP Integration Suite"
"Welcher Experte kann AI in SAP präsentieren?"
"Show me experts for SuccessFactors"
"Who can do a 2-hour presentation on SAP Analytics Cloud?"
```

---

## Response Format

The skill returns results from the `searchExperts` action with these fields:

| Field | Description |
|-------|-------------|
| `firstName` / `lastName` | Expert name |
| `email` | Contact email |
| `solutionName` | SAP solution the expert covers |
| `topicName` | Parent topic |
| `roleName` | Expert's role (e.g. "Topic Owner", "Realization Lead") |
| `reasoning` | AI-generated explanation of why this expert was matched |
| `score` | Relevance score (higher = more relevant) |
| `canPresent5M/30M/2H` | Presentation capabilities |
| `canPresentDemo` | Can give a demo |
