namespace findmyexpert;

using { cuid, managed } from '@sap/cds/common';

/**
 * Topic areas: AI, BDC, BTP, CloudERP, HCM,
 * Integrated Toolchain, RISE, T&I
 */
@title: 'Topics'
entity Topics : cuid, managed {
  @title: 'Name'
  name        : String(100) not null;
  @title: 'Description'
  description : String(500);
  solutions   : Association to many Solutions on solutions.topic = $self;
}

/**
 * SAP Products / Services
 */
@title: 'Solutions'
entity Solutions : cuid, managed {
  @title: 'Name'
  name        : String(200) not null;
  @title: 'Topic'
  topic       : Association to Topics;
  @title: 'Description'
  description : String(1000);
  experts     : Association to many ExpertRoles on experts.solution = $self;
}

/**
 * People / Internal Experts
 */
@title: 'Experts'
entity Experts : cuid, managed {
  @title: 'First Name'
  firstName   : String(100) not null;
  @title: 'Last Name'
  lastName    : String(100) not null;
  @title: 'E-Mail'
  email       : String(200);
  @title: 'Location'
  location    : String(10);
  roles       : Association to many ExpertRoles on roles.expert = $self;
}

/**
 * Role types — ordered by relevance weight (highest first)
 */
type ExpertRoleType : String enum {
  TopicOwner              = 'TOPIC_OWNER';
  SolutioningArchAdvisory = 'SOLUTIONING_ARCH';
  ThemenLead              = 'THEMEN_LEAD';
  ServiceSeller           = 'SERVICE_SELLER';
  RealizationLead         = 'REALIZATION_LEAD';
  RealizationConsultant   = 'REALIZATION_CONSULTANT';
  ProjectManagement       = 'PROJECT_MANAGEMENT';
  OtherContactAT          = 'OTHER_CONTACT_AT';
  OtherContactNonAT       = 'OTHER_CONTACT_NON_AT';
}

/**
 * Junction: Expert <-> Solution with role metadata
 */
@title: 'Expert Roles'
entity ExpertRoles : cuid, managed {
  @title: 'Expert'
  expert            : Association to Experts   not null;
  @title: 'Solution'
  solution          : Association to Solutions not null;
  @title: 'Role'
  role              : ExpertRoleType           not null;
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
