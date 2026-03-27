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

      // Device model
      this.setModel(models.createDeviceModel(), "device");

      // User model — populated after FLP shell is ready
      const oUserModel = models.createUserModel();
      this.setModel(oUserModel, "userModel");

      this._loadUserInfo(oUserModel);

      // Initialize router
      this.getRouter().initialize();
    },

    /**
     * Load user info — try FLP UserInfo service first, fall back to backend.
     */
    _loadUserInfo: function (oUserModel) {
      try {
        // FLP UserInfo service (available when running inside Fiori Launchpad)
        const oContainer = sap.ushell && sap.ushell.Container;
        if (oContainer) {
          const oUserInfoService = oContainer.getService("UserInfo");
          const aRoles = oUserInfoService.getRoles ? oUserInfoService.getRoles() : [];
          const bAdmin = Array.isArray(aRoles)
            ? aRoles.some(r => r === "ExpertAdmin")
            : false;
          oUserModel.setData({ isAdmin: bAdmin, roles: aRoles || [] });
          return;
        }
      } catch (e) {
        // FLP not available — fall back to backend
      }

      // Fallback: call backend /userInfo function
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

    /**
     * FLP lifecycle: called when app is destroyed via back-navigation in FLP.
     */
    destroy: function () {
      UIComponent.prototype.destroy.apply(this, arguments);
    },

    /**
     * Returns the router instance.
     */
    getRouter: function () {
      return UIComponent.prototype.getRouter.apply(this, arguments);
    }
  });
});
