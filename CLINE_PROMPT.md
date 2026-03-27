# Cline Project Prompt — Find My Expert

Du bist ein erfahrener SAP Full-Stack Entwickler. Deine Aufgabe ist es, das **Find My Expert** Projekt vollständig zu analysieren, alle bekannten Probleme zu beheben und die App auf SAP-konformen Produktionsstandard zu bringen.

---

## Projektüberblick

**Find My Expert** ist ein internes SAP-Experten-Verzeichnis für SAP Austria.
- **CAP Backend** (`@sap/cds ^9.x`, Node.js 22, SQLite lokal / PostgreSQL Prod)
- **SAPUI5 Frontend** (UI5 1.132.1, `sap_horizon` Theme, OData V4, Custom MVC)
- **Fiori Launchpad Sandbox** lokal via `ui5 serve`
- **Zwei Services**: `CatalogService` (alle User, read-only) + `AdminService` (ExpertAdmin, CRUD)

**Starten:**
```bash
# Terminal 1 — CAP Backend
npm run watch          # → http://localhost:4004

# Terminal 2 — UI5 Frontend
cd app/findmyexpert
npm run start:sandbox  # → http://localhost:8080/sandbox.html
```

---

## Schritt 1: Vollständige Projektanalyse mit MCP-Servern

Führe die folgenden MCP-Tool-Aufrufe systematisch durch, bevor du irgendwelche Änderungen machst:

### 1a — UI5 MCP: Linter & Manifest Validation
```
ui5-mcp: run_ui5_linter          → analysiere app/findmyexpert/
ui5-mcp: run_manifest_validation → validiere app/findmyexpert/webapp/manifest.json
ui5-mcp: get_version_info        → prüfe ob UI5 1.132.1 aktuell ist
ui5-mcp: get_guidelines          → lade aktuelle Fiori 3 / Horizon Guidelines
```

### 1b — CDS MCP: Modell & Docs
```
cds-mcp: search_model  → analysiere db/schema.cds, srv/*.cds auf Anti-Patterns
cds-mcp: search_docs   → prüfe aktuelle CDS 9.x Best Practices
```

### 1c — SAP UX Fiori MCP: App-Analyse
```
fiori-mcp: list_fiori_apps         → zeige alle registrierten Apps
fiori-mcp: list_functionality      → liste verfügbare Funktionalitäten
fiori-mcp: get_functionality_details → Details zu relevanten Patterns
fiori-mcp: search_docs              → suche nach DynamicPage, ObjectPage, GridList Patterns
```

### 1d — UI5 WebComponents MCP: Modern Controls
```
ui5-webc-mcp: get_guidelines  → prüfe ob WebComponents sinnvoll einsetzbar sind
ui5-webc-mcp: list_docs       → verfügbare Dokumentation
```

---

## Schritt 2: Bekannte Probleme beheben

Behebe alle folgenden Issues nach der Analyse. Prüfe dabei nach jedem Fix ob `npm run watch` und `ui5 serve` noch fehlerfrei laufen.

### P0 — Kritisch

**2.1 ExpertDetail — ObjectPage lädt keine Daten**

Problem: Die `ExpertDetail.view.xml` verwendet `sap.uxap.ObjectPageLayout`. Der Controller bindet den Context via `oModel.bindContext("/Experts('id')")`, aber das `roles`-Expand auf der ObjectPage wird nicht aufgelöst.

Datei: `app/findmyexpert/webapp/controller/ExpertDetail.controller.js`

Erwartetes Verhalten:
- Navigation von Search-Card-Click → ExpertDetail mit `expertId` Parameter
- Navigation von ExpertList-Row-Click → ExpertDetail mit `expertId` Parameter
- ObjectPage zeigt: Name (als Title), Email + Location (headerContent), Expertise-Tabelle (Section)

Fix-Ansatz: Den OData V4 Context korrekt mit `autoExpandSelect: true` binden und sicherstellen dass das `roles`-Expand funktioniert:
```javascript
const oCtx = oModel.bindContext(
  "/Experts('" + sExpertId + "')",
  undefined,
  { $expand: "roles($expand=solution($expand=topic))" }
);
this.getView().setBindingContext(oCtx.getBoundContext());
```

Prüfe mit `ui5-mcp: get_api_reference` (ODataModel V4, bindContext) ob der Ansatz korrekt ist.

---

**2.2 ExpertList — Solutions-Spalte zeigt keine Daten**

