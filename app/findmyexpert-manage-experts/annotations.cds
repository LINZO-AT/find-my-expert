using CatalogService as service from '../../srv/catalog-service';

// ─── Admin: Experts ───────────────────────────────────────────────────────────
annotate service.AdminExperts with {
    firstName     @title: '{i18n>FirstName}';
    lastName      @title: '{i18n>LastName}';
    email         @title: '{i18n>Email}'
                  @Communication.IsEmailAddress: true;
    country       @title: '{i18n>Location}'
                  @Common.Text: country.name
                  @Common.TextArrangement: #TextFirst;
    languagesText @title: '{i18n>Languages}';
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
    UI.SelectionFields : [ firstName, lastName, country_code ],
    UI.LineItem        : [
        { $Type : 'UI.DataField', Value : firstName,    Label : '{i18n>FirstName}' },
        { $Type : 'UI.DataField', Value : lastName,     Label : '{i18n>LastName}' },
        { $Type : 'UI.DataField', Value : email,        Label : '{i18n>Email}' },
        { $Type : 'UI.DataField', Value : country_code, Label : '{i18n>Location}' },
    ],
    UI.FieldGroup #ExpertInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>ExpertInformation}',
        Data  : [
            { $Type : 'UI.DataField', Value : firstName },
            { $Type : 'UI.DataField', Value : lastName },
            { $Type : 'UI.DataField', Value : email },
            { $Type : 'UI.DataField', Value : country_code },
        ],
    },
    UI.HeaderFacets : [
        { $Type: 'UI.ReferenceFacet', ID: 'HeaderExpertInfo', Target: '@UI.FieldGroup#ExpertInfo' },
    ],
    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'ExpertRolesFacet',
            Label  : '{i18n>ExpertRoles}',
            Target : 'roles/@UI.LineItem',
        },
    ],
);

// ─── Admin: ExpertLanguages ───────────────────────────────────────────────────
annotate service.AdminExpertLanguages with {
    language @title: '{i18n>Language}'
             @Common.Text: language.name
             @Common.TextArrangement: #TextOnly
             @Common.ValueList: {
                 CollectionPath: 'Languages',
                 Parameters: [{
                     $Type             : 'Common.ValueListParameterOut',
                     LocalDataProperty : language_code,
                     ValueListProperty : 'code'
                 }, {
                     $Type             : 'Common.ValueListParameterDisplayOnly',
                     ValueListProperty : 'name'
                 }]
             };
};

annotate service.AdminExpertLanguages with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : language_code, Label : '{i18n>Language}' },
    ],
    UI.FieldGroup #LanguageInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>Language}',
        Data  : [
            { $Type : 'UI.DataField', Value : language_code },
        ],
    },
    UI.Facets : [{
        $Type  : 'UI.ReferenceFacet',
        ID     : 'LanguageInfoFacet',
        Label  : '{i18n>Language}',
        Target : '@UI.FieldGroup#LanguageInfo',
    }],
);

// ─── Admin: ExpertRoles ───────────────────────────────────────────────────────
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
        { $Type : 'UI.DataField', Value : solution_ID,    Label : '{i18n>Solution}' },
        { $Type : 'UI.DataField', Value : role_ID,        Label : '{i18n>Role}' },
        { $Type : 'UI.DataField', Value : canPresent5M,   Label : '{i18n>CanPresent5M}' },
        { $Type : 'UI.DataField', Value : canPresent30M,  Label : '{i18n>CanPresent30M}' },
        { $Type : 'UI.DataField', Value : canPresent2H,   Label : '{i18n>CanPresent2H}' },
        { $Type : 'UI.DataField', Value : canPresentDemo, Label : '{i18n>CanPresentDemo}' },
        { $Type : 'UI.DataField', Value : notes,          Label : '{i18n>Notes}' },
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
    UI.Facets : [{
        $Type  : 'UI.ReferenceFacet',
        ID     : 'ExpertRoleInfoFacet',
        Label  : '{i18n>RoleInformation}',
        Target : '@UI.FieldGroup#ExpertRoleInfo',
    }],
);
