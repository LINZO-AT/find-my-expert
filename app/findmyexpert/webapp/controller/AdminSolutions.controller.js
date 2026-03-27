sap.ui.define([
  "com/sap/austria/findmyexpert/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/Input",
  "sap/m/TextArea",
  "sap/m/Label",
  "sap/m/VBox",
  "sap/ui/layout/form/SimpleForm"
], function (BaseController, JSONModel, MessageBox, MessageToast, Dialog, Button, Input, TextArea, Label, VBox, SimpleForm) {
  "use strict";

  return BaseController.extend("com.sap.austria.findmyexpert.controller.AdminSolutions", {

    onInit: function () {
      this._oRouter = this.getRouter();
      var oViewModel = new JSONModel({
        solutions: [],
        topicSelected: false
      });
      this.getView().setModel(oViewModel, "viewModel");
      this._selectedTopicId = null;
    },

    /* ========================================
     *  TOPIC SELECT
     * ======================================== */

    onTopicSelect: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      var oCtx = oItem ? oItem.getBindingContext("admin") : null;
      if (!oCtx) {
        return;
      }
      var sTopicId = oCtx.getProperty("ID");
      this._selectedTopicId = sTopicId;
      this.getView().getModel("viewModel").setProperty("/topicSelected", true);
      this._loadSolutions(sTopicId);
    },

    _loadSolutions: function (sTopicId) {
      var that = this;
      var sUrl = "/odata/v4/admin/Solutions?$filter=topic_ID eq '" + sTopicId + "'&$orderby=name";
      fetch(sUrl, { headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var aSolutions = (data.value || []).map(function (s) {
            return {
              ID: s.ID,
              name: s.name,
              description: s.description || "",
              topic_ID: s.topic_ID
            };
          });
          that.getView().getModel("viewModel").setProperty("/solutions", aSolutions);
        })
        .catch(function (err) {
          console.error("Load solutions failed:", err.message);
        });
    },

    /* ========================================
     *  TOPIC CRUD
     * ======================================== */

    onAddTopic: function () {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      this._openTopicDialog(oBundle.getText("adminSolutionsAddTopicTitle"), "", "", function (sName, sDesc) {
        this._createTopic(sName, sDesc);
      }.bind(this));
    },

    onEditTopic: function (oEvent) {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      var oCtx = oEvent.getSource().getBindingContext("admin");
      if (!oCtx) {
        return;
      }
      var sId = oCtx.getProperty("ID");
      var sName = oCtx.getProperty("name");
      var sDesc = oCtx.getProperty("description") || "";

      this._openTopicDialog(oBundle.getText("adminSolutionsEditTopicTitle"), sName, sDesc, function (sNewName, sNewDesc) {
        this._updateTopic(sId, sNewName, sNewDesc);
      }.bind(this));
    },

    onDeleteTopic: function (oEvent) {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      var oCtx = oEvent.getSource().getBindingContext("admin");
      if (!oCtx) {
        return;
      }
      var sId = oCtx.getProperty("ID");
      var sName = oCtx.getProperty("name");
      var that = this;

      MessageBox.confirm(
        oBundle.getText("adminSolutionsDeleteTopicConfirm", [sName]), {
          title: oBundle.getText("adminSolutionsDeleteTopicTitle"),
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              that._deleteTopic(sId);
            }
          }
        }
      );
    },

    _openTopicDialog: function (sTitle, sName, sDesc, fnSave) {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();

      var oNameInput = new Input({
        value: sName,
        placeholder: oBundle.getText("adminSolutionsTopicNamePlaceholder"),
        maxLength: 100,
        required: true
      });

      var oDescInput = new TextArea({
        value: sDesc,
        placeholder: oBundle.getText("adminSolutionsTopicDescPlaceholder"),
        maxLength: 500,
        rows: 3,
        width: "100%"
      });

      var oDialog = new Dialog({
        title: sTitle,
        contentWidth: "400px",
        type: "Message",
        content: [
          new SimpleForm({
            editable: true,
            layout: "ResponsiveGridLayout",
            labelSpanXL: 12,
            labelSpanL: 12,
            labelSpanM: 12,
            labelSpanS: 12,
            emptySpanXL: 0,
            emptySpanL: 0,
            emptySpanM: 0,
            emptySpanS: 0,
            columnsXL: 1,
            columnsL: 1,
            columnsM: 1,
            content: [
              new Label({ text: oBundle.getText("adminSolutionsTopicName"), required: true }),
              oNameInput,
              new Label({ text: oBundle.getText("adminSolutionsTopicDesc") }),
              oDescInput
            ]
          })
        ],
        beginButton: new Button({
          text: oBundle.getText("adminSolutionsSave"),
          type: "Emphasized",
          press: function () {
            var sVal = oNameInput.getValue().trim();
            if (!sVal) {
              oNameInput.setValueState("Error");
              oNameInput.setValueStateText(oBundle.getText("adminSolutionsFieldRequired"));
              return;
            }
            oNameInput.setValueState("None");
            fnSave(sVal, oDescInput.getValue().trim());
            oDialog.close();
          }
        }),
        endButton: new Button({
          text: oBundle.getText("adminExpertCancel"),
          press: function () {
            oDialog.close();
          }
        }),
        afterClose: function () {
          oDialog.destroy();
        }
      });

      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    _createTopic: function (sName, sDesc) {
      var that = this;
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      fetch("/odata/v4/admin/Topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ name: sName, description: sDesc })
      })
        .then(function (r) {
          if (!r.ok) {
            throw new Error("HTTP " + r.status);
          }
          return r.json();
        })
        .then(function () {
          MessageToast.show(oBundle.getText("adminSolutionsSaveSuccess"));
          that._refreshTopics();
        })
        .catch(function (err) {
          MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
        });
    },

    _updateTopic: function (sId, sName, sDesc) {
      var that = this;
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      fetch("/odata/v4/admin/Topics(" + sId + ")", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ name: sName, description: sDesc })
      })
        .then(function (r) {
          if (!r.ok) {
            throw new Error("HTTP " + r.status);
          }
          return r.json();
        })
        .then(function () {
          MessageToast.show(oBundle.getText("adminSolutionsSaveSuccess"));
          that._refreshTopics();
        })
        .catch(function (err) {
          MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
        });
    },

    _deleteTopic: function (sId) {
      var that = this;
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      fetch("/odata/v4/admin/Topics(" + sId + ")", {
        method: "DELETE",
        headers: { "Accept": "application/json" }
      })
        .then(function (r) {
          if (!r.ok) {
            throw new Error("HTTP " + r.status);
          }
          MessageToast.show(oBundle.getText("adminSolutionsDeleteSuccess"));
          that._selectedTopicId = null;
          that.getView().getModel("viewModel").setProperty("/topicSelected", false);
          that.getView().getModel("viewModel").setProperty("/solutions", []);
          that._refreshTopics();
        })
        .catch(function (err) {
          MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
        });
    },

    _refreshTopics: function () {
      var oListBinding = this.byId("topicList").getBinding("items");
      if (oListBinding) {
        oListBinding.refresh();
      }
    },

    /* ========================================
     *  SOLUTION CRUD
     * ======================================== */

    onAddSolution: function () {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      if (!this._selectedTopicId) {
        MessageToast.show(oBundle.getText("adminSolutionsSelectTopicFirst"));
        return;
      }
      this._openSolutionDialog(oBundle.getText("adminSolutionsAddSolutionTitle"), "", "", function (sName, sDesc) {
        this._createSolution(sName, sDesc);
      }.bind(this));
    },

    onEditSolution: function (oEvent) {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      var oCtx = oEvent.getSource().getBindingContext("viewModel");
      if (!oCtx) {
        return;
      }
      var oData = oCtx.getObject();

      this._openSolutionDialog(oBundle.getText("adminSolutionsEditSolutionTitle"), oData.name, oData.description || "", function (sNewName, sNewDesc) {
        this._updateSolution(oData.ID, sNewName, sNewDesc);
      }.bind(this));
    },

    onDeleteSolution: function (oEvent) {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      var oCtx = oEvent.getSource().getBindingContext("viewModel");
      if (!oCtx) {
        return;
      }
      var oData = oCtx.getObject();
      var that = this;

      MessageBox.confirm(
        oBundle.getText("adminSolutionsDeleteSolutionConfirm", [oData.name]), {
          title: oBundle.getText("adminSolutionsDeleteSolutionTitle"),
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              that._deleteSolution(oData.ID);
            }
          }
        }
      );
    },

    _openSolutionDialog: function (sTitle, sName, sDesc, fnSave) {
      var oBundle = this.getView().getModel("i18n").getResourceBundle();

      var oNameInput = new Input({
        value: sName,
        placeholder: oBundle.getText("adminSolutionsSolutionNamePlaceholder"),
        maxLength: 200,
        required: true
      });

      var oDescInput = new TextArea({
        value: sDesc,
        placeholder: oBundle.getText("adminSolutionsSolutionDescPlaceholder"),
        maxLength: 1000,
        rows: 4,
        width: "100%"
      });

      var oDialog = new Dialog({
        title: sTitle,
        contentWidth: "450px",
        type: "Message",
        content: [
          new SimpleForm({
            editable: true,
            layout: "ResponsiveGridLayout",
            labelSpanXL: 12,
            labelSpanL: 12,
            labelSpanM: 12,
            labelSpanS: 12,
            emptySpanXL: 0,
            emptySpanL: 0,
            emptySpanM: 0,
            emptySpanS: 0,
            columnsXL: 1,
            columnsL: 1,
            columnsM: 1,
            content: [
              new Label({ text: oBundle.getText("adminSolutionsSolutionName"), required: true }),
              oNameInput,
              new Label({ text: oBundle.getText("adminSolutionsSolutionDesc") }),
              oDescInput
            ]
          })
        ],
        beginButton: new Button({
          text: oBundle.getText("adminSolutionsSave"),
          type: "Emphasized",
          press: function () {
            var sVal = oNameInput.getValue().trim();
            if (!sVal) {
              oNameInput.setValueState("Error");
              oNameInput.setValueStateText(oBundle.getText("adminSolutionsFieldRequired"));
              return;
            }
            oNameInput.setValueState("None");
            fnSave(sVal, oDescInput.getValue().trim());
            oDialog.close();
          }
        }),
        endButton: new Button({
          text: oBundle.getText("adminExpertCancel"),
          press: function () {
            oDialog.close();
          }
        }),
        afterClose: function () {
          oDialog.destroy();
        }
      });

      this.getView().addDependent(oDialog);
      oDialog.open();
    },

    _createSolution: function (sName, sDesc) {
      var that = this;
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      fetch("/odata/v4/admin/Solutions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: sName,
          description: sDesc,
          topic_ID: this._selectedTopicId
        })
      })
        .then(function (r) {
          if (!r.ok) {
            throw new Error("HTTP " + r.status);
          }
          return r.json();
        })
        .then(function () {
          MessageToast.show(oBundle.getText("adminSolutionsSaveSuccess"));
          that._loadSolutions(that._selectedTopicId);
        })
        .catch(function (err) {
          MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
        });
    },

    _updateSolution: function (sId, sName, sDesc) {
      var that = this;
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      fetch("/odata/v4/admin/Solutions(" + sId + ")", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ name: sName, description: sDesc })
      })
        .then(function (r) {
          if (!r.ok) {
            throw new Error("HTTP " + r.status);
          }
          return r.json();
        })
        .then(function () {
          MessageToast.show(oBundle.getText("adminSolutionsSaveSuccess"));
          that._loadSolutions(that._selectedTopicId);
        })
        .catch(function (err) {
          MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
        });
    },

    _deleteSolution: function (sId) {
      var that = this;
      var oBundle = this.getView().getModel("i18n").getResourceBundle();
      fetch("/odata/v4/admin/Solutions(" + sId + ")", {
        method: "DELETE",
        headers: { "Accept": "application/json" }
      })
        .then(function (r) {
          if (!r.ok) {
            throw new Error("HTTP " + r.status);
          }
          MessageToast.show(oBundle.getText("adminSolutionsDeleteSuccess"));
          that._loadSolutions(that._selectedTopicId);
        })
        .catch(function (err) {
          MessageBox.error(oBundle.getText("adminSolutionsGenericError", [err.message]));
        });
    },

    /* ========================================
     *  NAVIGATION
     * ======================================== */

    onNavBack: function () {
      BaseController.prototype.onNavBack.apply(this, arguments);
    }
  });
});