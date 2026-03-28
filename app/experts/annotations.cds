using CatalogService as service from '../../srv/catalog-service';

// ─── ExpertSearch field labels + value helps ─────────────────────────────────
annotate service.ExpertSearch with {
    firstName    @title: '{i18n>FirstName}';
    lastName     @title: '{i18n>LastName}';
    email        @title: '{i18n>Email}';
    location     @title: '{i18n>Location}';

    solutionName @title: '{i18n>Solution}'
        @Common.ValueList: {
            CollectionPath : 'Solutions',
            Parameters     : [{
                $Type             : 'Common.ValueListParameterOut',
                LocalDataProperty : solutionName,
                ValueListProperty : 'name'
            }]
        }
        @Common.ValueListWithFixedValues: false;

    topicName @title: '{i18n>Topic}'
        @Common.ValueList: {
            CollectionPath : 'Topics',
            Parameters     : [{
                $Type             : 'Common.ValueListParameterOut',
                LocalDataProperty : topicName,
                ValueListProperty : 'name'
            }]
        }
        @Common.ValueListWithFixedValues: false;

    roleName @title: '{i18n>Role}'
        @Common.ValueList: {
            CollectionPath : 'Roles',
            Parameters     : [{
                $Type             : 'Common.ValueListParameterOut',
                LocalDataProperty : roleName,
                ValueListProperty : 'name'
            }]
        }
        @Common.ValueListWithFixedValues: false;

    rolePriority  @title: '{i18n>RolePriority}';
    notes         @title: '{i18n>Notes}';
    canPresent5M  @title: '{i18n>CanPresent5M}';
    canPresent30M @title: '{i18n>CanPresent30M}';
    canPresent2H  @title: '{i18n>CanPresent2H}';
    canPresentDemo @title: '{i18n>CanPresentDemo}';
};

// ─── ExpertSearch — List Report (aggregated, one row per expert) ─────────────
// roleName and canPresent* removed from LineItem — shown per-solution in Object Page
annotate service.ExpertSearch with @(
    UI.HeaderInfo        : {
        TypeName       : '{i18n>Expert}',
        TypeNamePlural : '{i18n>Experts}',
        Title          : {
            $Type : 'UI.DataField',
            Value : fullName
        },
    },
    UI.SelectionFields   : [
        firstName,
        lastName,
        location,
        topicName,
        solutionName,
        roleName
    ],
    UI.LineItem          : [
        {
            $Type : 'UI.DataField',
            Value : firstName,
            Label : '{i18n>FirstName}'
        },
        {
            $Type : 'UI.DataField',
            Value : lastName,
            Label : '{i18n>LastName}'
        },
        {
            $Type : 'UI.DataField',
            Value : location,
            Label : '{i18n>Location}'
        },
        {
            $Type : 'UI.DataField',
            Value : topicName,
            Label : '{i18n>Topics}'
        },
        {
            $Type : 'UI.DataField',
            Value : solutionName,
            Label : '{i18n>Solutions}'
        },
    ],
    UI.FieldGroup #ExpertInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>ExpertInformation}',
        Data  : [
            { $Type : 'UI.DataField', Value : firstName },
            { $Type : 'UI.DataField', Value : lastName },
            { $Type : 'UI.DataField', Value : email },
            { $Type : 'UI.DataField', Value : location },
        ],
    },
    UI.HeaderFacets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'HeaderExpertInfo',
            Target : '@UI.FieldGroup#ExpertInfo',
        },
    ],
    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'ExpertRolesFacet',
            Label  : '{i18n>ExpertRoles}',
            Target : 'expertRoles/@UI.LineItem',
        },
    ],
);

// ─── ExpertRoles — sub-table in Experts Object Page (read-only catalog view) ─
// Shows per-solution role assignments with presentation capabilities
annotate service.ExpertRoles with {
    expert        @title: '{i18n>Expert}';
    solution      @title: '{i18n>Solution}';
    role          @title: '{i18n>Role}';
    canPresent5M  @title: '{i18n>CanPresent5M}';
    canPresent30M @title: '{i18n>CanPresent30M}';
    canPresent2H  @title: '{i18n>CanPresent2H}';
    canPresentDemo @title: '{i18n>CanPresentDemo}';
    notes         @title: '{i18n>Notes}';
};

