sap.ui.define([
    "sap/ui/core/routing/HashChanger"
], function (HashChanger) {
    "use strict";

    /**
     * Custom action handlers for admin navigation buttons
     * in the ExpertSearch List Report table toolbar.
     *
     * Handler signature for FE V4 manifest custom actions (controlConfiguration):
     *   function(oBindingContext, oArgs)
     */

    function _navigateToHash(sHash) {
        var oHashChanger = HashChanger.getInstance();
        oHashChanger.setHash(sHash);
    }

    return {
        /**
         * Navigate to Admin Experts List Report
         */
        onAdminExperts: function (oBindingContext, oArgs) {
            _navigateToHash("AdminExperts");
        },

        /**
         * Navigate to Admin Solutions List Report
         */
        onAdminSolutions: function (oBindingContext, oArgs) {
            _navigateToHash("AdminSolutions");
        },

        /**
         * Navigate to Admin Roles List Report
         */
        onAdminRoles: function (oBindingContext, oArgs) {
            _navigateToHash("AdminRoles");
        },

        /**
         * Navigate to Admin Topics List Report
         */
        onAdminTopics: function (oBindingContext, oArgs) {
            _navigateToHash("AdminTopics");
        }
    };
});