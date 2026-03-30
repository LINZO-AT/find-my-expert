# Smart Search — Architektur & Implementierung

## Überblick

Die ExpertSearch nutzt ein eigenes **Smart-Search-System** in `srv/catalog-service.js`, das die Standard-CAP-Suche (`@cds.search` → `LIKE '%term%'`) ersetzt. Die Suche wurde entwickelt, um typische Probleme der Substring-Suche zu lösen:

| Problem | Beispiel | Lösung |
|---------|----------|--------|
| Substring-False-Positives bei Akronymen | `AI` matched „Toolch**ai**n" | Word-Boundary-Matching für Akronyme |
| Substring-False-Positives bei kurzen Termen | `RISE` matched „Enterp**rise**" | Akronym-Erkennung + Word-Boundary |
| CamelCase nicht aufgelöst | `Cloud ERP` findet „CloudERP" nicht | CamelCase-Normalisierung |
| Keine Relevanz-Sortierung | Cloud-Migrationen vor Cloud-ERP-Experten | Feld-gewichtetes Scoring |

---

## Architektur

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
│  2. DELETE req.query.SELECT.search  (verhindert CAP LIKE '%..%')     │
│  3. Load ALL rows from ExpertSearch (DB-View)                        │
│  4. Smart Matching in JS: computeSearchScore() pro Zeile             │
│  5. Deduplizierung pro Expert (aggregiert Solutions/Topics/Roles)    │
│  6. Sortierung: searchScore → roleScore → lastName                   │
│  7. Paginierung ($top / $skip)                                       │
│  8. Return OData-Response mit $count                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Warum kein Standard `@cds.search`?

CAP's `@cds.search` Annotation generiert SQL `WHERE ... LIKE '%term%'`-Bedingungen. Das ist für einfache Suchen ausreichend, hat aber kritische Nachteile:

1. **Keine Word-Boundary-Erkennung**: „AI" findet alles mit den Buchstaben „ai" irgendwo im Text
2. **Keine Relevanz-Sortierung**: Alle Treffer sind gleichwertig — keine Gewichtung nach Feld
3. **Keine Phrase-Erkennung**: „Cloud ERP" wird als zwei unabhängige `LIKE`-Bedingungen behandelt
4. **Keine CamelCase-Auflösung**: „CloudERP" wird nicht als „Cloud ERP" erkannt

Die Smart Search interceptiert den `$search`-Parameter **bevor** CAP ihn verarbeitet, entfernt ihn aus der Query und führt die Matching-Logik in JavaScript durch.

---

## ExpertSearch — Datengrundlage

`ExpertSearch` ist eine **flache, denormalisierte View** über mehrere Entities:

```
ExpertRoles  →  Experts    (expert.*)
             →  Solutions  (solution.name)
             →  Topics     (solution.topic.name)
             →  Roles      (role.name, role.priority)
```

**Ein Expert hat mehrere ExpertRoles** → eine Zeile pro Expert-Solution-Role-Kombination. Die Smart Search dedupliziert diese zu einer Zeile pro Expert und aggregiert Solutions, Topics und Roles als kommaseparierte Listen.

### CDS-Definition (srv/catalog-service.cds)

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
    virtual languagesText  : String(200),
    expertRoles : Association to many ExpertRoles on expertRoles.expert.ID = expertID
};
```

> **Hinweis:** Die `@cds.search`-Annotation ist noch vorhanden, wird aber durch die Smart Search im Service Handler übersteuert (der `$search`-Parameter wird vor der DB-Abfrage entfernt).

---

## Matching-Algorithmus

### Term-Klassifikation

Jeder Suchbegriff wird klassifiziert, bevor das Matching stattfindet:

| Typ | Erkennung | Matching-Strategie | Beispiele |
|-----|-----------|---------------------|-----------|
| **Akronym** | `/^[A-Z0-9]+$/` mit min. 1 Buchstabe | Strikte Word-Boundary (`\b`) | `AI`, `RISE`, `BTP`, `S4`, `HCM` |
| **Kurz (≤2 Zeichen)** | Nicht-Akronym, Länge ≤ 2 | Word-Boundary (`\b`) | `fi`, `pp` |
| **Mittel (3 Zeichen)** | Nicht-Akronym, Länge = 3 | Word-Boundary + CamelCase-Substring | `erp`, `sap` |
| **Lang (≥4 Zeichen)** | Nicht-Akronym, Länge ≥ 4 | Substring (sicher bei langen Termen) | `Cloud`, `Signavio`, `Toolchain` |

### `isAcronym(term)` — Akronym-Erkennung

```javascript
const isAcronym = (term) => /^[A-Z0-9]+$/.test(term) && /[A-Z]/.test(term);
```

- Prüft ob der Term **ausschließlich** aus Großbuchstaben und Ziffern besteht
- Erfordert mindestens einen Buchstaben (reine Ziffern sind keine Akronyme)
- **Wichtig:** Die Suchbegriffe werden in **Originalschreibweise** beibehalten (kein `.toLowerCase()` vor dem Split), damit die Akronym-Erkennung funktioniert

**Beispiele:**
| Term | isAcronym | Begründung |
|------|-----------|------------|
| `RISE` | ✅ | Alle Großbuchstaben |
| `AI` | ✅ | Alle Großbuchstaben |
| `BTP` | ✅ | Alle Großbuchstaben |
| `S4` | ✅ | Großbuchstabe + Ziffer |
| `Cloud` | ❌ | Gemischte Groß-/Kleinschreibung |
| `rise` | ❌ | Alles Kleinbuchstaben |
| `42` | ❌ | Keine Buchstaben |

### `matchesTerm(text, term)` — Einzelterm-Matching

```
text: "LeanIX Enterprise Architecture Advisory"
term: "RISE"