annotate service.ExpertRoles with @(
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Value : solution_ID,
            Label : '{i18n>Solution}'
        },
        {
            $Type : 'UI.DataField',
            Value : role_ID,
            Label : '{i18n>Role}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresent5M,
            Label : '{i18n>CanPresent5M}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresent30M,
            Label : '{i18n>CanPresent30M}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresent2H,
            Label : '{i18n>CanPresent2H}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresentDemo,
            Label : '{i18n>CanPresentDemo}'
        },
        {
            $Type : 'UI.DataField',
            Value : notes,
            Label : '{i18n>Notes}'
        },
    ],
);

// ─── Admin: Roles ─────────────────────────────────────────────────────────────
annotate service.AdminRoles with @(
    UI.HeaderInfo      : {
        TypeName       : '{i18n>Role}',
        TypeNamePlural : '{i18n>Roles}',
        Title          : {
            $Type : 'UI.DataField',
            Value : name
        },
        Description    : {
            $Type : 'UI.DataField',
            Value : description
        }
    },
    UI.SelectionFields : [ name ],
    UI.LineItem        : [
        {
            $Type : 'UI.DataField',
            Value : name,
            Label : '{i18n>RoleName}'
        },
        {
            $Type : 'UI.DataField',
            Value : priority,
            Label : '{i18n>RolePriority}'
        },
        {
            $Type : 'UI.DataField',
            Value : description,
            Label : '{i18n>Description}'
        },
    ],
    UI.FieldGroup #RoleInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>RoleInformation}',
        Data  : [
            { $Type : 'UI.DataField', Value : name },
            { $Type : 'UI.DataField', Value : priority },
            { $Type : 'UI.DataField', Value : description },
        ],
    },
    UI.Facets          : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'RoleInfoFacet',
            Label  : '{i18n>RoleInformation}',
            Target : '@UI.FieldGroup#RoleInfo',
        },
    ],
);

annotate service.AdminRoles with {
    name        @title: '{i18n>RoleName}';
    priority    @title: '{i18n>RolePriority}';
    description @title: '{i18n>Description}';
};

// ─── Admin: Topics ────────────────────────────────────────────────────────────
annotate service.AdminTopics with @(
    UI.HeaderInfo      : {
        TypeName       : '{i18n>Topic}',
        TypeNamePlural : '{i18n>Topics}',
        Title          : {
            $Type : 'UI.DataField',
            Value : name
        },
        Description    : {
            $Type : 'UI.DataField',
            Value : description
        }
    },
    UI.SelectionFields : [ name ],
    UI.LineItem        : [
        {
            $Type : 'UI.DataField',
            Value : name,
            Label : '{i18n>Name}'
        },
        {
            $Type : 'UI.DataField',
            Value : description,
            Label : '{i18n>Description}'
        },
    ],
    UI.FieldGroup #TopicInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>TopicInformation}',
        Data  : [
            { $Type : 'UI.DataField', Value : name },
            { $Type : 'UI.DataField', Value : description },
        ],
    },
    UI.Facets          : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'TopicInfoFacet',
            Label  : '{i18n>TopicInformation}',
            Target : '@UI.FieldGroup#TopicInfo',
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'TopicSolutionsFacet',
            Label  : '{i18n>Solutions}',
            Target : 'solutions/@UI.LineItem',
        },
    ],
);

annotate service.AdminTopics with {
    name        @title: '{i18n>Name}';
    description @title: '{i18n>Description}';
};

// ─── Admin: Solutions (shown as sub-table in Topic Object Page + standalone) ──
annotate service.AdminSolutions with @(
    UI.HeaderInfo      : {
        TypeName       : '{i18n>Solution}',
        TypeNamePlural : '{i18n>Solutions}',
        Title          : {
            $Type : 'UI.DataField',
            Value : name
        },
        Description    : {
            $Type : 'UI.DataField',
            Value : description
        }
    },
    UI.LineItem        : [
        {
            $Type : 'UI.DataField',
            Value : name,
            Label : '{i18n>SolutionName}'
        },
        {
            $Type : 'UI.DataField',
            Value : description,
            Label : '{i18n>Description}'
        },
    ],
    UI.FieldGroup #SolutionInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>SolutionInformation}',
        Data  : [
            { $Type : 'UI.DataField', Value : name },
            { $Type : 'UI.DataField', Value : description },
        ],
    },
    UI.Facets          : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'SolutionInfoFacet',
            Label  : '{i18n>SolutionInformation}',
            Target : '@UI.FieldGroup#SolutionInfo',
        },
    ],
);

