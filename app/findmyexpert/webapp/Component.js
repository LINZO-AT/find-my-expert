sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  "use strict";

  return UIComponent.extend("com.sap.austria.findmyexpert.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      // userModel — tracks auth state from backend
      var oUserModel = new JSONModel({
        isAdmin:  false,
        userName: "",
        loaded:   false
      });
      this.setModel(oUserModel, "userModel");

      this.getRouter().initialize();
      this._loadUserInfo();
    },

    /**
     * Loads current user info from CAP userInfo() function.
     *
     * DEV (mocked auth, no XSUAA):
     *   Sends Basic Auth "anonymous:" so CAP mocked auth grants all roles.
     *   userInfo() returns { isAdmin: true, userName: "Dev/Admin" }.
     *   No login dialog needed — everyone is Admin in DEV.
     *
     * PROD (XSUAA on BTP / Build Workzone):
     *   Browser sends XSUAA JWT automatically (cookie/session).
     *   Roles come from role collection FindMyExpert_Admin / FindMyExpert_Viewer.
     *   No Basic Auth header needed or sent.
     */
    _loadUserInfo: function () {
      var oUserModel = this.getModel("userModel");
      var oComponent = this;

      var sDevAuth = "Basic " + btoa("anonymous:");

      // Step 1: Call userInfo() — works without auth (CatalogService is public)
      fetch("/api/catalog/userInfo()", {
        credentials: "same-origin",
        headers: { "Accept": "application/json" }
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (oData) {
        if (oData.isAdmin) {
          // PROD: XSUAA authenticated user with Admin role
          oUserModel.setData({ isAdmin: true, userName: oData.userName || "", loaded: true });
          return;
        }

        if (oData.userName && oData.userName !== "Dev/Admin") {
          // PROD: authenticated user, but Viewer role only
          oUserModel.setData({ isAdmin: false, userName: oData.userName, loaded: true });
          return;
        }

        // DEV mocked auth: anonymous user → retry with "anonymous:" credentials
        // to get Admin role from mocked user config
        return fetch("/api/catalog/userInfo()", {
          headers: { "Accept": "application/json", "Authorization": sDevAuth }
        })
        .then(function (r2) { return r2.json(); })
        .then(function (oData2) {
          if (oData2.isAdmin) {
            // DEV Admin: inject auth header into OData models so AdminService works
            var oCatalogModel = oComponent.getModel();
            var oAdminModel   = oComponent.getModel("admin");
            if (oCatalogModel && oCatalogModel.changeHttpHeaders) {
              oCatalogModel.changeHttpHeaders({ "Authorization": sDevAuth });
            }
            if (oAdminModel && oAdminModel.changeHttpHeaders) {
              oAdminModel.changeHttpHeaders({ "Authorization": sDevAuth });
            }
          }
          oUserModel.setData({
            isAdmin:  !!oData2.isAdmin,
            userName: oData2.userName || "",
            loaded:   true
          });
        });
      })
      .catch(function (err) {
        console.warn("[FindMyExpert] userInfo failed:", err.message);
        oUserModel.setData({ isAdmin: false, userName: "", loaded: true });
      });
    }
  });
});
