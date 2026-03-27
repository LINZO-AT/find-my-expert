'use strict';

const cds = require('@sap/cds');
const LOG = cds.log('catalog-service');

const ROLE_WEIGHTS = {
  TOPIC_OWNER: 100,
  SOLUTIONING_ARCH: 90,
  THEMEN_LEAD: 80,
  SERVICE_SELLER: 70,
  REALIZATION_LEAD: 60,
  REALIZATION_CONSULTANT: 50,
  PROJECT_MANAGEMENT: 40,
  OTHER_CONTACT_AT: 20,
  OTHER_CONTACT_NON_AT: 10
};

const ROLE_LABELS = {
  TOPIC_OWNER: 'Topic Owner',
  SOLUTIONING_ARCH: 'Solutioning / Architecture / Advisory',
  THEMEN_LEAD: 'Themen-Lead',
  SERVICE_SELLER: 'Service Seller',
  REALIZATION_LEAD: 'Realization Lead',
  REALIZATION_CONSULTANT: 'Realization Consultant',
  PROJECT_MANAGEMENT: 'Project Management',
  OTHER_CONTACT_AT: 'Other Contact (AT)',
  OTHER_CONTACT_NON_AT: 'Other Contact (Non-AT)'
};

module.exports = class CatalogService extends cds.ApplicationService {

  async init() {
    this.on('searchExperts', this._searchExperts.bind(this));
    this.on('userInfo', this._userInfo.bind(this));
    return super.init();
  }

  async _userInfo(req) {
    try {
      const roles = req.user?.roles || [];
      return {
        isAdmin: req.user?.is('ExpertAdmin') || false,
        roles: Array.isArray(roles) ? roles : []
      };
    } catch (err) {
      LOG.error('userInfo failed:', err.message);
      return { isAdmin: false, roles: [] };
    }
  }

  async _searchExperts(req) {
    try {
      const { query } = req.data;
      if (!query || query.trim().length === 0) {
        req.error(400, 'Query must not be empty');
        return;
      }

      const db = await cds.connect.to('db');
      const expertData = await db.run(
        SELECT.from('findmyexpert.ExpertRoles')
          .columns(
            'ID',
            'role',
            'notes',
            'canPresent5M',
            'canPresent30M',
            'canPresent2H',
            'canPresentDemo',
            'expert.ID as expertId',
            'expert.firstName as firstName',
            'expert.lastName as lastName',
            'expert.email as email',
            'expert.location as location',
            'solution.ID as solutionId',
            'solution.name as solutionName',
            'solution.topic.name as topicName'
          )
      );

      const aiUrl = process.env.AI_CORE_API_URL;
      if (!aiUrl) {
        return this._mockSearch(query, expertData);
      }

      try {
        return await this._aiCoreSearch(query, expertData);
      } catch (err) {
        LOG.warn('AI Core search failed, falling back to mock:', err.message);
        return this._mockSearch(query, expertData);
      }
    } catch (err) {
      LOG.error('searchExperts failed:', err.message);
      req.error(500, 'Expert search failed. Please try again.');
    }
  }

  async _aiCoreSearch(query, expertData) {
    const context = expertData.map(e =>
      `- ${e.firstName} ${e.lastName} (${e.location}) | ${e.topicName} > ${e.solutionName} | Role: ${e.role} | ID: ${e.expertId}/${e.solutionId}`
    ).join('\n');

    const systemPrompt = `You are an expert directory assistant for SAP Austria.
Given a user query, find the most relevant experts from the list below.
Return a JSON array with objects: { expertId, solutionId, score (1-100), reasoning }.
Rank by relevance to the query. Consider solution names, topic names, and roles.
Role importance (highest first): TOPIC_OWNER, SOLUTIONING_ARCH, THEMEN_LEAD, SERVICE_SELLER,
REALIZATION_LEAD, REALIZATION_CONSULTANT, PROJECT_MANAGEMENT, OTHER_CONTACT_AT, OTHER_CONTACT_NON_AT.
Return at most 10 results. Return ONLY the JSON array, no other text.`;

    const response = await fetch(process.env.AI_CORE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_CORE_TOKEN}`
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Expert list:\n${context}\n\nQuery: ${query}` }
        ],
        max_tokens: 1000
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) throw new Error(`AI Core HTTP ${response.status}`);

    const json = await response.json();
    const aiResults = JSON.parse(json.choices[0].message.content);

    return aiResults.map(r => {
      const match = expertData.find(e => e.expertId === r.expertId && e.solutionId === r.solutionId);
      if (!match) return null;
      return {
        ...match,
        score: r.score,
        reasoning: r.reasoning,
        roleLabel: ROLE_LABELS[match.role] || match.role,
        isMockMode: false
      };
    }).filter(Boolean);
  }

  _mockSearch(query, expertData) {
    const q = query.toLowerCase();

    const scored = expertData
      .filter(e =>
        e.firstName?.toLowerCase().includes(q) ||
        e.lastName?.toLowerCase().includes(q) ||
        e.solutionName?.toLowerCase().includes(q) ||
        e.topicName?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q)
      )
      .map(e => {
        const baseWeight = ROLE_WEIGHTS[e.role] || 10;
        const solutionBonus = e.solutionName?.toLowerCase().includes(q) ? 20 : 0;
        const topicBonus = e.topicName?.toLowerCase().includes(q) ? 10 : 0;
        return {
          expertId: e.expertId,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          location: e.location,
          solutionId: e.solutionId,
          solutionName: e.solutionName,
          topicName: e.topicName,
          role: e.role,
          roleLabel: ROLE_LABELS[e.role] || e.role,
          score: Math.min(100, baseWeight + solutionBonus + topicBonus),
          reasoning: 'Mock mode — keyword match',
          canPresent5M: e.canPresent5M,
          canPresent30M: e.canPresent30M,
          canPresent2H: e.canPresent2H,
          canPresentDemo: e.canPresentDemo,
          isMockMode: true
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return scored;
  }
};
