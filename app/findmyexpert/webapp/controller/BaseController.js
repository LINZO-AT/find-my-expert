sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], function (Controller, History) {
  "use strict";

  return Controller.extend("com.sap.austria.findmyexpert.controller.BaseController", {

    /**
     * Navigate back — respects FLP back navigation.
     * Falls back to browser history or FLP home.
     */
    onNavBack: function () {
      var sPreviousHash = History.getInstance().getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        // No history — navigate to FLP home if available, else to search
        this._navigateToFLPHome().catch(function () {
          // FLP not available — fallback to search route
          this.getOwnerComponent().getRouter().navTo("search", {}, true);
        }.bind(this));
      }
    },

    /**
     * Navigate to FLP home via async ushell Container access.
     * @returns {Promise}
     */
    _navigateToFLPHome: function () {
      return new Promise(function (resolve, reject) {
        sap.ui.require(["sap/ushell/Container"], function (Container) {
          try {
            var oCrossAppNav = Container && Container.getServiceAsync("CrossApplicationNavigation");
            if (oCrossAppNav) {
              oCrossAppNav.then(function (oNav) {
                if (oNav && oNav.toExternal) {
                  oNav.toExternal({ target: { shellHash: "#" } });
                  resolve();
                } else {
                  reject();
                }
              }).catch(reject);
            } else {
              reject();
            }
          } catch (e) {
            reject();
          }
        }, function () {
          reject(); // module not available
        });
      });
    },

    /**
     * Authenticated fetch() — automatically injects the Authorization header
     * that Component.js set on the OData models (DEV: Basic anonymous:, PROD: none).
     *
     * Use this for ALL manual fetch() calls to /api/admin/* and /api/catalog/*.
     * Prevents browser Basic-Auth popups in DEV and works transparently in PROD.
     *
     * @param {string}  sUrl     Relative URL, e.g. "/api/admin/Topics"
     * @param {object}  [oOpts]  fetch() options (method, body, etc.)
     * @returns {Promise<Response>}
     */
    _authFetch: function (sUrl, oOpts) {
      oOpts = oOpts || {};
      var oHeaders = Object.assign({ "Accept": "application/json" }, oOpts.headers || {});

      // Read the Authorization header stored in userModel by Component.js
      // In DEV: "Basic anonymous:", in PROD (XSUAA): "" (empty — JWT via credentials:same-origin)
      try {
        var oUserModel = this.getOwnerComponent().getModel("userModel");
        var sAuth = oUserModel && oUserModel.getProperty("/authHeader");
        if (sAuth) {
          oHeaders.Authorization = sAuth;
        }
      } catch (e) { /* no model available yet */ }

      return fetch(sUrl, Object.assign({}, oOpts, { headers: oHeaders }));
    },

    /**
     * Convenience: get i18n resource bundle.
     */
    getResourceBundle: function () {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    },

    /**
     * Convenience: get router.
     */
    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    }
  });
});
