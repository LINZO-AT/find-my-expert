sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function(Controller) {
  "use strict";

  return Controller.extend("com.sap.austria.findmyexpert.controller.ExpertDetail", {

    onInit: function() {
      this._oRouter = this.getOwnerComponent().getRouter();
      this._oRouter.getRoute("expertDetail").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function(oEvent) {
      try {
        const sExpertId = decodeURIComponent(oEvent.getParameter("arguments").expertId);
        const oModel = this.getView().getModel();
        const oCtx = oModel.bindContext(
          "/Experts('" + sExpertId + "')",
          null,
          { $expand: "roles($expand=solution($expand=topic))" }
        );
        this.getView().setBindingContext(oCtx.getBoundContext());
      } catch (err) {
        console.error("ExpertDetail route error:", err.message);
      }
    },

    onNavBack: function() {
      this._oRouter.navTo("expertList");
    },

    onEditExpert: function() {
      try {
        const oCtx = this.getView().getBindingContext();
        if (!oCtx) return;
        const sId = oCtx.getProperty("ID");
        this._oRouter.navTo("adminExpert", { expertId: encodeURIComponent(sId) });
      } catch (err) {
        console.error("Edit nav error:", err.message);
      }
    }
  });
});
