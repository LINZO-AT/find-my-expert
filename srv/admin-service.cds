using findmyexpert from '../db/schema';

@(requires: 'Admin')
service AdminService @(path: '/api/admin') {
    entity Topics      as projection on findmyexpert.Topics;
    entity Solutions   as projection on findmyexpert.Solutions;
    entity Experts     as projection on findmyexpert.Experts;
    entity ExpertRoles as projection on findmyexpert.ExpertRoles;
}