sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function(Controller, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("com.sap.austria.findmyexpert.controller.AdminSolutions", {

    onInit: function() {
      this._oRouter = this.getOwnerComponent().getRouter();

      const oViewModel = new JSONModel({ solutions: [] });
      this.getView().setModel(oViewModel, "viewModel");
    },

    onTopicSelect: function(oEvent) {
      try {
        const oItem = oEvent.getParameter("listItem");
        const oCtx = oItem.getBindingContext("admin");
        if (!oCtx) return;
        const sTopicId = oCtx.getProperty("ID");
        this._selectedTopicId = sTopicId;

        const oModel = this.getView().getModel("admin");
        const oBinding = oModel.bindList(
          "/Solutions",
          null, null,
          [new sap.ui.model.Filter("topic_ID", sap.ui.model.FilterOperator.EQ, sTopicId)],
          { $orderby: "name" }
        );

        oBinding.requestContexts().then(aCtxs => {
          const aSolutions = aCtxs.map(c => c.getObject());
          this.getView().getModel("viewModel").setProperty("/solutions", aSolutions);
        }).catch(err => {
          console.error("Load solutions failed:", err.message);
        });
      } catch (err) {
        console.error("TopicSelect error:", err.message);
      }
    },

    onAddTopic: function() {
      try {
        const oModel = this.getView().getModel("admin");
        const oListBinding = oModel.bindList("/Topics");
        oListBinding.create({ name: "Neues Thema", description: "" });
      } catch (err) {
        MessageBox.error("Fehler: " + err.message);
      }
    },

    onAddSolution: function() {
      if (!this._selectedTopicId) {
        MessageToast.show("Bitte zuerst ein Thema auswählen.");
        return;
      }
      const oVM = this.getView().getModel("viewModel");
      const aSolutions = oVM.getProperty("/solutions") || [];
      aSolutions.push({ name: "", description: "", topic_ID: this._selectedTopicId, _isNew: true });
      oVM.setProperty("/solutions", aSolutions);
    },

    onDeleteSolution: function(oEvent) {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      MessageBox.confirm(oBundle.getText("adminSolutionsDeleteConfirm"), {
        onClose: (sAction) => {
          if (sAction !== MessageBox.Action.OK) return;
          try {
            const oItem = oEvent.getSource().getParent().getParent();
            const oTable = this.byId("solutionTable");
            const iIdx = oTable.indexOfItem(oItem);
            const oVM = this.getView().getModel("viewModel");
            const aSolutions = oVM.getProperty("/solutions");
            aSolutions.splice(iIdx, 1);
            oVM.setProperty("/solutions", [...aSolutions]);
          } catch (err) {
            MessageBox.error("Fehler: " + err.message);
          }
        }
      });
    },

    onSave: function() {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      try {
        const oModel = this.getView().getModel("admin");
        oModel.submitBatch("$auto").then(() => {
          MessageToast.show(oBundle.getText("adminSolutionsSaveSuccess"));
        }).catch(err => {
          MessageBox.error(oBundle.getText("adminSolutionsSaveError", [err.message]));
        });
      } catch (err) {
        MessageBox.error("Fehler: " + err.message);
      }
    },

    onNavBack: function() {
      this._oRouter.navTo("expertList");
    }
  });
});
