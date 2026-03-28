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

        /**
         * Navigate to admin route using the app router directly.
         * Uses navTo with replace=false to ensure proper browser history push,
         * so Back navigation from the admin ObjectPage returns to the admin ListReport.
         * @param {string} sRouteName - The route name to navigate to
         */
        _navigateToAdmin: function (sRouteName) {
            var oAppComponent = this.base.getAppComponent();
            var oRouter = oAppComponent.getRouter();
            oRouter.navTo(sRouteName, {}, /* bReplace */ false);
        },

        onAdminExperts: function () {
            this._navigateToAdmin("AdminExpertsList");
        },

        onAdminRoles: function () {
            this._navigateToAdmin("AdminRolesList");
        },

        onAdminTopics: function () {
            this._navigateToAdmin("AdminTopicsList");
        }
    });
});
