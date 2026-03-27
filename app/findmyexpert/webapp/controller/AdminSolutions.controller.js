sap.ui.define([
  "com/sap/austria/findmyexpert/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return BaseController.extend("com.sap.austria.findmyexpert.controller.AdminSolutions", {

    onInit: function () {
      this._oRouter = this.getRouter();

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

        // Use direct OData fetch for reliable result
        const oModel = this.getView().getModel("admin");
        const sUrl = oModel.sServiceUrl + "Solutions?$filter=topic_ID eq '" + sTopicId + "'&$orderby=name";
        fetch(sUrl, { headers: { "Accept": "application/json" } })
          .then(r => r.json())
          .then(data => {
            const aSolutions = (data.value || []).map(s => ({
              ID: s.ID,
              name: s.name,
              description: s.description || "",
              topic_ID: s.topic_ID
            }));
            this.getView().getModel("viewModel").setProperty("/solutions", aSolutions);
          })
          .catch(err => {
            console.error("Load solutions failed:", err.message);
          });
      } catch (err) {
        console.error("TopicSelect error:", err.message);
      }
    },

    onAddTopic: function() {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      try {
        const oModel = this.getView().getModel("admin");
        const oListBinding = oModel.bindList("/Topics");
        oListBinding.create({ name: oBundle.getText("adminSolutionsNewTopicName"), description: "" });
      } catch (err) {
        MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
      }
    },

    onAddSolution: function() {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      if (!this._selectedTopicId) {
        MessageToast.show(oBundle.getText("adminSolutionsSelectTopicFirst"));
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
            MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
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

    onNavBack: function () {
      BaseController.prototype.onNavBack.apply(this, arguments);
    }
  });
});