annotate service.AdminSolutions with {
    name        @title: '{i18n>SolutionName}';
    description @title: '{i18n>Description}';
};

// ─── Admin: Experts ───────────────────────────────────────────────────────────
annotate service.AdminExperts with {
    firstName @title: '{i18n>FirstName}';
    lastName  @title: '{i18n>LastName}';
    email     @title: '{i18n>Email}';
    location  @title: '{i18n>Location}';
};

annotate service.AdminExperts with @(
    UI.HeaderInfo      : {
        TypeName       : '{i18n>Expert}',
        TypeNamePlural : '{i18n>Experts}',
        Title          : {
            $Type : 'UI.DataField',
            Value : fullName
        },
    },
    Common.SideEffects #NameChanged : {
        SourceProperties : [ firstName, lastName ],
        TargetProperties : [ fullName ]
    },
    UI.SelectionFields : [ firstName, lastName, location ],
    UI.LineItem        : [
        {
            $Type : 'UI.DataField',
            Value : firstName,
            Label : '{i18n>FirstName}'
        },
        {
            $Type : 'UI.DataField',
            Value : lastName,
            Label : '{i18n>LastName}'
        },
        {
            $Type : 'UI.DataField',
            Value : email,
            Label : '{i18n>Email}'
        },
        {
            $Type : 'UI.DataField',
            Value : location,
            Label : '{i18n>Location}'
        },
    ],
    UI.FieldGroup #ExpertInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>ExpertInformation}',
        Data  : [
            { $Type : 'UI.DataField', Value : firstName },
            { $Type : 'UI.DataField', Value : lastName },
            { $Type : 'UI.DataField', Value : email },
            { $Type : 'UI.DataField', Value : location },
        ],
    },
    UI.HeaderFacets    : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'HeaderExpertInfo',
            Target : '@UI.FieldGroup#ExpertInfo',
        },
    ],
    UI.Facets          : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'ExpertRolesFacet',
            Label  : '{i18n>ExpertRoles}',
            Target : 'roles/@UI.LineItem',
        },
    ],
);

// ─── Admin: ExpertRoles ───────────────────────────────────────────────────────
// @Common.Text + @Common.TextArrangement inherited from db/schema.cds (expression annotations on associations)
// @Common.ValueList auto-generated via @cds.odata.valuelist on target entities
annotate service.AdminExpertRoles with {
    expert        @title: '{i18n>Expert}';
    solution      @title: '{i18n>Solution}';
    role          @title: '{i18n>Role}';
    canPresent5M  @title: '{i18n>CanPresent5M}';
    canPresent30M @title: '{i18n>CanPresent30M}';
    canPresent2H  @title: '{i18n>CanPresent2H}';
    canPresentDemo @title: '{i18n>CanPresentDemo}';
    notes         @title: '{i18n>Notes}';
};

annotate service.AdminExpertRoles with @(
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Value : solution_ID,
            Label : '{i18n>Solution}'
        },
        {
            $Type : 'UI.DataField',
            Value : role_ID,
            Label : '{i18n>Role}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresent5M,
            Label : '{i18n>CanPresent5M}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresent30M,
            Label : '{i18n>CanPresent30M}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresent2H,
            Label : '{i18n>CanPresent2H}'
        },
        {
            $Type : 'UI.DataField',
            Value : canPresentDemo,
            Label : '{i18n>CanPresentDemo}'
        },
        {
            $Type : 'UI.DataField',
            Value : notes,
            Label : '{i18n>Notes}'
        },
    ],
    UI.FieldGroup #ExpertRoleInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>RoleInformation}',
        Data  : [
            { $Type : 'UI.DataField', Value : solution_ID },
            { $Type : 'UI.DataField', Value : role_ID },
            { $Type : 'UI.DataField', Value : canPresent5M },
            { $Type : 'UI.DataField', Value : canPresent30M },
            { $Type : 'UI.DataField', Value : canPresent2H },
            { $Type : 'UI.DataField', Value : canPresentDemo },
            { $Type : 'UI.DataField', Value : notes },
        ],
    },
    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'ExpertRoleInfoFacet',
            Label  : '{i18n>RoleInformation}',
            Target : '@UI.FieldGroup#ExpertRoleInfo',
        },
    ],
);