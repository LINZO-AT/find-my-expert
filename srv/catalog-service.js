const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {
  this.on("userInfo", async (req) => {
    const user = req.user;
    return {
      isAdmin: user.is("Admin"),
      userName: user.id || "",
    };
  });
});