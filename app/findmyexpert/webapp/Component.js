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
      // Call parent init (sets up models from manifest, initializes router)
      UIComponent.prototype.init.apply(this, arguments);

      // Create userModel for login/role state
      var oUserModel = new JSONModel({
        isAdmin: false,
        userName: ""
      });
      this.setModel(oUserModel, "userModel");

      // Initialize routing
      this.getRouter().initialize();

      // Try to load user info (anonymous by default)
      this._loadUserInfo();
    },

    _loadUserInfo: function () {
      var that = this;
      fetch("/api/catalog/userInfo()", {
        headers: { "Accept": "application/json" }
      }).then(function (r) {
        if (!r.ok) { throw new Error("HTTP " + r.status); }
        return r.json();
      }).then(function (oData) {
        var oUserModel = that.getModel("userModel");
        oUserModel.setData({
          isAdmin: oData.isAdmin || false,
          userName: oData.userName || ""
        });
      }).catch(function () {
        // Anonymous / no auth — default to viewer
        var oUserModel = that.getModel("userModel");
        oUserModel.setData({
          isAdmin: false,
          userName: ""
        });
      });
    }
  });
});