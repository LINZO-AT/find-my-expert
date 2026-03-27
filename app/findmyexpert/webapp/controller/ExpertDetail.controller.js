sap.ui.define([
  "com/sap/austria/findmyexpert/controller/BaseController"
], function (BaseController) {
  "use strict";

  var ROLE_LABELS = {
    TOPIC_OWNER:              "Topic Owner",
    SOLUTIONING_ARCH:         "Solutioning Architect",
    THEMEN_LEAD:              "Themen Lead",
    SERVICE_SELLER:           "Service Seller",
    REALIZATION_LEAD:         "Realization Lead",
    REALIZATION_CONSULTANT:   "Realization Consultant",
    PROJECT_MANAGEMENT:       "Project Management",
    OTHER_CONTACT_AT:         "Other Contact (AT)",
    OTHER_CONTACT_NON_AT:     "Other Contact"
  };

  return BaseController.extend("com.sap.austria.findmyexpert.controller.ExpertDetail", {

    onInit: function () {
      this._oRouter = this.getRouter();
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

    formatRoleLabel: function(sRole) {
      return ROLE_LABELS[sRole] || sRole || "";
    },

    onNavBack: function () {
      BaseController.prototype.onNavBack.apply(this, arguments);
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
