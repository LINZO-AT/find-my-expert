'use strict';
const cds = require("@sap/cds");

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
      // Object Page: fetch by key and return a single entity object (no dedup needed)
      const { ExpertSearch } = this.entities;
      const resolvedWhere = keyWhereClause ?? req.query.SELECT?.where ?? req.params[0];
      const kq = SELECT.from(ExpertSearch).where(resolvedWhere);
      const rows = await cds.db.run(kq);
      return Array.isArray(rows) ? (rows[0] ?? null) : rows;
    }

    // Build query for ALL matching rows (no LIMIT) to allow correct dedup + pagination
    const { ExpertSearch } = this.entities;
    const q = SELECT.from(ExpertSearch);
    if (req.query.SELECT?.where)  q.SELECT.where  = req.query.SELECT.where;
    if (req.query.SELECT?.search) q.SELECT.search = req.query.SELECT.search;

    // Run against DB (the CDS view handles joins + @cds.search LIKE translation)
    const allRows = await cds.db.run(q);

    // Deduplicate: one row per expert, keeping the highest-relevance role
    const expertMap = new Map();
    for (const row of allRows) {
      const s = roleScore(row);
      const prev = expertMap.get(row.expertID);
      if (!prev || s > prev._score) {
        expertMap.set(row.expertID, { ...row, _score: s });
      }
    }

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
});