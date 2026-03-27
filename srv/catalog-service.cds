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
}