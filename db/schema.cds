namespace findmyexpert;

using { managed, cuid } from '@sap/cds/common';

/**
 * Location codes for SAP Austria offices / countries
 */
type LocationCode : String(10) enum {
  AT = 'AT';
  DE = 'DE';
  CH = 'CH';
  PL = 'PL';
  RO = 'RO';
  HU = 'HU';
  SK = 'SK';
  CZ = 'CZ';
}

/**
 * Topic areas: AI, BDC, BTP, CloudERP, HCM,
 * Integrated Toolchain, RISE, T&I
 */
@title: 'Topics'
@cds.odata.valuelist
entity Topics : cuid, managed {
  @title: 'Name'
  name        : String(100) not null;
  @title: 'Description'
  description : String(500);
  solutions   : Composition of many Solutions on solutions.topic = $self;
}

/**
 * SAP Products / Services
 */
@title: 'Solutions'
@cds.odata.valuelist
@cds.search: { name, description }
entity Solutions : cuid, managed {
  @title: 'Name'
  name        : String(200) not null;
  @title: 'Topic'
  @Common.Text: (topic.name) @Common.TextArrangement: #TextOnly
  topic       : Association to Topics;
  @title: 'Description'
  description : String(1000);
  experts     : Composition of many ExpertRoles on experts.solution = $self;
}

/**
 * People / Internal Experts
 */
@title: 'Experts'
@cds.odata.valuelist
@cds.search: { firstName, lastName, email, location }
entity Experts : cuid, managed {
  @title: 'First Name'
  firstName   : String(100) not null;
  @title: 'Last Name'
  lastName    : String(100) not null;
  @title: 'E-Mail'
  email       : String(200);
  @title: 'Location'
  location    : LocationCode;
  @title: 'Languages'
  languages   : String(100);
  roles       : Composition of many ExpertRoles on roles.expert = $self;
}

/**
 * Expert role types — admin-manageable.
 * The `priority` field controls relevance ranking in search results:
 * higher value = shown first within the same capability tier.
 */
@title: 'Roles'
@cds.odata.valuelist
entity Roles : cuid, managed {
  @title: 'Name'
  name        : String(100) not null;
  @title: 'Priority'
  priority    : Integer    default 10;
  @title: 'Description'
  description : String(500);
}

/**
 * Junction: Expert <-> Solution with role metadata and presentation capabilities.
 * The `role.priority` field feeds into the relevance score computed in ExpertSearch.
 */
@title: 'Expert Roles'
@cds.search: { notes }
entity ExpertRoles : cuid, managed {
  @title: 'Expert'
  @Common.Text: (expert.lastName) @Common.TextArrangement: #TextOnly
  expert            : Association to Experts   not null;
  @title: 'Solution'
  @Common.Text: (solution.name) @Common.TextArrangement: #TextOnly
  solution          : Association to Solutions not null;
  @title: 'Role'
  @Common.Text: (role.name) @Common.TextArrangement: #TextOnly
  role              : Association to Roles     not null;
  @title: 'Can present 5 min'
  canPresent5M      : Boolean default false;
  @title: 'Can present 30 min'
  canPresent30M     : Boolean default false;
  @title: 'Can present 2 hours'
  canPresent2H      : Boolean default false;
  @title: 'Can demo system'
  canPresentDemo    : Boolean default false;
  @title: 'Notes'
  notes             : String(500);
}