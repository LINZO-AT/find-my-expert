sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  "use strict";

  // DEV: Basic Auth header for mocked "anonymous" user with Admin role.
  // This is only active when CAP mocked auth is used (not XSUAA).
  var DEV_AUTH = "Basic " + btoa("anonymous:");

  return UIComponent.extend("com.sap.austria.findmyexpert.Component", {
    metadata: { manifest: "json" },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      var oUserModel = new JSONModel({ isAdmin: false, userName: "", loaded: false });
      this.setModel(oUserModel, "userModel");

      // Synchronously pre-inject DEV auth header into both OData models
      // BEFORE router.initialize() fires — prevents browser Basic-Auth popups
      // when Admin views (AdminSolutions, AdminExpert) are loaded directly.
      // In PROD (XSUAA), _loadUserInfo will detect the XSUAA token and clear this.
      this._injectDevAuth();

      this.getRouter().initialize();

      // Async: verify auth mode and update userModel accordingly
      this._loadUserInfo();
    },

    /**
     * Pre-injects DEV auth header into both OData models synchronously.
     * Prevents 401/browser-popup on Admin views loaded before userInfo resolves.
     */
    _injectDevAuth: function () {
      var oCatalog = this.getModel();
      var oAdmin   = this.getModel("admin");
      if (oCatalog && oCatalog.changeHttpHeaders) {
        oCatalog.changeHttpHeaders({ "Authorization": DEV_AUTH });
      }
      if (oAdmin && oAdmin.changeHttpHeaders) {
        oAdmin.changeHttpHeaders({ "Authorization": DEV_AUTH });
      }
    },

    /**
     * Removes DEV auth header from both OData models (used in PROD/XSUAA).
     */
    _clearDevAuth: function () {
      var oCatalog = this.getModel();
      var oAdmin   = this.getModel("admin");
      if (oCatalog && oCatalog.changeHttpHeaders) {
        oCatalog.changeHttpHeaders({ "Authorization": undefined });
      }
      if (oAdmin && oAdmin.changeHttpHeaders) {
        oAdmin.changeHttpHeaders({ "Authorization": undefined });
      }
    },

    /**
     * Loads current user info from CAP userInfo() function.
     *
     * DEV (mocked auth, no XSUAA):
     *   DEV_AUTH header already injected → userInfo() returns isAdmin:true.
     *   Header stays in place. All Admin views work without popups.
     *
     * PROD (XSUAA on BTP / Build Workzone):
     *   XSUAA JWT is sent automatically via credentials:same-origin.
     *   userInfo() returns isAdmin based on XSUAA scope.
     *   DEV_AUTH header is cleared so it doesn't interfere.
     */
    _loadUserInfo: function () {
      var oUserModel  = this.getModel("userModel");
      var that        = this;

      fetch("/api/catalog/userInfo()", {
        credentials: "same-origin",
        headers: {
          "Accept":        "application/json",
          "Authorization": DEV_AUTH  // also covers DEV path on first call
        }
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (oData) {
        var bDevMode = oData.userName === "Dev/Admin";

        if (!bDevMode) {
          // PROD: XSUAA user — remove DEV header, let XSUAA handle auth
          that._clearDevAuth();
        }

        oUserModel.setData({
          isAdmin:  !!oData.isAdmin,
          userName: oData.userName || "",
          loaded:   true
        });
      })
      .catch(function (err) {
        console.warn("[FindMyExpert] userInfo failed:", err.message);
        // Keep DEV header in place as fallback
        oUserModel.setData({ isAdmin: false, userName: "", loaded: true });
      });
    }
  });
});
