'use strict';
const cds = require("@sap/cds");
const LOG = cds.log('catalog-service');

// Role display labels (DE/EN)
const ROLE_LABELS = {
  TOPIC_OWNER:              "Topic Owner",
  SOLUTIONING_ARCH:         "Solutioning Architect",
  THEMEN_LEAD:              "Themen Lead",
  SERVICE_SELLER:           "Service Seller",
  REALIZATION_LEAD:         "Realization Lead",
  REALIZATION_CONSULTANT:   "Realization Consultant",
  PROJECT_MANAGEMENT:       "Project Management",
  OTHER_CONTACT_AT:         "Other Contact (AT)",
  OTHER_CONTACT_NON_AT:     "Other Contact"
};

// Role relevance weights (higher = more relevant)
const ROLE_WEIGHTS = {
  TOPIC_OWNER:              100,
  SOLUTIONING_ARCH:          85,
  THEMEN_LEAD:               75,
  SERVICE_SELLER:            65,
  REALIZATION_LEAD:          55,
  REALIZATION_CONSULTANT:    45,
  PROJECT_MANAGEMENT:        35,
  OTHER_CONTACT_AT:          20,
  OTHER_CONTACT_NON_AT:      10
};

module.exports = cds.service.impl(async function () {

  // ─── userInfo ───────────────────────────────────────────────────────────────
  this.on("userInfo", async (req) => {
    const user = req.user;
    return {
      isAdmin: user.is("Admin"),
      userName: user.id || ""
    };
  });

  // ─── searchExperts ──────────────────────────────────────────────────────────
  this.on("searchExperts", async (req) => {
    const sQuery = (req.data.query || "").trim().toLowerCase();
    if (!sQuery) {
      return [];
    }

    try {
      // Load all ExpertRoles with expanded Expert + Solution + Topic
      const aRoles = await SELECT
        .from("findmyexpert.ExpertRoles")
        .columns([
          "ID",
          "role",
          "canPresent5M",
          "canPresent30M",
          "canPresent2H",
          "canPresentDemo",
          "notes",
          "expert.ID as expertId",
          "expert.firstName as firstName",
          "expert.lastName as lastName",
          "expert.email as email",
          "expert.location as location",
          "solution.ID as solutionId",
          "solution.name as solutionName",
          "solution.description as solutionDescription",
          "solution.topic.ID as topicId",
          "solution.topic.name as topicName",
          "solution.topic.description as topicDescription"
        ])
        .where("expert_ID IS NOT NULL AND solution_ID IS NOT NULL");

      if (!aRoles || aRoles.length === 0) {
        return [];
      }

      // ── Score each ExpertRole entry ────────────────────────────────────────
      const aScored = [];
      for (const oRole of aRoles) {
        const sFirstName   = (oRole.firstName || "").toLowerCase();
        const sLastName    = (oRole.lastName || "").toLowerCase();
        const sSolution    = (oRole.solutionName || "").toLowerCase();
        const sTopic       = (oRole.topicName || "").toLowerCase();
        const sSolDesc     = (oRole.solutionDescription || "").toLowerCase();
        const sTopicDesc   = (oRole.topicDescription || "").toLowerCase();
        const sNotes       = (oRole.notes || "").toLowerCase();
        const sRoleLabel   = (ROLE_LABELS[oRole.role] || oRole.role || "").toLowerCase();

        // Split query into tokens for multi-word matching
        const aTokens = sQuery.split(/\s+/).filter(Boolean);
        let iScore = 0;

        for (const sToken of aTokens) {
          // Exact match on name — highest weight
          if (sFirstName === sToken || sLastName === sToken) iScore += 50;
          else if (sFirstName.includes(sToken) || sLastName.includes(sToken)) iScore += 30;

          // Solution match — high weight
          if (sSolution === sToken) iScore += 45;
          else if (sSolution.includes(sToken)) iScore += 25;

          // Topic match
          if (sTopic === sToken) iScore += 40;
          else if (sTopic.includes(sToken)) iScore += 20;

          // Role label match
          if (sRoleLabel.includes(sToken)) iScore += 20;

          // Description / notes — lower weight
          if (sSolDesc.includes(sToken)) iScore += 10;
          if (sTopicDesc.includes(sToken)) iScore += 8;
          if (sNotes.includes(sToken)) iScore += 5;
        }

        // Apply role weight bonus (0–10 pts)
        const iRoleWeight = ROLE_WEIGHTS[oRole.role] || 0;
        iScore += Math.round(iRoleWeight / 20);

        if (iScore > 0) {
          aScored.push({
            _key: oRole.expertId + oRole.role + oRole.solutionId,
            expertId:      oRole.expertId,
            firstName:     oRole.firstName || "",
            lastName:      oRole.lastName || "",
            email:         oRole.email || "",
            location:      oRole.location || "",
            topicName:     oRole.topicName || "",
            solutionName:  oRole.solutionName || "",
            role:          oRole.role || "",
            roleLabel:     ROLE_LABELS[oRole.role] || oRole.role || "",
            canPresent5M:  !!oRole.canPresent5M,
            canPresent30M: !!oRole.canPresent30M,
            canPresent2H:  !!oRole.canPresent2H,
            canPresentDemo:!!oRole.canPresentDemo,
            score:         iScore,
            isMockMode:    false
          });
        }
      }

      if (aScored.length === 0) {
        return [];
      }

      // ── Deduplicate: keep highest score per expertId+role ──────────────────
      const oSeen = new Map();
      for (const oResult of aScored) {
        const sKey = oResult.expertId + "|" + oResult.role;
        if (!oSeen.has(sKey) || oSeen.get(sKey).score < oResult.score) {
          oSeen.set(sKey, oResult);
        }
      }

      // ── Sort by score desc, cap at 50 results ─────────────────────────────
      const aFinal = Array.from(oSeen.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

      // Normalize scores to 0–100 range
      const iMaxScore = aFinal[0]?.score || 1;
      for (const oResult of aFinal) {
        oResult.score = Math.min(100, Math.round((oResult.score / iMaxScore) * 100));
        delete oResult._key;
      }

      return aFinal;

    } catch (err) {
      LOG.error("searchExperts failed:", err.message);
      req.error(500, "Expert search failed: " + err.message);
    }
  });
});
