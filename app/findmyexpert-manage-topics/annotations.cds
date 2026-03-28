using CatalogService as service from '../../srv/catalog-service';

// ─── Admin: Topics ────────────────────────────────────────────────────────────
annotate service.AdminTopics with {
    name        @title: '{i18n>Name}';
    description @title: '{i18n>Description}';
};

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

// ─── Admin: Solutions (shown as sub-table in Topic Object Page) ───────────────
annotate service.AdminSolutions with {
    name        @title: '{i18n>SolutionName}';
    description @title: '{i18n>Description}';
};

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