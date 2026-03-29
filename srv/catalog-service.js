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

/**
 * Relevance score for a single ExpertSearch row.
 *
 * Base score = role.priority  (stored in the Roles entity, admin-configurable).
 * Presentation capability bonuses are added on top:
 *   canPresent2H  +3   (deeper commitment)
 *   canPresentDemo +2
 *   canPresent30M  +1
 *   canPresent5M   +1
 *
 * The role priority values shipped as seed data:
 *   Topic Owner / SPOC               50
 *   Themen Lead                      45
 *   Solutioning / Architecture / Advisory  40
 *   Realization Lead                 35
 *   Project Management               30
 *   Realization Consultant           25
 *   Service Seller                   20
 *   Other Contact (AT)               10
 *   Other Contact (non-AT)            5
 */
const roleScore = (r) => {
  let s = r.rolePriority ?? 5;
  if (r.canPresent2H)    s += 3;
  if (r.canPresentDemo)  s += 2;
  if (r.canPresent30M)   s += 1;
  if (r.canPresent5M)    s += 1;
  return s;
};

module.exports = cds.service.impl(async function () {

  // ─── ExpertSearch → ExpertRoles navigation (per-solution detail for Object Page) ──
  this.on('READ', 'ExpertRoles', async (req, next) => {
    // Only intercept reads that come via ExpertSearch navigation
    // Detect: req.params will have 2 entries: [{ID: expertSearchKey}, {ID: ...}] for /ExpertSearch(key)/expertRoles
    // Or the query will have a WHERE filter from the association ON condition
    const where = req.query.SELECT?.where;

    // Check if this is a navigation from ExpertSearch (filter on expert.ID or expert_ID)
    let expertIdFromNav = null;
    if (Array.isArray(where)) {
      // Look for expert_ID = <uuid> or expert.ID = <uuid> pattern in WHERE
      for (let i = 0; i < where.length; i++) {
        const item = where[i];
        if (item?.ref && (
          (item.ref.length === 1 && item.ref[0] === 'expert_ID') ||
          (item.ref.length === 2 && item.ref[0] === 'expert' && item.ref[1] === 'ID')
        )) {
          // Next non-operator item should be the value
          if (where[i + 1] === '=' && where[i + 2]?.val) {
            expertIdFromNav = where[i + 2].val;
            break;
          }
        }
      }
    }

    if (!expertIdFromNav) {
      // Not a navigation from ExpertSearch — delegate to default handler
      return next();
    }

    // Query ExpertRoles for this expert directly from DB
    const { ExpertRoles } = this.entities;
    const q = SELECT.from(ExpertRoles).where({ expert_ID: expertIdFromNav });
    return cds.db.run(q);
  });

  // ─── ExpertSearch: deduplicate + relevance sort ───────────────────────────
  this.on('READ', 'ExpertSearch', async (req) => {
    // Extract pagination before running the full query
    const top    = req.query.SELECT?.limit?.rows?.val   ?? 100;
    const skip   = req.query.SELECT?.limit?.offset?.val ?? 0;
    const wantCount = req.query.SELECT?.count ?? false;

    // CAP sets req.params for single-entity (key) reads (path-style: /ExpertSearch(ID=...)).
    const isKeyRead = Array.isArray(req.params) && req.params.length > 0;

    // Secondary detection: WHERE clause is a simple equality filter on the primary key.
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
      // Object Page: fetch by expertID (since aggregation maps ID → expertID)
      const { ExpertSearch } = this.entities;

      // Extract the requested key value
      let keyVal = null;
      if (keyWhereClause) {
        const [left, , right] = keyWhereClause;
        keyVal = left?.val ?? right?.val;
      } else if (req.params?.[0]) {
        const p = req.params[0];
        keyVal = typeof p === 'object' ? (p.ID ?? Object.values(p)[0]) : p;
      }

      if (!keyVal) {
        // Fallback: try original WHERE
        const resolvedWhere = req.query.SELECT?.where ?? req.params[0];
        const kq = SELECT.from(ExpertSearch).where(resolvedWhere);
        const rows = await cds.db.run(kq);
        return Array.isArray(rows) ? (rows[0] ?? null) : rows;
      }

      // Query all ExpertRole rows for this expert and aggregate into one result
      const kq = SELECT.from(ExpertSearch).where({ expertID: keyVal });
      const rows = await cds.db.run(kq);
      if (!rows || rows.length === 0) return null;

      // Aggregate just like the list handler
      const entry = { ...rows[0], ID: keyVal };
      const solutions = new Set();
      const topics    = new Set();
      const roles     = new Set();

      for (const row of rows) {
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

      // Support $expand=expertRoles for Object Page sub-table
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

      // Enrich languagesText for Object Page header
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

    // Build query for ALL matching rows (no LIMIT) to allow correct dedup + pagination
    const { ExpertSearch } = this.entities;
    const q = SELECT.from(ExpertSearch);
    if (req.query.SELECT?.where)  q.SELECT.where  = req.query.SELECT.where;
    if (req.query.SELECT?.search) q.SELECT.search = req.query.SELECT.search;

    // Run against DB (the CDS view handles joins + @cds.search LIKE translation)
    const allRows = await cds.db.run(q);

    // Deduplicate: one row per expert, aggregating solutions/topics/roles
    const expertMap = new Map();
    for (const row of allRows) {
      const s = roleScore(row);
      let entry = expertMap.get(row.expertID);
      if (!entry) {
        entry = {
          ...row,
          _score: s,
          _solutions: new Set(),
          _topics: new Set(),
          _roles: new Set(),
        };
        expertMap.set(row.expertID, entry);
      } else {
        // Keep the highest score
        if (s > entry._score) {
          entry._score = s;
        }
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

    // Enrich with languagesText from ExpertLanguages
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
    } catch (_) { /* non-critical — leave languagesText empty */ }

    // Sort by relevance descending, then lastName ascending as tiebreaker
    let results = [...expertMap.values()].sort((a, b) =>
      b._score - a._score || (a.lastName || '').localeCompare(b.lastName || '')
    );

    // Remove internal _score field
    results = results.map(({ _score, ...rest }) => rest);

    // Paginate — CAP reads $count off the returned array for @odata.count
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

  // ─── Admin: Compute virtual fields for AdminExperts ───────────────────────
  const computeFullName = (e) => {
    if (!e) return;
    const parts = [e.lastName, e.firstName].filter(Boolean);
    e.fullName = parts.length ? parts.join(' ') : 'New Expert';
  };

  // Compute languagesText from expanded languages array (if present)
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

  // After READ: always populate virtual fields
  this.after('READ', 'AdminExperts', async (results) => {
    const list = Array.isArray(results) ? results : [results];
    // For entries without expanded languages, load them
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
    const query = (req.data.query || '').toLowerCase().trim();
    LOG.info(`searchExperts called — query: "${query}"`);
    if (!query) return [];

    const { ExpertSearch } = this.entities;
    const allRows = await cds.db.run(SELECT.from(ExpertSearch));

    // Tokenize query
    const tokens = query.split(/\s+/).filter(t => t.length > 1);

    const expertMap = new Map();
    for (const row of allRows) {
      const text = [
        row.firstName, row.lastName, row.solutionName,
        row.topicName, row.roleName, row.notes, row.country_code
      ].filter(Boolean).join(' ').toLowerCase();

      let matchCount = 0;
      const matchedTokens = [];
      for (const token of tokens) {
        if (text.includes(token)) { matchCount++; matchedTokens.push(token); }
      }
      if (matchCount === 0) continue;

      const s = (row.rolePriority ?? 5) + matchCount * 5;
      let entry = expertMap.get(row.expertID);
      if (!entry) {
        entry = {
          expertID: row.expertID,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          country_code: row.country_code,
          _score: s,
          _solutions: new Set(),
          _topics: new Set(),
          _roles: new Set(),
          _matched: new Set(matchedTokens),
          canPresent5M:   row.canPresent5M,
          canPresent30M:  row.canPresent30M,
          canPresent2H:   row.canPresent2H,
          canPresentDemo: row.canPresentDemo,
        };
        expertMap.set(row.expertID, entry);
      } else {
        if (s > entry._score) entry._score = s;
        entry.canPresent5M   = entry.canPresent5M   || row.canPresent5M;
        entry.canPresent30M  = entry.canPresent30M  || row.canPresent30M;
        entry.canPresent2H   = entry.canPresent2H   || row.canPresent2H;
        entry.canPresentDemo = entry.canPresentDemo || row.canPresentDemo;
        for (const t of matchedTokens) entry._matched.add(t);
      }
      if (row.solutionName) entry._solutions.add(row.solutionName);
      if (row.topicName)    entry._topics.add(row.topicName);
      if (row.roleName)     entry._roles.add(row.roleName);
    }

    return [...expertMap.values()]
      .sort((a, b) => b._score - a._score)
      .map(({ _score, _solutions, _topics, _roles, _matched, ...rest }) => ({
        ...rest,
        solutionName: [..._solutions].sort().join(', '),
        topicName:    [..._topics].sort().join(', '),
        roleName:     [..._roles].sort().join(', '),
        score:        _score,
        reasoning:    `Keyword match: ${[..._matched].join(', ')}. Role score: ${_score}.`,
        isMockMode:   true,
      }));
  });
});