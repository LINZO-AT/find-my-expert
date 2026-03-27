sap.ui.define([
  "com/sap/austria/findmyexpert/controller/BaseController",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/Avatar",
  "sap/f/Card",
  "sap/f/cards/Header",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/ObjectStatus",
  "sap/m/ProgressIndicator",
  "sap/ui/core/Icon",
  "sap/m/Button"
], function (BaseController, MessageToast, MessageBox, Avatar, Card, FCardHeader, VBox, HBox, ObjectStatus, ProgressIndicator, Icon, Button) {
  "use strict";

  return BaseController.extend("com.sap.austria.findmyexpert.controller.Search", {

    onInit: function () {
      this._oRouter = this.getRouter();
      this._aAllResults = [];
      this._iPageSize = 20;
      this._iCurrentPage = 0;
    },

    onSearch: function(oEvent) {
      const sQuery = (oEvent && oEvent.getParameter("query")) || this.byId("searchField").getValue().trim();
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
      const oTitle = oView.byId("resultsTitle");
      if (oTitle) oTitle.setVisible(false);

      try {
        const oModel = oView.getModel();
        const oActionBinding = oModel.bindContext("/searchExperts(...)");
        oActionBinding.setParameter("query", sQuery);

        const oBundle = oView.getModel("i18n").getResourceBundle();

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

            // Store all results, reset pagination
            this._aAllResults = aResults;
            this._iCurrentPage = 0;

            // Update title with result count
            const oBundle2 = oView.getModel("i18n").getResourceBundle();
            const sCountTitle = oBundle2.getText("searchResultsCount", [aResults.length]);
            const oTitle = oView.byId("resultsTitle");
            if (oTitle) oTitle.setText(sCountTitle).setVisible(true);

            // Render first page
            this._renderNextPage(oResults, oBundle2);
            oResults.setVisible(true);
          } catch (err) {
            oBusy.setVisible(false);
            MessageBox.error(oBundle.getText("searchResultError", [err.message]));
          }
        }).catch(err => {
          oBusy.setVisible(false);
          MessageBox.error(oBundle.getText("searchFailed", [err.message || ""]));
        });
      } catch (err) {
        oBusy.setVisible(false);
        MessageBox.error(oBundle.getText("searchError", [err.message]));
      }
    },

    _renderNextPage: function(oResults, oBundle) {
      const iStart = this._iCurrentPage * this._iPageSize;
      const iEnd   = iStart + this._iPageSize;
      const aPage  = this._aAllResults.slice(iStart, iEnd);

      // Remove old "Load More" button if present
      const aItems = oResults.getItems();
      const oLast = aItems[aItems.length - 1];
      if (oLast && oLast.isA && oLast.isA("sap.m.Button")) {
        oResults.removeItem(oLast);
        oLast.destroy();
      }

      aPage.forEach(oExpert => {
        oResults.addItem(this._createExpertCard(oExpert));
      });

      this._iCurrentPage++;

      // Add "Load More" button if there are more results
      if (iEnd < this._aAllResults.length) {
        const iRemaining = this._aAllResults.length - iEnd;
        const oBundle2 = oBundle || this.getView().getModel("i18n").getResourceBundle();
        const oLoadMore = new Button({
          text: oBundle2.getText ? oBundle2.getText("searchLoadMore", [iRemaining]) : ("Weitere laden (" + iRemaining + ")"),
          type: "Default",
          icon: "sap-icon://down",
          class: "sapUiMediumMarginTop sapUiMediumMarginBottom",
          press: () => {
            this._renderNextPage(oResults, oBundle2);
          }
        });
        // Full-width wrapper
        const oWrapper = new HBox({ justifyContent: "Center", width: "100%", class: "fmeLoadMoreWrapper" });
        oWrapper.addItem(oLoadMore);
        oResults.addItem(oWrapper);
      }
    },

    onLoadMore: function() {
      const oResults = this.getView().byId("resultsContainer");
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      this._renderNextPage(oResults, oBundle);
    },

    _createExpertCard: function(oExpert) {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      const sRoleState = this._getRoleState(oExpert.role);

      // Avatar initials (first letters of first + last name)
      const sInitials = ((oExpert.firstName || "?")[0] + (oExpert.lastName || "?")[0]).toUpperCase();
      const sAvatarColor = this._getAvatarColor(oExpert.role);

      // Card with fixed width — height controlled by CSS via uniform content zones
      const oCard = new Card({
        width: "300px",
        semanticRole: "ListItem",
        class: "fmeExpertCard sapUiSmallMarginEnd sapUiSmallMarginBottom"
      });

      // Header with avatar
      oCard.setHeader(new FCardHeader({
        title: oExpert.firstName + " " + oExpert.lastName,
        subtitle: (oExpert.topicName || "") + " › " + (oExpert.solutionName || ""),
        statusText: oExpert.location || "",
        avatar: new Avatar({
          initials: sInitials,
          backgroundColor: sAvatarColor,
          displaySize: "XS"
        })
      }));

      // Card content — fixed height via uniform VBox
      const oVBox = new VBox({
        class: "sapUiSmallMarginBeginEnd sapUiSmallMarginBottom fmeCardContent"
      });

      // 1) Role badge (always present, fixed height slot)
      oVBox.addItem(new ObjectStatus({
        text: oExpert.roleLabel || oExpert.role,
        state: sRoleState,
        inverted: sRoleState !== "None",
        class: "sapUiTinyMarginBottom fmeRoleBadge"
      }));

      // 2) Presentation capabilities row (fixed slot, hidden icons take no space)
      const aCaps = [
        { cap: oExpert.canPresent5M,   icon: "sap-icon://time-entry-request", tooltip: oBundle.getText("tooltip_5M")   },
        { cap: oExpert.canPresent30M,  icon: "sap-icon://calendar",            tooltip: oBundle.getText("tooltip_30M")  },
        { cap: oExpert.canPresent2H,   icon: "sap-icon://education",           tooltip: oBundle.getText("tooltip_2H")   },
        { cap: oExpert.canPresentDemo, icon: "sap-icon://show",                tooltip: oBundle.getText("tooltip_Demo") }
      ];
      const oIconBar = new HBox({ class: "sapUiTinyMarginBottom fmeCapRow", height: "1.5rem" });
      aCaps.forEach(({ cap, icon, tooltip }) => {
        oIconBar.addItem(new Icon({
          src: icon,
          tooltip: tooltip,
          color: cap ? "Positive" : "Default",
          size: "1rem",
          class: "sapUiSmallMarginEnd",
          visible: !!cap
        }));
      });
      // Placeholder text if no capabilities
      if (!aCaps.some(c => c.cap)) {
        oIconBar.addItem(new sap.m.Text({ text: "", class: "fmeCapPlaceholder" }));
      }
      oVBox.addItem(oIconBar);

      // 3) Relevance bar (always full width, score always shown)
      const iScore = oExpert.score || 0;
      const sState = iScore >= 70 ? "Success" : iScore >= 40 ? "Warning" : "None";
      oVBox.addItem(new ProgressIndicator({
        percentValue: iScore,
        displayValue: oBundle.getText("scoreLabel", [iScore]),
        state: sState,
        showValue: true,
        class: "fmeRelevanceBar"
      }));

      oCard.setContent(oVBox);

      // Navigate to detail on click
      oCard.attachPress(() => {
        this._oRouter.navTo("expertDetail", { expertId: encodeURIComponent(oExpert.expertId) });
      });

      return oCard;
    },

    _getRoleState: function(sRole) {
      switch (sRole) {
        case "TOPIC_OWNER":           return "Error";      // red — highest priority
        case "SOLUTIONING_ARCH":      return "Warning";    // orange
        case "THEMEN_LEAD":           return "Warning";    // orange
        case "SERVICE_SELLER":        return "Success";    // green
        case "REALIZATION_LEAD":      return "Information";// blue
        case "REALIZATION_CONSULTANT":return "Information";// blue
        case "PROJECT_MANAGEMENT":    return "None";
        default:                      return "None";
      }
    },

    _getAvatarColor: function(sRole) {
      // Consistent avatar colors by role tier
      switch (sRole) {
        case "TOPIC_OWNER":           return "Accent6"; // dark teal
        case "SOLUTIONING_ARCH":      return "Accent5"; // blue
        case "THEMEN_LEAD":           return "Accent5";
        case "SERVICE_SELLER":        return "Accent4"; // green
        case "REALIZATION_LEAD":      return "Accent3";
        case "REALIZATION_CONSULTANT":return "Accent3";
        default:                      return "Accent1";
      }
    },

    onNavToExpertList: function () {
      this._oRouter.navTo("expertList");
    },

    onNavToAdminSolutions: function () {
      this._oRouter.navTo("adminSolutions");
    },

    /* ── Auth is handled by XSUAA (prod) or mocked auth (dev) ── */
    /* ── No manual login/logout needed — role comes from token  ── */
  });
});