Problem: Die `roles`-Association wird via `$expand` geladen, aber der Formatter `formatRoleCount` gibt immer 0 zurück, weil `aRoles` bei OData V4 List-Bindings ein `Proxy`-Objekt ist, kein normales Array.

Datei: `app/findmyexpert/webapp/controller/ExpertList.controller.js`

Fix: Statt `Array.isArray(aRoles)` den Length-Zugriff absichern:
```javascript
formatRoleCount: function(aRoles) {
  const iCount = (aRoles && typeof aRoles.length === 'number') ? aRoles.length : 0;
  return this.getView().getModel("i18n").getResourceBundle().getText("expertListSolutions", [iCount]);
}
```

Alternativ: Column per `length`-Expression befüllen — prüfe mit `ui5-mcp: get_api_reference` (Expression Binding, `length`) den korrekten Ansatz.

---

**2.3 Search-Cards — Avatare werden nicht gerendert**

Problem: `sap.f.cards.Header` mit `avatar`-Property lädt `sap.m.Avatar` korrekt, aber `sap.f.cards` muss explizit im UI5 bootstrap als Library deklariert sein.

Datei: `app/findmyexpert/webapp/sandbox.html` und `manifest.json`

Fix: `sap.f.cards` zu den geladenen Libraries hinzufügen:
```json
// manifest.json → sap.ui5.dependencies.libs
"sap.f.cards": {}
```
```html
<!-- sandbox.html → data-sap-ui-libs -->
data-sap-ui-libs="sap.m,sap.ushell,sap.f,sap.f.cards,sap.uxap,sap.ui.layout,sap.ui.unified"
```

Prüfe mit `ui5-mcp: get_api_reference` (sap.f.cards.Header, Avatar property) ob die Library-Declaration korrekt ist.

---

**2.4 AdminSolutions — Solutions laden nicht nach Topic-Auswahl**

Problem: Der `fetch`-Aufruf auf den OData V4 Service-Endpoint nutzt `oModel.sServiceUrl` — diese Property existiert nicht in OData V4 Models (erst in V2). Der URL muss explizit gebaut werden.

Datei: `app/findmyexpert/webapp/controller/AdminSolutions.controller.js`

Fix: URL korrekt aufbauen:
```javascript
const sServicePath = "/odata/v4/admin/";
const sFilter = encodeURIComponent("topic_ID eq '" + sTopicId + "'");
const sUrl = sServicePath + "Solutions?$filter=" + sFilter + "&$orderby=name";
```

Alternativ: Auf OData V4 `bindList` mit `requestContexts()` wechseln und dabei ein eigenes, frisches Model-Handle verwenden. Prüfe mit `cds-mcp: search_docs` den korrekten Ansatz für OData V4 List-Binding mit Filter.

---

### P1 — Wichtig

**2.5 CDS Service — OData Annotations für Fiori fehlen**

Problem: `catalog-service.cds` und `admin-service.cds` haben keine `@UI` Annotations. Das macht zukünftige Fiori Elements Nutzung unmöglich und die Metadata sind unvollständig.

Datei: `srv/catalog-service.cds`, `srv/admin-service.cds`

Prüfe mit `fiori-mcp: search_docs` (UI Annotations, ValueList, SelectionField) welche Annotations minimal nötig sind, und ergänze sie:
```cds
// Beispiel — bitte via MCP validieren
annotate CatalogService.Experts with @(
  UI.LineItem: [
    { Value: firstName, Label: 'Vorname' },
    { Value: lastName,  Label: 'Nachname' },
    { Value: location,  Label: 'Standort' }
  ],
  UI.HeaderInfo: {
    TypeName: 'Experte',
    TypeNamePlural: 'Experten',
    Title: { Value: lastName }
  }
);
```

---

**2.6 CDS Schema — fehlende `@assert.range` und `@readonly` Annotations**

Problem: `ExpertRoleType` Enum hat keine Validierung. `managed` Felder (`createdAt`, `modifiedAt`) sollten als `@readonly` markiert sein um sie in Fiori-Forms zu verstecken.

Prüfe mit `cds-mcp: search_docs` (Annotations, assert.range, managed aspects) und ergänze entsprechend.

---

**2.7 manifest.json — `sap.fiori.archeType` Tippfehler**

