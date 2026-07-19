const cron = require("node-cron");
const axios = require("axios");
const Bug = require("../models/BugReportSchema");

//Runs auto assignment of tester twice a day during working hours
const runAutoAssignTesterRetryJob = () => {
  //Runs every day at 3PM and 7PM
  cron.schedule("0 15,19 * * 1-5", async () => {
    try {
      //Find bugs in "Fixed (Testing Pending)" status but no tester assigned
      const unassignedBugs = await Bug.find({
        status: "Fixed (Testing Pending)",
        "assignedTo.tester": { $in: [null, ""] },
      }).select("bugId");

      if (unassignedBugs.length === 0) {
        console.log("No bugs pending tester assignment");
        return;
      }

      for (const bug of unassignedBugs) {
        try {
          //Call the auto-assign-tester API
          await axios.put(
            `${process.env.BACKEND_URL || "https://localhost:5000"}/api/bug-reports/auto-assign-tester`,
            { bugId: bug.bugId },
            {
              headers: {
                Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
                "Content-Type": "application/json",
              },
              httpsAgent: new (require("https").Agent)({
                rejectUnauthorized: false,
              }), //Axios in nodejs does not trust
              //self signed SSL like how browsers trust after users accept. So maeke axios in backend trust self signedSSL
            }
          );
        } catch (err) {
          console.error(`${bug.bugId}`, err.response?.data?.message);
        }
      }
    } catch (err) {
      console.error("Tester auto-assign retry job failed:", err.message);
    }
  });
};

module.exports = { runAutoAssignTesterRetryJob };
