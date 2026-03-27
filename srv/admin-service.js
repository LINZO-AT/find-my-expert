'use strict';

const cds  = require('@sap/cds');
const LOG  = cds.log('admin-service');
const { v4: uuidv4 } = require('crypto').webcrypto ? { v4: () => crypto.randomUUID() } : require('uuid');

// Tiny UUID generator — uses native crypto.randomUUID (Node 15+) or fallback
const genId = () => {
  try { return cds.utils.uuid(); } catch (_) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
};

module.exports = class AdminService extends cds.ApplicationService {
  async init() {

    // Auto-generate IDs for entities with String(50) key (no cuid auto-generate)
    this.before('CREATE', ['Topics', 'Solutions', 'Experts', 'ExpertRoles'], req => {
      if (!req.data.ID) {
        req.data.ID = genId();
      }
    });

    // Validate expert email format on create/update
    this.before(['CREATE', 'UPDATE'], 'Experts', req => {
      if (req.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.data.email)) {
        req.error(400, 'Invalid email format', 'email');
      }
    });

    // Prevent duplicate expert+solution+role combinations
    this.before('CREATE', 'ExpertRoles', async req => {
      const { expert_ID, solution_ID, role } = req.data;
      if (!expert_ID || !solution_ID || !role) return;

      const existing = await SELECT.one.from('findmyexpert.ExpertRoles')
        .where({ expert_ID, solution_ID, role });
      if (existing) {
        req.error(409, 'This Expert/Solution/Role combination already exists.');
      }
    });

    return super.init();
  }
};