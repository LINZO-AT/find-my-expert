using findmyexpert as db from '../db/schema';

@requires: 'ExpertAdmin'
service AdminService @(path: '/odata/v4/admin') {
  entity Topics      as projection on db.Topics;
  entity Solutions   as projection on db.Solutions;
  entity Experts     as projection on db.Experts;
  entity ExpertRoles as projection on db.ExpertRoles;
}
