# Developer Guide

Architecture, patterns, and extension points for **Find My Expert**.

---

## Project Structure

```
find-my-expert/
├── app/findmyexpert/
│   └── webapp/
│       ├── Component.js          # App bootstrap, auth detection, userModel
│       ├── manifest.json         # App descriptor, routing, models, CSS
│       ├── index.html            # Standalone entry (no FLP)
│       ├── sandbox.html          # FLP Launchpad sandbox (dev)
│       ├── css/style.css         # Custom Fiori-compliant styles
│       ├── controller/
│       │   ├── BaseController.js # Shared nav, i18n, FLP helpers
│       │   ├── Search.controller.js
│       │   ├── ExpertList.controller.js
│       │   ├── ExpertDetail.controller.js
│       │   ├── AdminSolutions.controller.js
│       │   └── AdminExpert.controller.js
│       ├── view/
│       │   ├── App.view.xml      # Root shell (sap.m.App)
│       │   ├── Search.view.xml
│       │   ├── ExpertList.view.xml
│       │   ├── ExpertDetail.view.xml
│       │   ├── AdminSolutions.view.xml
│       │   └── AdminExpert.view.xml
│       └── i18n/
│           ├── i18n.properties     # Fallback (DE)
│           ├── i18n_de.properties  # German
│           └── i18n_en.properties  # English
├── db/
│   ├── schema.cds               # CDS data model
│   └── data/
│       ├── findmyexpert-Topics.csv
│       ├── findmyexpert-Solutions.csv
│       ├── findmyexpert-Experts.csv
│       └── findmyexpert-ExpertRoles.csv
├── srv/
│   ├── catalog-service.cds      # Public service definition
│   ├── catalog-service.js       # userInfo() + searchExperts() implementation
│   ├── admin-service.cds        # Admin service (requires: 'Admin')
│   └── admin-service.js         # Validation: email, duplicate role prevention
└── docs/
```

---

## Auth Architecture

### How it works (DEV vs PROD)

```
┌─────────────────────────────────────────────────────────────────┐
│ Component.js init()                                              │
│                                                                  │
│  1. _injectDevAuth()  ← synchronous, BEFORE router.initialize() │
│     Sets Authorization: Basic anonymous: on BOTH OData models   │
│     → Prevents browser popups on Admin views                     │
│                                                                  │
│  2. router.initialize()                                          │
│     → routing starts, views may load immediately                │
│                                                                  │
│  3. _loadUserInfo()   ← async                                    │
│     Calls GET /api/catalog/userInfo() with DEV_AUTH header       │
│                                                                  │
│     DEV: userName === "Dev/Admin"                                │
│          → Keep DEV_AUTH header in models                        │
│          → userModel: { isAdmin: true, userName: "Dev/Admin" }   │
│                                                                  │
│     PROD: userName !== "Dev/Admin" (real XSUAA name)             │
│          → _clearDevAuth() removes Basic header from models      │
│          → XSUAA JWT takes over via credentials: same-origin     │
│          → userModel: { isAdmin: true/false, userName: "..." }   │
└─────────────────────────────────────────────────────────────────┘
```

### CAP Auth Backend

```
catalog-service.js userInfo():

  bDev  = !cds.env.production         // false in prod
  bAnon = user._is_anonymous          // true without credentials
  
  isAdmin = bDev && bAnon ? true      // DEV: always Admin
           : user.is("Admin")         // PROD: check XSUAA scope
```

---

## Data Model

See [DATA_MODEL.md](DATA_MODEL.md) for full entity reference.

**Key relationships:**
```
Topics (1) ──< (n) Solutions (1) ──< (n) ExpertRoles (n) >── (1) Experts
```

ExpertRoles is the junction table with additional attributes:
- `role` (enum) — e.g. `TOPIC_OWNER`, `REALIZATION_CONSULTANT`
- `canPresent5M / 30M / 2H / Demo` (Boolean) — presentation capabilities
- `notes` (String) — free-text remarks

