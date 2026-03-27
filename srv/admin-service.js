'use strict';

const cds = require('@sap/cds');
const LOG = cds.log('admin-service');

module.exports = class AdminService extends cds.ApplicationService {
  async init() {
    // Validate expert email format on create/update
    this.before(['CREATE', 'UPDATE'], 'Experts', req => {
      try {
        if (req.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.data.email)) {
          req.error(400, 'Invalid email format', 'email');
        }
      } catch (err) {
        LOG.error('Email validation failed:', err.message);
        req.error(500, 'Validation error');
      }
    });

    // Prevent duplicate expert+solution+role combinations
    this.before('CREATE', 'ExpertRoles', async req => {
      try {
        const { expert_ID, solution_ID, role } = req.data;
        if (!expert_ID || !solution_ID || !role) return;
        const existing = await SELECT.one.from('findmyexpert.ExpertRoles')
          .where({ expert_ID, solution_ID, role });
        if (existing) {
          req.error(409, 'This Expert/Solution/Role combination already exists.');
        }
      } catch (err) {
        LOG.error('Duplicate check failed:', err.message);
        req.error(500, 'Validation error');
      }
    });

    return super.init();
  }
};
