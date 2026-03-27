using findmyexpert as db from '../db/schema';

@requires: 'ExpertViewer'
service CatalogService @(path: '/odata/v4/catalog') {

  @readonly entity Topics      as projection on db.Topics;
  @readonly entity Solutions   as projection on db.Solutions;
  @readonly entity Experts     as projection on db.Experts;
  @readonly entity ExpertRoles as projection on db.ExpertRoles;

  /**
   * AI-powered expert search.
   * Returns experts ranked by relevance. Falls back to keyword search if AI Core not configured.
   */
  action searchExperts(query : String not null) returns array of ExpertSearchResult;

  /**
   * Returns current user roles for frontend authorization checks.
   */
  function userInfo() returns UserInfoResult;
}

type ExpertSearchResult {
  expertId       : UUID;
  firstName      : String;
  lastName       : String;
  email          : String;
  location       : String;
  solutionId     : UUID;
  solutionName   : String;
  topicName      : String;
  role           : String;
  roleLabel      : String;
  score          : Integer;
  reasoning      : String;
  canPresent5M   : Boolean;
  canPresent30M  : Boolean;
  canPresent2H   : Boolean;
  canPresentDemo : Boolean;
  isMockMode     : Boolean;
}

type UserInfoResult {
  isAdmin : Boolean;
  roles   : array of String;
}
