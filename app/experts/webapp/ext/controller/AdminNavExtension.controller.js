sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/ui/core/mvc/OverrideExecution"
], function (ControllerExtension, OverrideExecution) {
    "use strict";

    return ControllerExtension.extend("experts.ext.controller.AdminNavExtension", {
        metadata: {
            methods: {
                "onAdminExperts": { "public": true, "final": false, overrideExecution: OverrideExecution.After },
                "onAdminRoles":   { "public": true, "final": false, overrideExecution: OverrideExecution.After },
                "onAdminTopics":  { "public": true, "final": false, overrideExecution: OverrideExecution.After }
            }
        },

        onAdminExperts: function () {
            this.base.routing.navigateToRoute("AdminExpertsList");
        },

        onAdminRoles: function () {
            this.base.routing.navigateToRoute("AdminRolesList");
        },

        onAdminTopics: function () {
            this.base.routing.navigateToRoute("AdminTopicsList");
        }
    });
});