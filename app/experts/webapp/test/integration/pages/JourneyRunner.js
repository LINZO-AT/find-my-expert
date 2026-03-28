sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"experts/test/integration/pages/ExpertsList",
	"experts/test/integration/pages/ExpertsObjectPage"
], function (JourneyRunner, ExpertsList, ExpertsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('experts') + '/test/flpSandbox.html#experts-tile',
        pages: {
			onTheExpertsList: ExpertsList,
			onTheExpertsObjectPage: ExpertsObjectPage
        },
        async: true
    });

    return runner;
});