1. isAcronym("RISE") → true
2. Regex: /\brise\b/i
3. Test gegen "LeanIX Enterprise Architecture Advisory" → false
4. Test gegen CamelCase-Normalisierung → false
5. Ergebnis: KEIN Match ✅ (Enterprise enthält "rise" als Substring, aber nicht als Wort)
```

**CamelCase-Normalisierung:**
```
"CloudERP"        → "Cloud ERP"
"GenAI"           → "Gen AI"
"SAP Business AI" → "SAP Business AI" (keine Änderung)
```

### `matchesPhrase(text, phrase)` — Phrase-Matching

Prüft ob der gesamte Suchausdruck als zusammenhängende Phrase in einem Feld vorkommt:

1. **Direkter Substring**: `"cloud erp (generic)"` enthält `"cloud erp"` → ✅
2. **CamelCase-normalisiert**: `"CloudERP"` → `"cloud erp"` enthält `"cloud erp"` → ✅
3. **No-Space-Vergleich**: `"clouderp"` enthält `"clouderp"` → ✅

---

## Scoring-System

### Feld-Gewichtung

Jedes durchsuchte Feld hat eine Gewichtung, die dessen Relevanz für die Suche widerspiegelt:

| Feld | Gewicht | Begründung |
|------|---------|------------|
| `topicName` | 60 | Kernkategorisierung — höchste Relevanz |
| `solutionName` | 50 | Spezifisches Produkt/Lösung |
| `firstName` | 25 | Personensuche |
| `lastName` | 25 | Personensuche |
| `roleName` | 15 | Rollentyp |
| `notes` | 8 | Kontextinformationen |
| `email` | 5 | Niedrige Relevanz |

### Score-Berechnung (`computeSearchScore`)

```
Für jeden Suchterm:
  → Prüfe ob mindestens ein Feld den Term enthält (AND-Semantik)
  → Wenn ein Term in keinem Feld gefunden wird → Zeile wird aussortiert (Score = 0)

Für jedes Feld:
  → Phrase-Match (alle Terme zusammen im Feld)? → Gewicht × 2 (Phrase-Bonus)
  → Sonst: Gewicht × (Anzahl matchender Terme / Gesamtanzahl Terme)
```

**Beispiel: Suche nach „Cloud ERP"**

| Expert | topicName | solutionName | Score-Berechnung |
|--------|-----------|--------------|------------------|
| Lechner Sandra | CloudERP | Cloud ERP (generic), ... | topic: 60×2=120 (Phrase) + solution: 50×2=100 (Phrase) = **220** |
| Winkler Sophie | CloudMigration | Cloud Migration | Nur „Cloud" in topic: 60×0.5=30 + „Cloud" in solution: 50×0.5=25 = **55** (kein „ERP" → 0 ❌) |

### AND-Semantik

**Alle** Suchbegriffe müssen in mindestens einem Feld vorkommen. Wenn ein einziger Term nirgends gefunden wird, erhält die Zeile Score 0 und wird ausgeschlossen.

```
Suche: "Cloud ERP"
  → Term "Cloud": muss irgendwo vorkommen ✅
  → Term "ERP": muss irgendwo vorkommen ✅
  → Beide gefunden → Zeile wird bewertet

