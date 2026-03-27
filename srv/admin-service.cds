using findmyexpert as db from '../db/schema';

@requires: 'ExpertAdmin'
service AdminService @(path: '/odata/v4/admin') {

  @UI.HeaderInfo: {
    TypeName      : '{i18n>topic}',
    TypeNamePlural: '{i18n>topics}',
    Title         : { Value: name }
  }
  entity Topics      as projection on db.Topics;

  @UI.HeaderInfo: {
    TypeName      : '{i18n>solution}',
    TypeNamePlural: '{i18n>solutions}',
    Title         : { Value: name }
  }
  entity Solutions   as projection on db.Solutions;

  @UI.HeaderInfo: {
    TypeName      : '{i18n>expert}',
    TypeNamePlural: '{i18n>experts}',
    Title         : { Value: lastName },
    Description   : { Value: firstName }
  }
  entity Experts     as projection on db.Experts;

  entity ExpertRoles as projection on db.ExpertRoles;
}