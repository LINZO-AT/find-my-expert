using findmyexpert from '../db/schema';

@cds.query.limit: { default: 50, max: 1000 }
service CatalogService @(path: '/api/catalog') @(requires: ['ExpertViewer', 'Admin']) {

    // ─── Public read-only entities ───────────────────────────────────────────
    @readonly @cds.redirection.target
    @Capabilities.InsertRestrictions.Insertable: false
    @Capabilities.DeleteRestrictions.Deletable: false
    @Capabilities.UpdateRestrictions.Updatable: false
    entity Topics           as projection on findmyexpert.Topics;

    @readonly @cds.redirection.target
    @Capabilities.InsertRestrictions.Insertable: false
    @Capabilities.DeleteRestrictions.Deletable: false
    @Capabilities.UpdateRestrictions.Updatable: false
    entity Solutions        as projection on findmyexpert.Solutions;

    @readonly @cds.redirection.target
    @Capabilities.InsertRestrictions.Insertable: false
    @Capabilities.DeleteRestrictions.Deletable: false
    @Capabilities.UpdateRestrictions.Updatable: false
    entity Experts          as projection on findmyexpert.Experts;

    @readonly @cds.redirection.target
    @Capabilities.InsertRestrictions.Insertable: false
    @Capabilities.DeleteRestrictions.Deletable: false
    @Capabilities.UpdateRestrictions.Updatable: false
    entity ExpertRoles      as projection on findmyexpert.ExpertRoles;

    @readonly @cds.redirection.target
    @Capabilities.InsertRestrictions.Insertable: false
    @Capabilities.DeleteRestrictions.Deletable: false
    @Capabilities.UpdateRestrictions.Updatable: false
    entity Roles            as projection on findmyexpert.Roles;

    // ─── Flat search view (denormalized for full-text search across topic/solution/role) ──
    // relevanceScore = role.priority + capability bonuses (computed in service handler)
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
        solution.name         as solutionName,
        solution.topic.name   as topicName,
        role.name             as roleName,
        role.priority         as rolePriority,
        canPresent5M,
        canPresent30M,
        canPresent2H,
        canPresentDemo,
        notes,
        virtual relevanceScore : Integer,
        // Navigation to per-solution ExpertRoles for Object Page detail
        expertRoles : Association to many ExpertRoles on expertRoles.expert.ID = expertID
    };

    // ─── Admin entities (require Admin role, draft-enabled for CRUD) ─────────
    // Draft-enabled root entities (compositions cascade draft automatically)
    @(requires: 'Admin') @cds.redirection.target: false
    @odata.draft.enabled
    entity AdminTopics as projection on findmyexpert.Topics {
        *, solutions : redirected to AdminSolutions
    };

    @(requires: 'Admin') @cds.redirection.target: false
    entity AdminSolutions as projection on findmyexpert.Solutions {
        *, topic : redirected to AdminTopics
    } excluding { experts };

    @(requires: 'Admin') @cds.redirection.target: false
    @odata.draft.enabled
    entity AdminExperts as projection on findmyexpert.Experts {
        *, roles : redirected to AdminExpertRoles,
        virtual fullName : String(200)
    };

    @(requires: 'Admin') @cds.redirection.target: false
    entity AdminExpertRoles as projection on findmyexpert.ExpertRoles {
        *, expert   : redirected to AdminExperts,
           solution : redirected to AdminSolutions,
           role     : redirected to AdminRoles
    };

    @(requires: 'Admin') @cds.redirection.target: false
    @odata.draft.enabled
    entity AdminRoles as projection on findmyexpert.Roles;

    // ─── User info ───────────────────────────────────────────────────────────
    function userInfo() returns {
        isAdmin  : Boolean;
        userName : String;
    };

    // ─── AI-powered / keyword expert search ──────────────────────────────────
    action searchExperts(query : String not null) returns array of {
        expertID       : UUID;
        firstName      : String;
        lastName       : String;
        email          : String;
        country_code   : String;
        countryName    : String;
        solutionName   : String;
        topicName      : String;
        roleName       : String;
        score          : Integer;
        reasoning      : String;
        canPresent5M   : Boolean;
        canPresent30M  : Boolean;
        canPresent2H   : Boolean;
        canPresentDemo : Boolean;
        isMockMode     : Boolean;
    };

}