---

## Adding a New View

1. Create `app/findmyexpert/webapp/view/MyView.view.xml`
2. Create `app/findmyexpert/webapp/controller/MyView.controller.js`
3. Register in `manifest.json`:
   ```json
   "routes": [
     { "name": "myView", "pattern": "my-path", "target": "MyView" }
   ],
   "targets": {
     "MyView": { "viewName": "MyView", "viewLevel": 1 }
   }
   ```
4. Add i18n keys to `i18n_de.properties` and `i18n_en.properties`

---

## Adding a New CAP Entity

1. Add entity to `db/schema.cds`:
   ```cds
   entity MyEntity : managed {
     key ID   : String(50);
     name     : String(200) not null;
   }
   ```
2. Expose in service (`srv/catalog-service.cds` or `admin-service.cds`):
   ```cds
   @readonly
   entity MyEntity as projection on findmyexpert.MyEntity;
   ```
3. Add seed data: `db/data/findmyexpert-MyEntity.csv`
4. Redeploy DB: `cds deploy --to sqlite:db.sqlite`

---

## searchExperts Action

**Location:** `srv/catalog-service.js`

**Logic:**
1. Loads all `ExpertRoles` with expanded `Expert`, `Solution`, `Topic`
2. For each role, scores relevance across multiple fields (name, solution, topic, role label, notes)
3. Applies role-weight bonus (Topic Owner = 100pts, Realization Consultant = 45pts)
4. Deduplicates by `expertId + role`
5. Sorts by score descending, caps at 50 results
6. Normalizes scores to 0–100 range

**Extending the scoring:**

In `catalog-service.js`, edit the scoring loop:
```javascript
// Add new scoring rule:
if (someOtherField.includes(sToken)) iScore += 15;
```

**Role weights** (`ROLE_WEIGHTS` object):
```javascript
const ROLE_WEIGHTS = {
  TOPIC_OWNER: 100,
  SOLUTIONING_ARCH: 85,
  // ...
};
```

---

## i18n Conventions

- Keys use camelCase: `expertListTitle`, `searchEmptyTitle`
- Role labels: `role_TOPIC_OWNER`, `role_THEMEN_LEAD`, etc.
- Tooltip keys: `tooltip_5M`, `tooltip_30M`, `tooltip_2H`, `tooltip_Demo`
- Score display: `scoreLabel={0}%` → uses `getText("scoreLabel", [score])`

---

## CSS Conventions

Custom styles in `webapp/css/style.css` follow these rules:

- All custom classes prefixed with `fme` (e.g. `.fmeExpertCard`, `.fmeCardContent`)
- Use Fiori CSS variables (`var(--sapUiHighlight)`) — not hardcoded colors
- Never override core Fiori controls directly — only extend via BEM-like modifiers
- Card heights: fixed `220px` via `.fmeExpertCard` to ensure uniform grid

---

## Coding Standards

- **ES6+** syntax throughout (arrow functions, template literals, const/let)
- **No jQuery** — use native DOM or SAPUI5 APIs only
- **Formatters** always in the controller of the view that uses them
- **Role labels** mapped via `ROLE_LABELS` constant (catalog-service.js + ExpertDetail.controller.js)
- **i18n** for all user-visible strings — no hardcoded UI text
- **Error handling**: all async operations wrapped in try/catch with `MessageBox.error()`

---

## Testing

Currently no automated tests. To add:

```bash
npm install --save-dev jest @sap/cds-test
```

Test files go in `test/` directory. CAP provides `cds.test()` for service-level testing.

---

## Linting (UI5 Linter)

```bash
cd app/findmyexpert
npx @ui5/linter
```

Known accepted findings (not fixable without version upgrade):
- `minUI5Version` recommendation (project constraint: 1.132.1)
- CSP inline scripts in `sandbox.html` (structural FLP requirement)
