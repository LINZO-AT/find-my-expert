sap.ui.define([
  "com/sap/austria/findmyexpert/controller/BaseController",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (BaseController, Filter, FilterOperator, MessageBox, MessageToast) {
  "use strict";

  return BaseController.extend("com.sap.austria.findmyexpert.controller.ExpertList", {

    onInit: function () {
      this._oRouter = this.getRouter();
    },

    formatSolutionCount: function(aRoles, sPattern) {
      const iCount = Array.isArray(aRoles) ? aRoles.length : 0;
      if (sPattern) { return sPattern.replace("{0}", iCount); }
      return iCount + " Solutions";
    },

    formatRoleCount: function(aRoles) {
      const iCount = Array.isArray(aRoles) ? aRoles.length : 0;
      try {
        const sPattern = this.getView().getModel("i18n").getResourceBundle().getText("expertListSolutions", [iCount]);
        return sPattern;
      } catch(e) {
        return iCount + " Solutions";
      }
    },

    onNavToSearch: function () {
      this._oRouter.navTo("search");
    },

    onAddExpert: function () {
      this._oRouter.navTo("adminNew");
    },

    onExpertPress: function(oEvent) {
      const oItem = oEvent.getSource();
      const oCtx = oItem.getBindingContext();
      if (!oCtx) return;
      this._oRouter.navTo("expertDetail", { expertId: encodeURIComponent(oCtx.getProperty("ID")) });
    },

    onEditExpert: function(oEvent) {
      const oBtn = oEvent.getSource();
      const oCtx = oBtn.getParent().getParent().getBindingContext();
      if (!oCtx) return;
      this._oRouter.navTo("adminExpert", { expertId: encodeURIComponent(oCtx.getProperty("ID")) });
    },

    onDeleteExpert: function(oEvent) {
      const oBtn = oEvent.getSource();
      const oCtx = oBtn.getParent().getParent().getBindingContext();
      if (!oCtx) return;
      const sName = oCtx.getProperty("firstName") + " " + oCtx.getProperty("lastName");
      const oBundle = this.getView().getModel("i18n").getResourceBundle();

      MessageBox.confirm(
        oBundle.getText("expertListDeleteConfirm", [sName]),
        {
          title: oBundle.getText("expertListDeleteTitle"),
          onClose: (sAction) => {
            if (sAction === MessageBox.Action.OK) {
              try {
                oCtx.delete().then(() => {
                  MessageToast.show(oBundle.getText("expertListDeletedMsg", [sName]));
                }).catch(err => {
                  MessageBox.error(oBundle.getText("expertListDeleteError", [err.message]));
                });
              } catch (err) {
                MessageBox.error(oBundle.getText("adminExpertGenericError", [err.message]));
              }
            }
          }
        }
      );
    },

    onFilterChange: function() {
      this._applyFilters();
    },

    onResetFilters: function() {
      this.byId("topicFilter").setSelectedKey("");
      this.byId("locationFilter").setSelectedKey("");
      this.byId("nameSearch").setValue("");
      this._applyFilters();
    },

    _applyFilters: function() {
      const oTable = this.byId("expertTable");
      if (!oTable) return;
      const oBinding = oTable.getBinding("items");
      if (!oBinding) return;

      const aFilters = [];

      const sLocation = this.byId("locationFilter").getSelectedKey();
      if (sLocation) {
        aFilters.push(new Filter("location", FilterOperator.EQ, sLocation));
      }

      const sName = this.byId("nameSearch").getValue().trim();
      if (sName) {
        aFilters.push(new Filter({
          filters: [
            new Filter("firstName", FilterOperator.Contains, sName),
            new Filter("lastName", FilterOperator.Contains, sName)
          ],
          and: false
        }));
      }

      oBinding.filter(aFilters);
    }
  });
});
