sap.ui.define([
  "com/sap/austria/findmyexpert/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return BaseController.extend("com.sap.austria.findmyexpert.controller.AdminExpert", {

    onInit: function () {
      this._oRouter = this.getRouter();
      this._oRouter.getRoute("adminExpert").attachPatternMatched(this._onRouteMatched, this);
      this._oRouter.getRoute("adminNew").attachPatternMatched(this._onNewExpert, this);
      this._bDirty = false;

      const oViewModel = new JSONModel({
        pageTitle: "Neuer Experte",
        expert: { firstName: "", lastName: "", email: "", location: "AT" },
        assignments: []
      });
      this.getView().setModel(oViewModel, "viewModel");
    },

    _onRouteMatched: function(oEvent) {
      try {
        const sExpertId = decodeURIComponent(oEvent.getParameter("arguments").expertId);
        this._loadExpert(sExpertId);
      } catch (err) {
        console.error("AdminExpert route error:", err.message);
      }
    },

    _onNewExpert: function() {
      const oVM = this.getView().getModel("viewModel");
      const oBundle = this.getView().getModel("i18n")?.getResourceBundle();
      oVM.setData({
        pageTitle: oBundle ? oBundle.getText("adminExpertTitleNew") : "Neuer Experte",
        expert: { firstName: "", lastName: "", email: "", location: "AT" },
        assignments: []
      });
      this._sExpertId = null;
      this._bDirty = false;
    },

    _loadExpert: function(sExpertId) {
      try {
        this._sExpertId = sExpertId;
        const oModel = this.getView().getModel("admin");
        const oCtx = oModel.bindContext(
          "/Experts('" + sExpertId + "')",
          null,
          { $expand: "roles($expand=solution)" }
        );
        oCtx.requestObject().then(oData => {
          const oVM = this.getView().getModel("viewModel");
          const oBundle2 = this.getView().getModel("i18n")?.getResourceBundle();
          oVM.setProperty("/pageTitle", oBundle2 ? oBundle2.getText("adminExpertTitleEdit") : "Experte bearbeiten");
          oVM.setProperty("/expert", {
            firstName: oData.firstName,
            lastName: oData.lastName,
            email: oData.email,
            location: oData.location
          });
          oVM.setProperty("/assignments", (oData.roles || []).map(r => ({
            ID: r.ID,
            solution_ID: r.solution_ID || r.solution?.ID,
            role: r.role,
            canPresent5M: r.canPresent5M,
            canPresent30M: r.canPresent30M,
            canPresent2H: r.canPresent2H,
            canPresentDemo: r.canPresentDemo,
            notes: r.notes || ""
          })));
        }).catch(err => {
          console.error("Load expert failed:", err.message);
        });
      } catch (err) {
        console.error("_loadExpert error:", err.message);
      }
    },

    onAddAssignment: function() {
      const oVM = this.getView().getModel("viewModel");
      const aAssignments = oVM.getProperty("/assignments") || [];
      aAssignments.push({
        solution_ID: "",
        role: "REALIZATION_CONSULTANT",
        canPresent5M: false,
        canPresent30M: false,
        canPresent2H: false,
        canPresentDemo: false,
        notes: ""
      });
      oVM.setProperty("/assignments", aAssignments);
      this._bDirty = true;
    },

    onDeleteAssignment: function(oEvent) {
      const oItem = oEvent.getSource().getParent().getParent();
      const oTable = this.byId("assignmentsTable");
      const iIdx = oTable.indexOfItem(oItem);
      const oVM = this.getView().getModel("viewModel");
      const aAssignments = oVM.getProperty("/assignments");
      aAssignments.splice(iIdx, 1);
      oVM.setProperty("/assignments", aAssignments);
      this._bDirty = true;
    },

    onSave: function() {
      try {
        const oVM = this.getView().getModel("viewModel");
        const oExpert = oVM.getProperty("/expert");
        const aAssignments = oVM.getProperty("/assignments");

        // Validate
        if (!oExpert.firstName?.trim() || !oExpert.lastName?.trim()) {
          MessageBox.error("Vorname und Nachname sind Pflichtfelder.");
          return;
        }
        if (oExpert.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oExpert.email)) {
          MessageBox.error("Ungültige E-Mail-Adresse.");
          return;
        }

        const oModel = this.getView().getModel("admin");
        const oBundle = this.getView().getModel("i18n")?.getResourceBundle();

        let oPromise;
        if (this._sExpertId) {
          // Update existing
          const oCtx = oModel.bindContext("/Experts('" + this._sExpertId + "')");
          oCtx.setProperty("firstName", oExpert.firstName);
          oCtx.setProperty("lastName", oExpert.lastName);
          oCtx.setProperty("email", oExpert.email);
          oCtx.setProperty("location", oExpert.location);
          oPromise = oModel.submitBatch("$auto");
        } else {
          // Create new
          const oListBinding = oModel.bindList("/Experts");
          const oNewCtx = oListBinding.create(oExpert);
          oPromise = oNewCtx.created();
        }

        oPromise.then(() => {
          MessageToast.show(oBundle.getText("adminExpertSaveSuccess"));
          this._bDirty = false;
          this._oRouter.navTo("expertList");
        }).catch(err => {
          MessageBox.error(oBundle.getText("adminExpertSaveError", [err.message]));
        });
      } catch (err) {
        MessageBox.error("Fehler: " + err.message);
      }
    },

    onCancel: function() {
      const oBundle = this.getView().getModel("i18n")?.getResourceBundle();
      if (this._bDirty) {
        MessageBox.confirm(oBundle.getText("adminExpertCancelConfirm"), {
          onClose: (sAction) => {
            if (sAction === MessageBox.Action.OK) {
              this._oRouter.navTo("expertList");
            }
          }
        });
      } else {
        this._oRouter.navTo("expertList");
      }
    },

    onNavBack: function () {
      this.onCancel();
    }
  });
});
