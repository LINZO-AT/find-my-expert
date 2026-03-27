sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device",
  "com/sap/austria/findmyexpert/model/models"
], function (UIComponent, Device, models) {
  "use strict";

  return UIComponent.extend("com.sap.austria.findmyexpert.Component", {

    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(models.createDeviceModel(), "device");

      const oUserModel = models.createUserModel();
      this.setModel(oUserModel, "userModel");
      this._loadUserInfo(oUserModel);

      // Intent-based startup: detect before router.initialize() but navTo after
      const sAction = this._getStartupAction();

      this.getRouter().initialize();

      // Navigate to admin view if launched via manage intent
      if (sAction === "manage") {
        this.getRouter().navTo("adminSolutions", {}, true);
      }
    },

    /**
     * Parse the FLP startup action from the URL hash.
     * Returns "manage", "display" or null.
     */
    _getStartupAction: function () {
      try {
        const sHash = window.location.hash || "";
        // Hash format: #FindMyExpert-manage or #FindMyExpert-display
        const match = sHash.match(/#FindMyExpert-(\w+)/);
        return match ? match[1] : null;
      } catch (e) {
        return null;
      }
    },

    _loadUserInfo: function (oUserModel) {
      try {
        var oContainer = null;
        sap.ui.require(["sap/ushell/Container"], function (Container) {
          oContainer = Container;
        });
        if (oContainer && oContainer.getServiceAsync) {
          oContainer.getServiceAsync("UserInfo").then(function (oUserInfoService) {
            var aRoles = oUserInfoService.getRoles ? oUserInfoService.getRoles() : [];
            var bAdmin = Array.isArray(aRoles)
              ? aRoles.some(function (r) { return r === "ExpertAdmin"; })
              : false;
            oUserModel.setData({ isAdmin: bAdmin, roles: aRoles || [] });
          }).catch(function () {
            // UserInfo service not available
          });
          return;
        }
      } catch (e) {
        // FLP not available
      }

      try {
        const oCatalogModel = this.getModel();
        if (!oCatalogModel) return;
        const oCtx = oCatalogModel.bindContext("/userInfo(...)");
        oCtx.execute().then(function () {
          const oResult = oCtx.getBoundContext().getObject();
          if (oResult) {
            oUserModel.setData({
              isAdmin: oResult.isAdmin === true,
              roles: oResult.roles || []
            });
          }
        }).catch(function (err) {
          console.warn("userInfo fallback failed:", err.message);
        });
      } catch (err) {
        console.warn("userInfo binding failed:", err.message);
      }
    },

    destroy: function () {
      UIComponent.prototype.destroy.apply(this, arguments);
    },

    getRouter: function () {
      return UIComponent.prototype.getRouter.apply(this, arguments);
    }
  });
});
