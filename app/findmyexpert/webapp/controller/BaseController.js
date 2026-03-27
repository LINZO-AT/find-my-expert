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
      var sPreviousHash = History.getInstance().getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        // No history — navigate to FLP home if available, else to search
        var oFLP = this._getFLPContainer();
        if (oFLP) {
          var oCrossAppNav = oFLP.getService("CrossApplicationNavigation");
          if (oCrossAppNav && oCrossAppNav.toExternal) {
            oCrossAppNav.toExternal({ target: { shellHash: "#" } });
            return;
          }
        }
        this.getOwnerComponent().getRouter().navTo("search", {}, true);
      }
    },

    /**
     * Get the FLP ushell Container safely without global access.
     * @returns {object|null} The ushell Container or null
     */
    _getFLPContainer: function () {
      try {
        var oContainer = null;
        sap.ui.require(["sap/ushell/Container"], function (Container) {
          oContainer = Container;
        });
        return oContainer;
      } catch (e) {
        return null;
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