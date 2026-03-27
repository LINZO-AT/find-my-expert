using findmyexpert from '../db/schema';

service CatalogService @(path: '/api/catalog') {
    @readonly
    entity Topics      as projection on findmyexpert.Topics;
    @readonly
    entity Solutions   as projection on findmyexpert.Solutions;
    @readonly
    entity Experts     as projection on findmyexpert.Experts;
    @readonly
    entity ExpertRoles as projection on findmyexpert.ExpertRoles;

    /**
     * Returns current user info including role information
     */
    function userInfo() returns {
        isAdmin  : Boolean;
        userName : String;
    };

    /**
     * AI Expert Search — returns ranked list of experts matching the query
     */
    action searchExperts(query: String) returns array of {
        expertId      : UUID;
        firstName     : String;
        lastName      : String;
        email         : String;
        location      : String;
        topicName     : String;
        solutionName  : String;
        role          : String;
        roleLabel     : String;
        canPresent5M  : Boolean;
        canPresent30M : Boolean;
        canPresent2H  : Boolean;
        canPresentDemo: Boolean;
        score         : Integer;
        isMockMode    : Boolean;
    };
}