sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], function (Controller, History) {
  "use strict";

  return Controller.extend("com.sap.austria.findmyexpert.controller.BaseController", {

    /**
     * Navigate back — respects FLP back navigation.
     * Falls back to browser history or FLP home.
     */
    onNavBack: function () {
      const sPreviousHash = History.getInstance().getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        // No history — navigate to FLP home if available, else to search
        const oCrossAppNav = sap.ushell
          && sap.ushell.Container
          && sap.ushell.Container.getService("CrossApplicationNavigation");

        if (oCrossAppNav && oCrossAppNav.toExternal) {
          oCrossAppNav.toExternal({ target: { shellHash: "#" } });
        } else {
          this.getOwnerComponent().getRouter().navTo("search", {}, true);
        }
      }
    },

    /**
     * Convenience: get i18n resource bundle.
     */
    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    },

    /**
     * Convenience: get router.
     */
    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    }
  });
});