Suche: "Cloud Quantum"
  → Term "Cloud": gefunden ✅
  → Term "Quantum": nirgends gefunden ❌
  → Score = 0 → Zeile aussortiert
```

### Sortierung

Die Ergebnisliste wird in folgender Reihenfolge sortiert:

1. **Search Score** (absteigend) — Relevanz des Suchtreffers
2. **Role Score** (absteigend) — Admin-konfigurierbare Rollenwertigkeit
3. **Nachname** (alphabetisch) — Tie-Breaker

**Ohne Suche** (kein `$search`-Parameter):
1. **Role Score** (absteigend)
2. **Nachname** (alphabetisch)

### Role Score (Basis-Relevanz)

Der Role Score wird unabhängig von der Suche berechnet und ist die vom Admin konfigurierbare Relevanz eines Experten:

```javascript
roleScore = role.priority           // Admin-konfigurierbar (Standard: 5)
           + (canPresent2H   ? 3 : 0)
           + (canPresentDemo ? 2 : 0)
           + (canPresent30M  ? 1 : 0)
           + (canPresent5M   ? 1 : 0)
```

---

## Deduplizierung

Da `ExpertSearch` auf `ExpertRoles` basiert, gibt es **mehrere Zeilen pro Expert** (eine pro Solution-Role-Kombination). Die Smart Search dedupliziert zu einer Zeile pro Expert:

```
Eingabe (DB):
  Row 1: Lechner Sandra | Cloud ERP (generic) | Realization Lead
  Row 2: Lechner Sandra | Cloud ERP: Finance   | Realization Consultant
  Row 3: Lechner Sandra | Cloud ERP: Sales     | Realization Consultant

Ausgabe (dedupliziert):
  Lechner Sandra
    solutionName: "Cloud ERP (generic), Cloud ERP: Finance, Cloud ERP: Sales"
    roleName:     "Realization Consultant, Realization Lead"
    topicName:    "CloudERP"
    relevanceScore: MAX(roleScore) über alle Zeilen
    searchScore:    MAX(searchScore) über alle Zeilen
    canPresent*:    OR-Verknüpfung über alle Zeilen
```

---

## OData-Integration

### Fiori Elements FilterBar → Smart Search

Der Fiori Elements List Report sendet Suchanfragen als OData `$search`-Parameter:

```
GET /api/catalog/ExpertSearch?$search=Cloud%20ERP&$top=30&$skip=0
```

CAP übersetzt `$search` intern in eine CQN-Suchexpression:

```javascript
// CQN-Format: [{val:'Cloud'},'and',{val:'ERP'}]
// oder:       [{val:'Cloud ERP'}]
```

Die Funktion `extractSearchString()` extrahiert den rohen Suchstring aus verschiedenen CQN-Formaten:

```javascript
function extractSearchString(searchExpr) {
  // String → direkt zurückgeben
  // Array  → alle {val:...} Objekte extrahieren und mit ' ' joinen
  // Object → .val extrahieren
}
```

### $filter bleibt erhalten

Standard-OData-Filter (`$filter`) über die FilterBar (Topic, Location, etc.) werden **nicht** von der Smart Search beeinflusst. Sie werden als `WHERE`-Klausel an die Datenbank weitergegeben:

```
GET /api/catalog/ExpertSearch?$search=ERP&$filter=topicName eq 'CloudERP'
```

→ Filter wird auf DB-Ebene angewandt, Smart Search läuft auf den gefilterten Ergebnissen.

### Paginierung

Die Smart Search paginiert manuell nach dem Scoring:

```javascript
const page = results.slice(skip, skip + top);
page.$count = total;  // Gesamtzahl für Fiori "X of Y"
```

---

## searchExperts Action

Neben der OData-`$search`-Integration gibt es eine separate **CDS-Action** `searchExperts`:

```
POST /api/catalog/searchExperts
Content-Type: application/json
{"query": "Cloud ERP"}
```

Diese Action nutzt denselben Matching-Algorithmus (`computeSearchScore`), gibt aber zusätzlich diagnostische Informationen zurück:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `score` | Integer | Kombinierter Score (searchScore + roleScore) |
| `reasoning` | String | Erklärung: „Search match: 120 pts across [Cloud, ERP]. Role priority: 7." |
| `isMockMode` | Boolean | `true` — für zukünftige AI-basierte Suche vorbereitet |

---

## Konfiguration & Erweiterung

### Feld-Gewichtungen ändern

Die Gewichtungen sind in `SEARCH_FIELD_WEIGHTS` in `srv/catalog-service.js` definiert:

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

Änderungen erfordern einen Server-Neustart.

### Neue durchsuchbare Felder hinzufügen

1. Feld zur `ExpertSearch`-View in `srv/catalog-service.cds` hinzufügen
2. Feld mit Gewichtung in `SEARCH_FIELD_WEIGHTS` eintragen
3. Server neu starten

### Matching-Strategie anpassen

Die Schwellenwerte für Term-Klassifikation können in `matchesTerm()` angepasst werden:

- `isAcronym()`: Regex für Akronym-Erkennung
- `lTerm.length <= 2`: Schwelle für sehr kurze Terme (Word-Boundary)
- `lTerm.length === 3`: Schwelle für mittlere Terme (Word-Boundary + Substring)
- `lTerm.length >= 4`: Alles darüber → Substring-Matching

---

## Testfälle

### Manuelle Tests via curl

```bash
# TEST 1: Akronym "AI" — kein False-Positive auf "Toolchain"
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=AI" | jq '.value[] | .lastName'
# Erwartet: Nur AI-Topic-Experten (Brandstätter, Winkler)

