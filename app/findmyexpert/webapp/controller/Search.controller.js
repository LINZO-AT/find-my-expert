sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/Fragment",
  "sap/m/library"
], function(Controller, MessageToast, MessageBox, Fragment, mobileLibrary) {
  "use strict";

  return Controller.extend("com.sap.austria.findmyexpert.controller.Search", {

    onInit: function() {
      this._oRouter = this.getOwnerComponent().getRouter();
    },

    onSearch: function() {
      const oSearchField = this.byId("searchField");
      const sQuery = oSearchField.getValue().trim();
      if (!sQuery) {
        MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("searchEmptyTitle"));
        return;
      }
      this._runSearch(sQuery);
    },

    _runSearch: function(sQuery) {
      const oView = this.getView();
      const oBusy = oView.byId("searchBusy");
      const oEmpty = oView.byId("emptyState");
      const oResults = oView.byId("resultsContainer");
      const oMockBanner = oView.byId("mockModeBanner");

      oBusy.setVisible(true);
      oEmpty.setVisible(false);
      oResults.setVisible(false);
      oMockBanner.setVisible(false);

      try {
        const oModel = oView.getModel();
        const oActionBinding = oModel.bindContext("/searchExperts(...)");
        oActionBinding.setParameter("query", sQuery);

        oActionBinding.execute().then(() => {
          try {
            const oResult = oActionBinding.getBoundContext().getObject();
            const aResults = oResult?.value || [];

            oBusy.setVisible(false);
            oResults.removeAllItems();

            if (aResults.length === 0) {
              oEmpty.setVisible(true);
              return;
            }

            const bMock = aResults.some(r => r.isMockMode);
            oMockBanner.setVisible(bMock);

            aResults.forEach(oExpert => {
              oResults.addItem(this._createExpertCard(oExpert));
            });

            oResults.setVisible(true);
          } catch (err) {
            oBusy.setVisible(false);
            MessageBox.error("Fehler beim Verarbeiten der Ergebnisse: " + err.message);
          }
        }).catch(err => {
          oBusy.setVisible(false);
          MessageBox.error("Suche fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
        });
      } catch (err) {
        oBusy.setVisible(false);
        MessageBox.error("Suchfehler: " + err.message);
      }
    },

    _createExpertCard: function(oExpert) {
      const oCard = new sap.f.Card({
        width: "360px"
      });

      const oBundle = this.getView().getModel("i18n").getResourceBundle();

      // Card Header
      oCard.setHeader(new sap.f.cards.Header({
        title: oExpert.firstName + " " + oExpert.lastName,
        subtitle: oExpert.topicName + " › " + oExpert.solutionName,
        statusText: oExpert.location
      }));

      // Card Content via VBox
      const oVBox = new sap.m.VBox({ class: "sapUiSmallMargin" });

      // Role status
      const sRoleState = this._getRoleState(oExpert.role);
      oVBox.addItem(new sap.m.ObjectStatus({
        text: oExpert.roleLabel || oExpert.role,
        state: sRoleState
      }));

      // Presentation icons
      const oIconBar = new sap.m.HBox({ class: "sapUiTinyMarginTop" });
      const aCaps = [
        { cap: oExpert.canPresent5M,   icon: "sap-icon://time-entry-request", tooltip: oBundle.getText("tooltip_5M")   },
        { cap: oExpert.canPresent30M,  icon: "sap-icon://calendar",            tooltip: oBundle.getText("tooltip_30M")  },
        { cap: oExpert.canPresent2H,   icon: "sap-icon://education",           tooltip: oBundle.getText("tooltip_2H")   },
        { cap: oExpert.canPresentDemo, icon: "sap-icon://show",                tooltip: oBundle.getText("tooltip_Demo") }
      ];

      aCaps.forEach(({ cap, icon, tooltip }) => {
        oIconBar.addItem(new sap.ui.core.Icon({
          src: icon,
          tooltip: tooltip,
          color: cap ? "#107e3e" : "#d9d9d9",
          class: "sapUiTinyMarginEnd"
        }));
      });
      oVBox.addItem(oIconBar);

      // Score
      oVBox.addItem(new sap.m.ProgressIndicator({
        percentValue: oExpert.score || 0,
        displayValue: oBundle.getText("scoreLabel", [oExpert.score || 0]),
        class: "sapUiTinyMarginTop",
        state: oExpert.score >= 70 ? "Success" : oExpert.score >= 40 ? "Warning" : "None"
      }));

      // AI reasoning
      if (oExpert.reasoning) {
        oVBox.addItem(new sap.m.ExpandableText({
          text: oExpert.reasoning,
          maxCharacters: 80,
          class: "sapUiTinyMarginTop"
        }));
      }

      oCard.setContent(oVBox);
      return oCard;
    },

    _getRoleState: function(sRole) {
      switch (sRole) {
        case "TOPIC_OWNER":         return "Error";
        case "SOLUTIONING_ARCH":    return "Warning";
        case "THEMEN_LEAD":         return "Warning";
        case "SERVICE_SELLER":      return "Success";
        case "REALIZATION_LEAD":    return "Information";
        default:                    return "None";
      }
    },

    onNavToExpertList: function() {
      this._oRouter.navTo("expertList");
    }
  });
});
