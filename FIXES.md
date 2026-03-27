# FIXES.md — Find My Expert

All issues found during full project analysis and fixed to bring the project to production standard.

---

## P0 — Critical Bugs

### 1. ExpertDetail view binding paths broken
**File:** `app/findmyexpert/webapp/view/ExpertDetail.view.xml`
**Problem:** View used absolute binding paths (`/firstName`, `/lastName`, `/roles`) instead of relative paths. With OData V4 context binding, absolute paths resolve against the model root, not the bound entity.
**Fix:** Changed all property bindings to relative paths (`firstName`, `lastName`, `roles`).

### 2. ExpertList formatters fail on OData V4 collections
**File:** `app/findmyexpert/webapp/controller/ExpertList.controller.js`
**Problem:** `formatSolutionCount` and `formatRoleCount` used `Array.isArray(aRoles)` which returns `false` for OData V4 proxy/deferred objects, causing the formatters to always return 0.
**Fix:** Replaced with `(aRoles && typeof aRoles.length === "number")` to handle both real arrays and OData V4 proxy objects.

### 3. Missing `sap.f.cards` library dependency
**Files:** `app/findmyexpert/webapp/manifest.json`, `app/findmyexpert/webapp/sandbox.html`, `app/findmyexpert/webapp/index.html`
**Problem:** `sap.f.cards` was not declared in manifest dependencies or loaded in bootstrap, causing runtime errors if card controls were used.
**Fix:** Added `sap.f.cards: {}` to `sap.ui5.dependencies.libs` in manifest.json. Added to `data-sap-ui-libs` in both sandbox.html and index.html.

### 4. AdminSolutions fetch URL uses V2-only `sModel.sServiceUrl`
**File:** `app/findmyexpert/webapp/controller/AdminSolutions.controller.js`
**Problem:** Used `oModel.sServiceUrl + "Solutions?..."` — the `sServiceUrl` property does not exist on OData V4 models, resulting in `undefined` in the fetch URL.
**Fix:** Replaced with hardcoded `/odata/v4/admin/Solutions?...` path matching the AdminService service URL.

---

## P1 — Important Issues

### 5. CDS schema missing enum validation
**File:** `db/schema.cds`
**Problem:** `ExpertRoleType` enum and `ExpertRoles.role` field lacked `@assert.range` annotation, meaning invalid enum values would be silently accepted by the OData service.
**Fix:** Added `@assert.range` on the `ExpertRoleType` type definition and on the `role` element in the `ExpertRoles` entity.

### 6. CDS services missing annotations
**Files:** `srv/catalog-service.cds`, `srv/admin-service.cds`
**Problem:** Service projections lacked `@UI.HeaderInfo` and `@UI.LineItem` annotations. Service definitions lacked explicit `@(path)` annotations. Action/function return types were untyped.
**Fix:**
- Added `@UI.HeaderInfo` annotations on Topics, Solutions, Experts in both services
- Added `@UI.LineItem` annotations on CatalogService projections
- Added explicit `@(path: '/odata/v4/catalog')` and `@(path: '/odata/v4/admin')` annotations
- Added typed return types for `searchExperts` action and `userInfo` function in CatalogService

### 7. Manifest.json schema conformity issues
**File:** `app/findmyexpert/webapp/manifest.json`
**Problem:** Multiple manifest schema violations:
- `_version` was `"1.65.0"` (invalid, must be semver like `"2.0.0"`)
- `synchronizationMode: "None"` on OData models (deprecated in V4)
- Missing `flexEnabled` in `sap.ui5`
- Missing `contentDensities` in `sap.ui5`
- Missing `name` property on routing targets (required by manifest v2)
- `async: true` on rootView and routing config (removed in manifest v2)

**Fix:** All issues corrected. `_version` set to `"2.0.0"`, removed deprecated properties, added missing required properties.

### 8. Topic filter not implemented in ExpertList
**File:** `app/findmyexpert/webapp/controller/ExpertList.controller.js`
**Problem:** The topic ComboBox filter existed in the view but `_applyFilters` did not read or apply the topic filter value.
**Fix:** Added topic filter implementation using `roles/solution/topic_ID` filter path in `_applyFilters`.

---

## P2 — Quality Improvements

### 9. AdminService missing error handling
**File:** `srv/admin-service.js`
**Problem:** No input validation or error handling. Invalid data (e.g., malformed emails, duplicate expert roles) was silently accepted.
**Fix:** Added `before` handlers for CREATE/UPDATE on Experts (email format validation) and ExpertRoles (duplicate role prevention). Added global `this.on('error', ...)` handler for structured error responses.

### 10. Component.js uses deprecated globals
**File:** `app/findmyexpert/webapp/Component.js`
**Problem:** Used `sap.ushell && sap.ushell.Container` global access and deprecated `getService("UserInfo")` synchronous API.
**Fix:** Replaced with `sap.ui.require(["sap/ushell/Container"], ...)` async module loading and `getServiceAsync("UserInfo")`.

### 11. BaseController.js uses deprecated globals
**File:** `app/findmyexpert/webapp/controller/BaseController.js`
**Problem:** Used `sap.ushell.Container.getService("CrossApplicationNavigation")` global access.
**Fix:** Replaced with async `_getFLPContainer()` helper using `sap.ui.require(["sap/ushell/Container"], ...)`.

### 12. Bootstrap parameter spelling (sandbox.html)
**File:** `app/findmyexpert/webapp/sandbox.html`
**Problem:** Used camelCase bootstrap attributes (`data-sap-ui-compatVersion`, `data-sap-ui-resourceroots`, `data-sap-ui-frameOptions`) which are non-standard.
**Fix:** Changed to kebab-case: `data-sap-ui-compat-version`, `data-sap-ui-resource-roots`, `data-sap-ui-frame-options`.

### 13. index.html CSP violation and missing bootstrap params
**File:** `app/findmyexpert/webapp/index.html`
**Problem:**
- Used CSP-violating inline `window["sap-ui-config"]` script block
- Missing `data-sap-ui-async="true"` bootstrap attribute
- Missing `data-sap-ui-compat-version` bootstrap attribute
- Used outdated `data-sap-ui-oninit` spelling instead of `data-sap-ui-on-init`
- `resourceRoots` pointed to `http://localhost:8080/` (hardcoded dev URL)

**Fix:** Removed inline script entirely. Moved all configuration to `data-sap-ui-*` attributes on the bootstrap `<script>` tag. Fixed all attribute spellings. Changed resourceRoots to relative `"./"` path.

### 14. Missing ARIA labels in views
**Files:** `app/findmyexpert/webapp/view/ExpertList.view.xml`, `app/findmyexpert/webapp/view/Search.view.xml`
**Problem:** Interactive controls (ComboBox, SearchField, Table) lacked `ariaLabelledBy` attributes.
**Fix:** Added `ariaLabelledBy` references on topicFilter, locationFilter, nameSearch, expertTable (ExpertList) and searchField (Search).

---

## Accepted / Unfixable Linter Findings

| File | Finding | Reason |
|---|---|---|
| `manifest.json` | minUI5Version should be 1.136.0 | Project constraint: UI5 1.132.1, no version bump without approval |
| `sandbox.html` | 2× CSP unsafe inline script | Structural requirement of Fiori Launchpad sandbox bootstrap |

---

## Validation Results

- **Manifest validation:** ✅ Valid (0 errors)
- **UI5 Linter:** 3 findings remaining (all accepted, see table above)