# TEST 2: Phrase "Cloud ERP" — CloudERP-Experten zuerst
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=Cloud%20ERP" | jq '.value[] | {n:.lastName, t:.topicName}'
# Erwartet: Lechner, Gruber, Hollerweger, ... (alle Topic "CloudERP")

# TEST 3: Substring "Toolchain" — Integrated Toolchain wird gefunden
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=Toolchain" | jq '.value[] | .lastName'
# Erwartet: Friedl, Hartmann, Steindl, Weissenböck, Pöchhacker

# TEST 4: Ohne Suche — alle Experten nach Role Score sortiert
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$top=5" | jq '.value[] | {n:.lastName, s:.relevanceScore}'
# Erwartet: Sortiert nach relevanceScore absteigend

# TEST 5: Akronym "RISE" — kein False-Positive auf "Enterprise"
curl -s "http://localhost:4004/api/catalog/ExpertSearch?\$search=RISE" | jq '.value[] | {n:.lastName, t:.topicName}'
# Erwartet: Nur RISE-Topic-Experten (Krammer, Hollerweger, Rothbauer, Knapitsch)
# NICHT erwartet: Hartmann (Integrated Toolchain), Schindler (BDC/SAC)
```

### Bekannte Edge Cases

| Eingabe | Verhalten | Begründung |
|---------|-----------|------------|
| `ai` (Kleinbuchstaben) | Substring-Match | Kein Akronym, da Kleinbuchstaben → `matchesTerm` nutzt 2-Zeichen-Word-Boundary |
| `Rise` (Mixed Case) | Substring-Match | Kein Akronym → 4+ Zeichen → Substring, findet „Enterprise" |
| `RISE` (Großbuchstaben) | Word-Boundary | Akronym erkannt → findet nur „RISE" als eigenes Wort |
| `CloudERP` (ein Wort) | Gefunden | CamelCase-Normalisierung: „CloudERP" → „Cloud ERP" |
| `SAP` | Word-Boundary | Akronym → findet „SAP" nur als eigenes Wort |

> **Hinweis:** Da die Akronym-Erkennung auf der **Originalschreibweise** des Suchbegriffs basiert, liefert `RISE` und `rise` unterschiedliche Ergebnisse. Das Fiori Elements Suchfeld übergibt die Eingabe des Benutzers unverändert.

---

## Performance-Hinweise

Die aktuelle Implementierung lädt **alle Zeilen** aus der `ExpertSearch`-View und führt das Matching in JavaScript durch. Das funktioniert gut für die aktuelle Datenmenge (~85 ExpertRole-Zeilen, ~20 Experten).

**Bei stark wachsender Datenmenge** (>1000 Experten) sollte evaluiert werden:
- PostgreSQL Full-Text-Search (`tsvector` / `tsquery`) als DB-seitige Vorfilterung
- Caching der ExpertSearch-Daten im Service Handler
- Indexierung auf häufig gesuchte Felder (topicName, solutionName)

---

## Dateiübersicht

| Datei | Verantwortung |
|-------|---------------|
| `srv/catalog-service.js` | Smart Search Implementierung (Matching, Scoring, Deduplizierung) |
| `srv/catalog-service.cds` | ExpertSearch View-Definition, `@cds.search`-Annotation, `searchExperts`-Action |
| `app/findmyexpert-search/annotations.cds` | UI-Annotationen für den List Report (FilterBar, Columns, etc.) |
| `app/findmyexpert-search/webapp/manifest.json` | Fiori Elements Konfiguration (OData-Model, Routing) |