sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device",
  "com/sap/austria/findmyexpert/model/models"
], function(UIComponent, Device, models) {
  "use strict";

  return UIComponent.extend("com.sap.austria.findmyexpert.Component", {

    metadata: {
      manifest: "json"
    },

    init: function() {
      UIComponent.prototype.init.apply(this, arguments);

      this.setModel(models.createDeviceModel(), "device");

      // Initialize user model — load roles from backend
      const oUserModel = models.createUserModel();
      this.setModel(oUserModel, "userModel");

      this._loadUserInfo(oUserModel);

      this.getRouter().initialize();
    },

    _loadUserInfo: function(oUserModel) {
      const oCatalogModel = this.getModel();
      if (!oCatalogModel) return;

      try {
        const oContext = oCatalogModel.bindContext("/userInfo(...)");
        oContext.execute().then(() => {
          const oResult = oContext.getBoundContext().getObject();
          if (oResult) {
            oUserModel.setData({
              isAdmin: oResult.isAdmin === true,
              roles: oResult.roles || []
            });
          }
        }).catch(err => {
          console.warn("Could not load user info:", err.message);
        });
      } catch (err) {
        console.warn("userInfo binding failed:", err.message);
      }
    }
  });
});