Problem: `"archeType"` ist falsch geschrieben — korrekt ist `"archeType"` → `"archeType"` (SAP schreibt es tatsächlich so, aber prüfe mit `ui5-mcp: run_manifest_validation` ob weitere Felder fehlen oder falsch sind).

---

**2.8 ExpertList — Topic-Filter funktioniert nicht**

Problem: Der Topic-Filter in der ExpertList filtert auf `topic_ID` der Solution, nicht auf `roles/solution/topic_ID` des Experts. Da Experts keine direkte `topic_ID`-Eigenschaft haben, schlägt der OData Filter fehl.

Lösung: Entweder eine `searchExperts`-ähnliche Action für die List-View, oder eine CAP-View-Entity mit Flat-Join erstellen. Prüfe mit `cds-mcp: search_model` welcher Ansatz sauberer ist.

---

### P2 — Qualität

**2.9 Konsistentes Error-Handling im CAP Backend**

Problem: `catalog-service.js` fängt Fehler unterschiedlich ab. Ergänze ein zentrales Error-Logging-Pattern.
Prüfe mit `cds-mcp: search_docs` (Error Handling, req.error) den CDS-Standard.

**2.10 UI5 Linter Findings beheben**

Führe `ui5-mcp: run_ui5_linter` aus und behebe alle Findings (deprecated APIs, missing accessibility attributes, etc.).

**2.11 Accessibility — ARIA Labels**

Alle interaktiven Controls (SearchField, Select, Table) brauchen `ariaLabelledBy` oder `ariaLabel`. Prüfe mit `ui5-mcp: get_guidelines` (Accessibility) die Mindestanforderungen.

---

## Schritt 3: SAP Konformitätsprüfung

Nach allen Fixes:

```
ui5-mcp: run_manifest_validation  → keine Errors/Warnings
ui5-mcp: run_ui5_linter           → keine Errors, max. acceptable Warnings
fiori-mcp: search_docs            → prüfe Fiori Design Guidelines Compliance
cds-mcp: search_docs              → prüfe CDS Best Practices Compliance
```

Dokumentiere alle Findings und Fixes in einem `FIXES.md` im Projektroot.

---

## Schritt 4: Funktionstest

Nach den Fixes manuell verifizieren:

| Flow | Erwartetes Ergebnis |
|------|---------------------|
| FLP Home → "Find My Expert" Kachel | → Search View öffnet |
| FLP Home → "Experten verwalten" Kachel | → AdminSolutions öffnet direkt |
| Search: "Signavio" eingeben + Enter | → 3 Cards mit Avatar, Role-Badge, Relevanz |
| Card klicken | → ExpertDetail ObjectPage mit Expertise-Tabelle |
| Expert Directory Button | → ExpertList DynamicPage mit allen Experten |
| ExpertList: Topic-Filter setzen | → Liste filtert korrekt |
| ExpertList: Row klicken | → ExpertDetail ObjectPage |
| ExpertDetail: Back | → zurück zur ExpertList |
| AdminSolutions: Topic klicken | → Solutions laden rechts |
| AdminSolutions: "+ Lösung" | → neue Zeile erscheint |

---

## Wichtige Constraints

- **Kein Fiori Elements** — Custom MVC bleibt (mehr Flexibilität für AI Search UI)
- **UI5 1.132.1** — keine Version-Bumps ohne explizite Freigabe
- **`sap_horizon` Theme** — nicht ändern
- **OData V4** — kein Downgrade auf V2
- **Kein breaking change** am CDS Schema/Service-Pfad (andere Clients könnten ihn nutzen)
- **Sprache**: Kommentare und Commit-Messages auf Englisch, UI-Text via i18n (DE default, EN vorhanden)
- **Alle Änderungen committen** mit sauberem Commit-Message-Format:
  ```
  fix(component): short description
  
  - Detail 1
  - Detail 2
  ```

---

## MCP-Server Referenz

| Server | Wann nutzen |
|--------|-------------|
| `ui5-mcp` | UI5 API Referenz, Linter, Manifest Validation, Guidelines |
| `fiori-mcp` | Fiori Design Patterns, App-Analyse, UX Guidelines |
| `cds-mcp` | CDS Schema Patterns, Service Best Practices, OData Annotations |
| `ui5-webc-mcp` | Falls WebComponents Controls erwogen werden |

**Immer zuerst die MCP-Docs konsultieren, dann implementieren.**
Keine Annahmen aus dem Gedächtnis — alle API-Details via MCP verifizieren.
