'use strict';
const cds = require("@sap/cds");
const LOG = cds.log('findmyexpert');

// Tiny UUID generator
const genId = () => {
  try { return cds.utils.uuid(); } catch (_) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Smart Search — word-boundary matching + field-weighted relevance scoring
// ═══════════════════════════════════════════════════════════════════════════════

/** Escape special regex characters in a string */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Detect whether a term is likely an acronym.
 * Acronyms: all uppercase (e.g. "RISE", "AI", "BTP", "HCM"),
 * or all uppercase + digits (e.g. "S4", "BW4").
 */
const isAcronym = (term) => /^[A-Z0-9]+$/.test(term) && /[A-Z]/.test(term);

/**
 * Check if `text` contains `term` respecting word boundaries.
 * Strategy by term type:
 * - Acronyms (all-uppercase like "AI", "RISE", "BTP"): strict word-boundary match
 * - Short terms ≤ 3 chars (non-acronym): word-boundary + camelCase-boundary
 * - Terms ≥ 4 chars (non-acronym): substring match (plus camelCase-normalized)
 */
function matchesTerm(text, term) {
  if (!text || !term) return false;
  const lower = text.toLowerCase();
  const lTerm = term.toLowerCase();

  // CamelCase-normalize: "CloudERP" → "Cloud ERP"
  const normalized = text.replace(/([a-z])([A-Z])/g, '$1 $2')
                         .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                         .toLowerCase();

  // Acronyms (any length) — strict word boundary to prevent "RISE" matching "Enterprise"
  if (isAcronym(term)) {
    const re = new RegExp(`\\b${escapeRegex(lTerm)}\\b`, 'i');
    return re.test(text) || re.test(normalized);
  }

  if (lTerm.length <= 2) {
    // Very short non-acronym terms — require strict word boundary
    const re = new RegExp(`\\b${escapeRegex(lTerm)}\\b`, 'i');
    return re.test(text) || re.test(normalized);
  }

  if (lTerm.length === 3) {
    // 3-char non-acronym terms — word boundary OR camelCase boundary
    const re = new RegExp(`\\b${escapeRegex(lTerm)}\\b`, 'i');
    if (re.test(text) || re.test(normalized)) return true;
    // Also allow substring in camelCase-normalized form
    return normalized.includes(lTerm);
  }

  // 4+ chars non-acronym — substring match is safe
  return lower.includes(lTerm) || normalized.includes(lTerm);
}

/**
 * Check if `text` contains the full `phrase` (multi-word).
 * Tries: direct substring, camelCase-normalized, and no-space comparison.
 */
function matchesPhrase(text, phrase) {
  if (!text || !phrase) return false;
  const lower = text.toLowerCase();
  const lPhrase = phrase.toLowerCase();

  // Direct substring: "Cloud ERP (generic)" contains "cloud erp"
  if (lower.includes(lPhrase)) return true;

  // CamelCase-normalized: "CloudERP" → "cloud erp" contains "cloud erp"
  const normalized = text.replace(/([a-z])([A-Z])/g, '$1 $2')
                         .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                         .toLowerCase();
  if (normalized.includes(lPhrase)) return true;

  // No-space comparison: "clouderp" contains "clouderp"
  const noSpaceLower = lower.replace(/[\s\-_/()]+/g, '');
  const noSpacePhrase = lPhrase.replace(/[\s\-_/()]+/g, '');
  if (noSpaceLower.includes(noSpacePhrase)) return true;

  return false;
}

/**
 * Field weights for search relevance scoring.
 * Higher weight = match in this field is more relevant.
 */
const SEARCH_FIELD_WEIGHTS = {
  topicName:    60,   // Core categorization — most important
  solutionName: 50,   // Specific product/solution
  firstName:    25,   // Person search
  lastName:     25,   // Person search
  roleName:     15,   // Role type
  email:         5,   // Low relevance
  notes:         8,   // Some relevance for keyword context
};

/**
 * Compute a search relevance score for a single ExpertSearch row.
 * Returns 0 if the row does NOT match the search (i.e. should be filtered out).
 *
 * Matching logic:
 * - ALL search terms must be found in at least one field (AND semantic)
 * - Score is weighted by which fields contain matches
 * - Phrase match (all terms together in one field) gets a 2× bonus
 */
function computeSearchScore(row, searchTerms, searchPhrase) {
  // First check: every term must match at least one field
  for (const term of searchTerms) {
    let found = false;
    for (const field of Object.keys(SEARCH_FIELD_WEIGHTS)) {
      if (matchesTerm(row[field], term)) { found = true; break; }
    }
    if (!found) return 0; // AND failed — row doesn't match
  }

  // Compute weighted score across all fields
  let totalScore = 0;
  for (const [field, weight] of Object.entries(SEARCH_FIELD_WEIGHTS)) {
    const value = (row[field] || '').toString();
    if (!value) continue;

    // Phrase match bonus (all terms together in one field)
    if (searchTerms.length > 1 && matchesPhrase(value, searchPhrase)) {
      totalScore += weight * 2;
      continue; // Don't double-count individual terms for this field
    }

    // Individual term matches
    let termMatchCount = 0;
    for (const term of searchTerms) {
      if (matchesTerm(value, term)) termMatchCount++;
    }
    if (termMatchCount > 0) {
      totalScore += weight * (termMatchCount / searchTerms.length);
    }
  }

  return totalScore;
}

/**
 * Extract the raw search string from a CQN search expression.
 * Handles: [{val:'Cloud'},'and',{val:'ERP'}], [{val:'Cloud ERP'}], or string.
 */
function extractSearchString(searchExpr) {
  if (!searchExpr) return '';
  if (typeof searchExpr === 'string') return searchExpr;
  if (Array.isArray(searchExpr)) {
    return searchExpr
      .filter(s => s && typeof s === 'object' && 'val' in s)
      .map(s => s.val)
      .join(' ');
  }
  if (typeof searchExpr === 'object' && 'val' in searchExpr) return searchExpr.val;
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Role-based relevance score (unchanged business logic)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Relevance score for a single ExpertSearch row.
 * Base score = role.priority  (admin-configurable).
 * Presentation capability bonuses on top.
 */
const roleScore = (r) => {
  let s = r.rolePriority ?? 5;
  if (r.canPresent2H)    s += 3;
  if (r.canPresentDemo)  s += 2;
  if (r.canPresent30M)   s += 1;
  if (r.canPresent5M)    s += 1;
  return s;
};


// ═══════════════════════════════════════════════════════════════════════════════
// Service implementation
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = cds.service.impl(async function () {

  // ─── ExpertSearch → ExpertRoles navigation (per-solution detail for Object Page) ──
  this.on('READ', 'ExpertRoles', async (req, next) => {
    const where = req.query.SELECT?.where;
    let expertIdFromNav = null;
    if (Array.isArray(where)) {
      for (let i = 0; i < where.length; i++) {
        const item = where[i];
        if (item?.ref && (
          (item.ref.length === 1 && item.ref[0] === 'expert_ID') ||
          (item.ref.length === 2 && item.ref[0] === 'expert' && item.ref[1] === 'ID')
        )) {
          if (where[i + 1] === '=' && where[i + 2]?.val) {
            expertIdFromNav = where[i + 2].val;
            break;
          }
        }
      }
    }
    if (!expertIdFromNav) return next();
    const { ExpertRoles } = this.entities;
    const q = SELECT.from(ExpertRoles).where({ expert_ID: expertIdFromNav });
    return cds.db.run(q);
  });

  // ─── ExpertSearch: smart search + deduplicate + relevance sort ─────────────
  this.on('READ', 'ExpertSearch', async (req) => {
    const top    = req.query.SELECT?.limit?.rows?.val   ?? 100;
    const skip   = req.query.SELECT?.limit?.offset?.val ?? 0;
    const wantCount = req.query.SELECT?.count ?? false;

    // ── Key read (Object Page) ──────────────────────────────────────────────
    const isKeyRead = Array.isArray(req.params) && req.params.length > 0;
    const where = req.query.SELECT?.where;
    let keyWhereClause = null;
    if (!isKeyRead && Array.isArray(where) && where.length === 3) {
      const [left, op, right] = where;
      if (op === '=' &&
          ((left?.ref?.[0] === 'ID' && right?.val) ||
           (right?.ref?.[0] === 'ID' && left?.val))) {
        keyWhereClause = where;
      }
    }

    if (isKeyRead || keyWhereClause) {
      const { ExpertSearch } = this.entities;
      let keyVal = null;
      if (keyWhereClause) {
        const [left, , right] = keyWhereClause;
        keyVal = left?.val ?? right?.val;
      } else if (req.params?.[0]) {
        const p = req.params[0];
        keyVal = typeof p === 'object' ? (p.ID ?? Object.values(p)[0]) : p;
      }

      if (!keyVal) {
        const resolvedWhere = req.query.SELECT?.where ?? req.params[0];
        const kq = SELECT.from(ExpertSearch).where(resolvedWhere);
        const rows = await cds.db.run(kq);
        return Array.isArray(rows) ? (rows[0] ?? null) : rows;
      }

      const kq = SELECT.from(ExpertSearch).where({ expertID: keyVal });
      const rows = await cds.db.run(kq);
      if (!rows || rows.length === 0) return null;

      const entry = { ...rows[0], ID: keyVal };
      const solutions = new Set();
      const topics    = new Set();
      const roles     = new Set();
      let maxScore = 0;

      for (const row of rows) {
        const s = roleScore(row);
        if (s > maxScore) maxScore = s;
        entry.canPresent5M   = entry.canPresent5M   || row.canPresent5M;
        entry.canPresent30M  = entry.canPresent30M  || row.canPresent30M;
        entry.canPresent2H   = entry.canPresent2H   || row.canPresent2H;
        entry.canPresentDemo = entry.canPresentDemo || row.canPresentDemo;
        if (row.solutionName) solutions.add(row.solutionName);
        if (row.topicName)    topics.add(row.topicName);
        if (row.roleName)     roles.add(row.roleName);
      }
      entry.solutionName = [...solutions].sort().join(', ');
      entry.topicName    = [...topics].sort().join(', ');
      entry.roleName     = [...roles].sort().join(', ');
      entry.relevanceScore = maxScore;

      const columns = req.query.SELECT?.columns;
      if (Array.isArray(columns)) {
        const expandExpertRoles = columns.find(c => c.ref?.[0] === 'expertRoles' && c.expand);
        if (expandExpertRoles) {
          const { ExpertRoles } = this.entities;
          const roleRows = await cds.db.run(
            SELECT.from(ExpertRoles, er => {
              er('*'),
              er.solution(s => { s.ID, s.name }),
              er.role(r => { r.ID, r.name })
            }).where({ expert_ID: keyVal })
          );
          entry.expertRoles = roleRows;
        }
      }

      try {
        const { ExpertLanguages } = this.entities;
        const langRows = await cds.db.run(
          SELECT.from(ExpertLanguages).where({ expert_ID: keyVal })
        );
        entry.languagesText = langRows
          .map(r => r.language_code).filter(Boolean).sort().join(' · ');
      } catch (_) { entry.languagesText = ''; }

      return entry;
    }

    // ── List read (with smart search) ───────────────────────────────────────

    // 1. Extract and REMOVE $search so CAP doesn't apply naive LIKE '%term%'
    const searchExpr = req.query.SELECT?.search;
    let searchTerms = [];
    let searchPhrase = '';
    if (searchExpr) {
      searchPhrase = extractSearchString(searchExpr).trim();
      // Preserve original case for acronym detection (e.g. "RISE", "AI", "BTP")
      searchTerms = searchPhrase.split(/\s+/).filter(t => t.length > 0);
      // Remove $search from query — we handle it ourselves
      delete req.query.SELECT.search;
      LOG.info('Smart search intercepted:', { phrase: searchPhrase, terms: searchTerms });
    }

    // 2. Build query: keep $filter (WHERE) but without $search, without pagination
    const { ExpertSearch } = this.entities;
    const q = SELECT.from(ExpertSearch);
    if (req.query.SELECT?.where) q.SELECT.where = req.query.SELECT.where;
    // Intentionally NOT passing search — we handle it in JS below

    const allRows = await cds.db.run(q);

    // 3. Apply smart matching (or pass all rows through if no search)
    let matchedRows;
    if (searchTerms.length > 0) {
      matchedRows = [];
      for (const row of allRows) {
        const searchScore = computeSearchScore(row, searchTerms, searchPhrase);
        if (searchScore > 0) {
          row._searchScore = searchScore;
          matchedRows.push(row);
        }
      }
      LOG.info(`Smart search: ${allRows.length} total rows → ${matchedRows.length} matched`);
    } else {
      matchedRows = allRows;
      for (const row of matchedRows) row._searchScore = 0;
    }

    // 4. Deduplicate: one row per expert, aggregate solutions/topics/roles
    const expertMap = new Map();
    for (const row of matchedRows) {
      const rScore = roleScore(row);
      const sScore = row._searchScore || 0;

      let entry = expertMap.get(row.expertID);
      if (!entry) {
        entry = {
          ...row,
          _roleScore: rScore,
          _searchScore: sScore,
          _solutions: new Set(),
          _topics: new Set(),
          _roles: new Set(),
        };
        expertMap.set(row.expertID, entry);
      } else {
        // Keep the best search match score
        if (sScore > entry._searchScore) entry._searchScore = sScore;
        // Keep the highest role score
        if (rScore > entry._roleScore) entry._roleScore = rScore;
        // OR-merge presentation capabilities
        entry.canPresent5M   = entry.canPresent5M   || row.canPresent5M;
        entry.canPresent30M  = entry.canPresent30M  || row.canPresent30M;
        entry.canPresent2H   = entry.canPresent2H   || row.canPresent2H;
        entry.canPresentDemo = entry.canPresentDemo || row.canPresentDemo;
      }
      if (row.solutionName) entry._solutions.add(row.solutionName);
      if (row.topicName)    entry._topics.add(row.topicName);
      if (row.roleName)     entry._roles.add(row.roleName);
    }

    // Flatten aggregated sets into comma-separated strings
    for (const entry of expertMap.values()) {
      entry.solutionName = [...entry._solutions].sort().join(', ');
      entry.topicName    = [...entry._topics].sort().join(', ');
      entry.roleName     = [...entry._roles].sort().join(', ');
      delete entry._solutions;
      delete entry._topics;
      delete entry._roles;
    }

    // 5. Enrich with languagesText
    try {
      const { ExpertLanguages } = this.entities;
      const expertIds = [...expertMap.keys()];
      if (expertIds.length > 0) {
        const langRows = await cds.db.run(
          SELECT.from(ExpertLanguages).where({ expert_ID: { in: expertIds } })
        );
        const langByExpert = new Map();
        for (const r of langRows) {
          if (!langByExpert.has(r.expert_ID)) langByExpert.set(r.expert_ID, new Set());
          if (r.language_code) langByExpert.get(r.expert_ID).add(r.language_code);
        }
        for (const entry of expertMap.values()) {
          const codes = langByExpert.get(entry.expertID);
          entry.languagesText = codes ? [...codes].sort().join(' · ') : '';
        }
      }
    } catch (_) { /* non-critical */ }

    // 6. Sort: when searching → search relevance first, then role score; otherwise → role score only
    let results = [...expertMap.values()];
    if (searchTerms.length > 0) {
      results.sort((a, b) =>
        b._searchScore - a._searchScore ||
        b._roleScore - a._roleScore ||
        (a.lastName || '').localeCompare(b.lastName || '')
      );
    } else {
      results.sort((a, b) =>
        b._roleScore - a._roleScore ||
        (a.lastName || '').localeCompare(b.lastName || '')
      );
    }

    // 7. Map to output: relevanceScore = role-based score (business metric shown to user)
    results = results.map(({ _roleScore, _searchScore, ...rest }) => ({
      ...rest,
      relevanceScore: _roleScore,
    }));

    // 8. Paginate
    const total = results.length;
    const page  = results.slice(skip, skip + top);
    page.$count  = total;

    return page;
  });

  // ─── userInfo ───────────────────────────────────────────────────────────────
  this.on("userInfo", async (req) => {
    const user  = req.user;
    const bDev  = !cds.env.production;
    const bAnon = user._is_anonymous || user.id === "anonymous";
    const bAdmin = bDev && bAnon ? true : user.is("Admin");
    const sName  = (user.id && !bAnon) ? user.id : (bDev ? "Dev/Admin" : "");
    return { isAdmin: bAdmin, userName: sName };
  });

  // ─── ExpertRoles / AdminExpertRoles: Compute virtual relevanceScore ───────
  const computeRelevanceScore = async (results) => {
    const list = Array.isArray(results) ? results : [results];
    const needLookup = new Map();
    for (const row of list) {
      if (!row || row.relevanceScore !== undefined && row.relevanceScore !== null) continue;
      if (row.role_ID) {
        if (!needLookup.has(row.role_ID)) needLookup.set(row.role_ID, []);
        needLookup.get(row.role_ID).push(row);
      } else {
        row.relevanceScore = 0;
      }
    }
    const priorityMap = new Map();
    if (needLookup.size > 0) {
      const roleIds = [...needLookup.keys()];
      const roles = await cds.db.run(
        SELECT.from('findmyexpert.Roles').columns('ID', 'priority').where({ ID: { in: roleIds } })
      );
      for (const r of roles) priorityMap.set(r.ID, r.priority ?? 0);
    }
    for (const [roleId, rows] of needLookup) {
      const priority = priorityMap.get(roleId) ?? 0;
      for (const row of rows) {
        row.relevanceScore = priority
          + (row.canPresent2H   ? 3 : 0)
          + (row.canPresentDemo ? 2 : 0)
          + (row.canPresent30M  ? 1 : 0)
          + (row.canPresent5M   ? 1 : 0);
      }
    }
  };

  this.after('READ', 'ExpertRoles',      computeRelevanceScore);
  this.after('READ', 'AdminExpertRoles',  computeRelevanceScore);

  // ─── Admin: Compute virtual fields for AdminExperts ───────────────────────
  const computeFullName = (e) => {
    if (!e) return;
    const parts = [e.lastName, e.firstName].filter(Boolean);
    e.fullName = parts.length ? parts.join(' ') : 'New Expert';
  };

  const computeLanguagesText = (e) => {
    if (!e) return;
    if (Array.isArray(e.languages) && e.languages.length > 0) {
      e.languagesText = e.languages
        .map(l => l.language_code || l.language?.code || l.language?.name || '')
        .filter(Boolean)
        .sort()
        .join(' · ');
    } else {
      e.languagesText = '';
    }
  };

  const computeVirtuals = (e) => { computeFullName(e); computeLanguagesText(e); };

  this.after('READ', 'AdminExperts', async (results) => {
    const list = Array.isArray(results) ? results : [results];
    for (const e of list) {
      if (!Array.isArray(e.languages)) {
        try {
          const { ExpertLanguages } = this.entities;
          e.languages = await cds.db.run(SELECT.from(ExpertLanguages).where({ expert_ID: e.ID }));
        } catch (_) { e.languages = []; }
      }
      computeVirtuals(e);
    }
  });

  this.after('NEW',   'AdminExperts', (data) => { computeVirtuals(data); });
  this.after('EDIT',  'AdminExperts', (data) => { computeVirtuals(data); });
  this.after('PATCH', 'AdminExperts', (data) => { computeVirtuals(data); });

  // ─── Admin: Auto-generate IDs ─────────────────────────────────────────────
  this.before('CREATE', [
    'AdminTopics', 'AdminSolutions', 'AdminExperts', 'AdminExpertRoles', 'AdminRoles'
  ], req => {
    if (!req.data.ID) req.data.ID = genId();
  });

  // ─── Admin: Validate expert email format ──────────────────────────────────
  this.before(['CREATE', 'UPDATE'], 'AdminExperts', req => {
    if (req.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.data.email)) {
      req.error(400, 'Invalid email format', 'email');
    }
  });

  // ─── Admin: Prevent duplicate expert+solution+role combinations ───────────
  this.before('CREATE', 'AdminExpertRoles', async req => {
    const { expert_ID, solution_ID, role_ID } = req.data;
    if (!expert_ID || !solution_ID || !role_ID) return;
    const existing = await SELECT.one.from('findmyexpert.ExpertRoles')
      .where({ expert_ID, solution_ID, role_ID });
    if (existing) {
      req.error(409, 'This Expert/Solution/Role combination already exists.');
    }
  });

  // ─── searchExperts: Keyword-based relevance search (Phase 1 — no AI Core) ──
  this.on('searchExperts', async (req) => {
    const query = (req.data.query || '').trim();
    LOG.info(`searchExperts called — query: "${query}"`);
    if (!query) return [];

    // Preserve original case for acronym detection (e.g. "RISE", "AI", "BTP")
    const searchTerms = query.split(/\s+/).filter(t => t.length > 0);
    const searchPhrase = query;

    const { ExpertSearch } = this.entities;
    const allRows = await cds.db.run(SELECT.from(ExpertSearch));

    const expertMap = new Map();
    for (const row of allRows) {
      const searchScore = computeSearchScore(row, searchTerms, searchPhrase);
      if (searchScore === 0) continue;

      const rScore = row.rolePriority ?? 5;
      const combinedScore = searchScore + rScore;

      let entry = expertMap.get(row.expertID);
      if (!entry) {
        entry = {
          expertID: row.expertID,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          country_code: row.country_code,
          countryName: row.countryName,
          _score: combinedScore,
          _searchScore: searchScore,
          _solutions: new Set(),
          _topics: new Set(),
          _roles: new Set(),
          _matched: new Set(),
          canPresent5M:   row.canPresent5M,
          canPresent30M:  row.canPresent30M,
          canPresent2H:   row.canPresent2H,
          canPresentDemo: row.canPresentDemo,
        };
        expertMap.set(row.expertID, entry);
      } else {
        if (combinedScore > entry._score) entry._score = combinedScore;
        if (searchScore > entry._searchScore) entry._searchScore = searchScore;
        entry.canPresent5M   = entry.canPresent5M   || row.canPresent5M;
        entry.canPresent30M  = entry.canPresent30M  || row.canPresent30M;
        entry.canPresent2H   = entry.canPresent2H   || row.canPresent2H;
        entry.canPresentDemo = entry.canPresentDemo || row.canPresentDemo;
      }
      if (row.solutionName) entry._solutions.add(row.solutionName);
      if (row.topicName)    entry._topics.add(row.topicName);
      if (row.roleName)     entry._roles.add(row.roleName);

      // Track which terms matched
      for (const term of searchTerms) {
        for (const field of Object.keys(SEARCH_FIELD_WEIGHTS)) {
          if (matchesTerm(row[field], term)) { entry._matched.add(term); break; }
        }
      }
    }

    return [...expertMap.values()]
      .sort((a, b) => b._searchScore - a._searchScore || b._score - a._score)
      .map(({ _score, _searchScore, _solutions, _topics, _roles, _matched, ...rest }) => ({
        ...rest,
        solutionName: [..._solutions].sort().join(', '),
        topicName:    [..._topics].sort().join(', '),
        roleName:     [..._roles].sort().join(', '),
        score:        _score,
        reasoning:    `Search match: ${Math.round(_searchScore)} pts across [${[..._matched].join(', ')}]. Role priority: ${_score - _searchScore}.`,
        isMockMode:   true,
      }));
  });
});