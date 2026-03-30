using CatalogService as service from '../../srv/catalog-service';

// ─── ExpertSearch field labels ────────────────────────────────────────────────
annotate service.ExpertSearch with {
    expertID       @UI.Hidden;
    rolePriority   @UI.Hidden;
    firstName      @title: '{i18n>FirstName}';
    lastName       @title: '{i18n>LastName}';
    email          @title: '{i18n>Email}'
                   @Communication.IsEmailAddress: true;
    // Override inherited @Common.Text from sap.common.Countries.code
    // (ExpertSearch is a flat view — no country navigation, only countryName string)
    country_code   @title: '{i18n>Location}'
                   @Common.Text: countryName
                   @Common.TextArrangement: #TextLast;
    countryName    @title: '{i18n>Location}';
    solutionName @title: '{i18n>Solution}'
        @Common.ValueList: {
            CollectionPath : 'Solutions',
            Parameters     : [{ $Type: 'Common.ValueListParameterOut', LocalDataProperty: solutionName, ValueListProperty: 'name' }]
        }
        @Common.ValueListWithFixedValues: false;

    topicName @title: '{i18n>Topic}'
        @Common.ValueList: {
            CollectionPath : 'Topics',
            Parameters     : [{ $Type: 'Common.ValueListParameterOut', LocalDataProperty: topicName, ValueListProperty: 'name' }]
        }
        @Common.ValueListWithFixedValues: false;

    roleName @title: '{i18n>Role}'
        @Common.ValueList: {
            CollectionPath : 'Roles',
            Parameters     : [{ $Type: 'Common.ValueListParameterOut', LocalDataProperty: roleName, ValueListProperty: 'name' }]
        }
        @Common.ValueListWithFixedValues: false;

    rolePriority   @title: '{i18n>RolePriority}';
    relevanceScore @title: '{i18n>RelevanceScore}';
    notes          @title: '{i18n>Notes}';
    canPresent5M   @title: '{i18n>CanPresent5M}';
    canPresent30M  @title: '{i18n>CanPresent30M}';
    canPresent2H   @title: '{i18n>CanPresent2H}';
    canPresentDemo @title: '{i18n>CanPresentDemo}';
};

// ─── ExpertSearch — List Report ──────────────────────────────────────────────
annotate service.ExpertSearch with @(
    UI.PresentationVariant : {
        SortOrder : [{ Property: relevanceScore, Descending: true }],
    },
    UI.HeaderInfo : {
        TypeName       : '{i18n>Expert}',
        TypeNamePlural : '{i18n>Experts}',
        Title          : { $Type: 'UI.DataField', Value: fullName },
    },
    UI.SelectionFields : [ firstName, lastName, country_code, topicName, solutionName, roleName ],
    UI.SelectionVariant #BTPExperts : {
        $Type          : 'UI.SelectionVariantType',
        Text           : '{i18n>BTPExperts}',
        SelectOptions  : [{
            PropertyName : topicName,
            Ranges       : [{ Sign: #I, Option: #EQ, Low: 'BTP' }]
        }]
    },
    UI.SelectionVariant #AIExperts : {
        $Type          : 'UI.SelectionVariantType',
        Text           : '{i18n>AIExperts}',
        SelectOptions  : [{
            PropertyName : topicName,
            Ranges       : [{ Sign: #I, Option: #EQ, Low: 'AI' }]
        }]
    },
    UI.SelectionVariant #CloudERPExperts : {
        $Type          : 'UI.SelectionVariantType',
        Text           : '{i18n>CloudERPExperts}',
        SelectOptions  : [{
            PropertyName : topicName,
            Ranges       : [{ Sign: #I, Option: #EQ, Low: 'CloudERP' }]
        }]
    },
    UI.SelectionVariant #RISEExperts : {
        $Type          : 'UI.SelectionVariantType',
        Text           : '{i18n>RISEExperts}',
        SelectOptions  : [{
            PropertyName : topicName,
            Ranges       : [{ Sign: #I, Option: #EQ, Low: 'RISE' }]
        }]
    },
    UI.LineItem : [
        { $Type: 'UI.DataField', Value: firstName,    Label: '{i18n>FirstName}' },
        { $Type: 'UI.DataField', Value: lastName,     Label: '{i18n>LastName}' },
        { $Type: 'UI.DataField', Value: country_code, Label: '{i18n>Location}' },
        { $Type: 'UI.DataField', Value: topicName,    Label: '{i18n>Topics}' },
        { $Type: 'UI.DataField', Value: solutionName, Label: '{i18n>Solutions}' },
        { $Type: 'UI.DataField', Value: relevanceScore, Label: '{i18n>RelevanceScore}' },
    ],

    // ─── Object Page Header ──────────────────────────────────────────────────
    UI.FieldGroup #ExpertInfo : {
        $Type : 'UI.FieldGroupType',
        Label : '{i18n>ExpertInformation}',
        Data  : [
            { $Type: 'UI.DataField', Value: firstName },
            { $Type: 'UI.DataField', Value: lastName },
            { $Type: 'UI.DataField', Value: email },
            { $Type: 'UI.DataField', Value: country_code },
        ],
    },
    UI.HeaderFacets : [
        { $Type: 'UI.ReferenceFacet', ID: 'HeaderExpertInfo', Target: '@UI.FieldGroup#ExpertInfo' },
    ],
    UI.Facets : [
        { $Type: 'UI.ReferenceFacet', ID: 'ExpertRolesFacet', Label: '{i18n>ExpertRoles}', Target: 'expertRoles/@UI.LineItem' },
    ],
);

// ─── ExpertRoles — read-only sub-table ───────────────────────────────────────
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
        { $Type: 'UI.DataField', Value: solution_ID,      Label: '{i18n>Solution}' },
        { $Type: 'UI.DataField', Value: role_ID,           Label: '{i18n>Role}' },
        { $Type: 'UI.DataField', Value: relevanceScore,    Label: '{i18n>RelevanceScore}' },
        { $Type: 'UI.DataField', Value: canPresent5M,      Label: '{i18n>CanPresent5M}' },
        { $Type: 'UI.DataField', Value: canPresent30M,     Label: '{i18n>CanPresent30M}' },
        { $Type: 'UI.DataField', Value: canPresent2H,      Label: '{i18n>CanPresent2H}' },
        { $Type: 'UI.DataField', Value: canPresentDemo,    Label: '{i18n>CanPresentDemo}' },
        { $Type: 'UI.DataField', Value: notes,             Label: '{i18n>Notes}' },
    ],
    UI.PresentationVariant : {
        SortOrder : [{ Property: relevanceScore, Descending: true }],
    },
);
