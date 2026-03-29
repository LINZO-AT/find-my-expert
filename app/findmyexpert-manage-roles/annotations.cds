using CatalogService as service from '../../srv/catalog-service';

// ─── Admin: Roles ─────────────────────────────────────────────────────────────
annotate service.AdminRoles with {
    name        @title: '{i18n>RoleName}';
    priority    @title: '{i18n>RolePriority}';
    description @title: '{i18n>Description}';
};

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
            { $Type : 'UI.DataField', Value : priority },
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