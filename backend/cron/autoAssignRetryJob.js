const cron = require("node-cron");
const axios = require("axios");
const Bug = require("../models/BugReportSchema");

//Runs auto assignment of developer twice a day during working hours
const runAutoAssignRetryJob = () => {
  //Runs everydat at 2PM and 6PM
  cron.schedule("0 14,18 * * 1-5", async () => {
    try {
      //Find unassigned bugs
      const unassignedBugs = await Bug.find({
        "assignedTo.developer": { $in: [null, ""] },
        assignedTeam: { $ne: "unassigned" },
      }).select("bugId");

      if (unassignedBugs.length === 0) {
        console.log("No bugs pending developer assignment");
        return;
      }

      for (const bug of unassignedBugs) {
        try {
          //Call the auto-assign-developer API
          await axios.put(
            `${process.env.BACKEND_URL || "https://localhost:5000"}/api/bug-reports/auto-assign-developer`,
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
      console.error("Auto-assign retry job failed:", err.message);
    }
  });
};

module.exports = { runAutoAssignRetryJob };
