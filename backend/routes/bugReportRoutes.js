const express = require("express");
const multer = require("multer");
const authenticateUser = require("../middlewares/authMiddleware");
const {
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkSimilarityKey,
  checkIfPriorityIsSet,
  checkIfAdmin,
  checkIfTeamLeadForAppAndTeam,
  checkIfAdminOrTeamLeadForAppAndTeam,
} = require("../middlewares/bugMiddleware");
const BugReport = require("../models/BugReportSchema");
const Application = require("../models/ApplicationSchema");
const User = require("../models/UserSchema");
const IssueType = require("../models/IssueTypeSchema");

const dayjs = require("dayjs");
const nodemailer = require("nodemailer");
const axios = require("axios");
const router = express.Router();
const { expandSearchQueryWithSynonyms } = require("../utils/synonymFinder");
const assignDeveloper = require("../utils/assignDeveloper");
//To store attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

const VALID_BROWSERS = ["Chrome", "Firefox", "Safari", "Edge"];
const VALID_OSS = ["Windows", "MacOS", "Linux", "Android", "iOS"];
const VALID_STATUSES = [
  "Open",
  "Assigned",
  "Fix In Progress",
  "Fixed (To be tested)",
  "Tester Assigned",
  "Testing In Progress",
  "Tested & Verified",
  "Closed",
  "Duplicate",
];

const PRIORITY_DEVELOPER_HOURS = {
  Critical: 6,
  High: 9,
  Medium: 3,
  Low: 1,
};

const PRIORITY_TESTER_HOURS = {
  Critical: 4,
  High: 5,
  Medium: 2,
  Low: 1,
};

const issueTypeKeywordMap = {
  "UI Issue": [
    "Visual issue (Misaligned elements, overlapping, text cut)",
    "Button or link is not working (Clicking does nothing)",
    "Incorrect colors, fonts, or icons (Not as expected)",
    "Scrolling or navigation issue (Menus, sidebars not working)",
  ],
  "Backend Issue": [
    "Form is not submitting (No response after clicking submit)",
    "Data not saved correctly (Wrong values in database)",
    "Incorrect calculations or logic (Wrong total, wrong status)",
    "API not responding or returning error",
    "Incorrect error messages (Misleading or missing errors)",
  ],
  "Infrastructure Issue": [
    "Page not loading (Timeout or server not found)",
    "Broken image or resource link (404, missing files)",
    "Slow performance (Page takes too long to load)",
    "Deployment-related issue (Feature missing after deployment)",
  ],
};

//Submit endpoint to create bug report
router.post(
  "/submit",
  authenticateUser,
  upload.array("attachments", 5),
  async (req, res) => {
    try {
      const {
        application,
        issueType,
        title,
        description,
        browser,
        os,
        errorLogs,
        stackTrace,
        userRole,
        reporterName,
        reporterEmail,
        otherIssueDescription,
        assignedTeam,
        assignedToDeveloper,
        assignedToTester,
        duplicateDetectionDone,
        isPotentialDuplicate,
        similarTo,
        status,
        priority,
      } = req.body;

      const errors = [];

      //Validations

      //Check if the provided name and email is a valid user in the database
      if (!reporterName) errors.push("Reporter name is required");
      if (!reporterEmail) errors.push("Reporter email is required");
      const reporter = await User.findOne({
        email: reporterEmail.trim(),
        fullName: reporterName.trim(),
      });
      if (!reporter) {
        errors.push(
          "Reporter email, name do not match any usr in the database"
        );
      }

      //Check if the provided application is a valid applicarion available in the database
      const applications = await Application.find().select("name");
      const validApplications = applications.map((app) => app.name);

      if (!application) {
        errors.push("Application is required");
      } else if (!validApplications.includes(application)) {
        errors.push(
          `Invalid application. Available apps- ${validApplications.join(", ")}`
        );
      }

      //Check if the provided issue type is a valid issue type available in the database
      const category = userRole === "user" ? "end-user" : "tech-user";
      const validIssueTypes = await IssueType.find({ category }).select("name");
      const validIssueTypeNames = validIssueTypes.map((issue) => issue.name);
      if (!issueType) {
        errors.push("Issue type is required.");
      } else if (!validIssueTypeNames.includes(issueType)) {
        errors.push(
          `Invalid issue type. Allowed types- ${validIssueTypeNames.join(", ")}`
        );
      }

      //Title Validation
      const titleCorrected = title ? title.trim().replace(/\r\n/g, "\n") : ""; // to replace the 2 characters added in the backend
      // for a new line entered in the frontend
      if (!title) {
        errors.push("Bug title is required.");
      } else if (titleCorrected.length < 15 || titleCorrected.length > 30) {
        errors.push("Bug title must be between 15 and 30 chars");
      }

      //Desc Validation
      const desc = description ? description.trim().replace(/\r\n/g, "\n") : ""; // to replace the 2 characters added in the backend
      // for a new line entered in the frontend

      if (!description) {
        errors.push("Bug description is required.");
      } else {
        if (desc.length < 30 || desc.length > 100) {
          errors.push("Bug description must be between 30 and 100 characters.");
        }
      }

      //Other issues description validation (only if issue type is "Other")
      const otherIssueDesc = otherIssueDescription
        ? otherIssueDescription.trim().replace(/\r\n/g, "\n")
        : ""; // to replace the 2 characters added in the backend
      // for a new line entered in the frontend
      let otherIssue = issueType === "Other" ? otherIssueDesc : null;

      if (issueType === "Other") {
        if (!otherIssueDesc) {
          errors.push("Issue type description is required.");
        } else if (otherIssueDesc.length < 15 || otherIssueDesc.length > 50) {
          errors.push(
            "Issue type description must be between 15 and 50 chars."
          );
        }
      }

      //Steps to reproduce issue validation for general users and tech users
      let stepsToReproduce = "";
      let userSteps = null;

      if (userRole === "user") {
        if (!req.body.userStep1 || !req.body.userStep2) {
          errors.push("Both step 1 and step 2 are required for users");
        } else {
          // to replace the 2 characters added in the backend for a new line entered in the frontend
          const step1 = req.body.userStep1
            ? req.body.userStep1.trim().replace(/\r\n/g, "\n")
            : "";
          const step2 = req.body.userStep2
            ? req.body.userStep2.trim().replace(/\r\n/g, "\n")
            : "";
          if (step1.length < 20 || step1.length > 300) {
            errors.push("Step 1 must be between 20 and 300 chars.");
          }
          if (step2.length < 20 || step2.length > 300) {
            errors.push("Step 2 must be between 20 and 300 chars.");
          }
          userSteps = {
            step1,
            step2,
          };
        }
      } else {
        if (!req.body.stepsToReproduce) {
          errors.push("Steps to reproduce are required.");
        } else {
          // to replace the 2 characters added in the backend for a new line entered in the frontend
          const steps = req.body.stepsToReproduce
            ? req.body.stepsToReproduce.trim().replace(/\r\n/g, "\n")
            : "";
          if (steps.length < 30 || steps.length > 500) {
            errors.push("Steps to reproduce must be between 30 and 500 chars.");
          } else {
            stepsToReproduce = steps;
          }
        }
      }

      //Browsers validation
      if (browser && !VALID_BROWSERS.includes(browser)) {
        errors.push(
          `Invalid browser. Accepted browsers- ${VALID_BROWSERS.join(", ")}`
        );
      }

      //OSs validation
      if (os && !VALID_OSS.includes(os)) {
        errors.push(`Invalid os. Accepted oss'- ${VALID_OSS.join(", ")}`);
      }

      //Stauts validation
      if (status && !VALID_STATUSES.includes(status)) {
        errors.push(
          `Invalid status. Accepted statuses'- ${VALID_OSS.join(", ")}`
        );
      }

      //Priority validation
      const validPriorities = ["Critical", "High", "Medium", "Low"];
      if (priority && !validPriorities.includes(priority)) {
        errors.push(
          "Invalid priority. Must be Critical, High, Medium, or Low."
        );
      }

      //Error Logs validation
      const errLogs = errorLogs ? errorLogs.trim().replace(/\r\n/g, "\n") : ""; // to replace the 2 characters added in the backend
      // for a new line entered in the frontend
      if (errLogs && (errLogs.length < 10 || errLogs.length > 5000)) {
        errors.push("Error logs must be between 10 and 5000 chars.");
      }

      //Stack Trace validation
      const stkTrace = stackTrace
        ? stackTrace.trim().replace(/\r\n/g, "\n")
        : ""; // to replace the 2 characters added in the backend for a new line entered in the frontend
      if (stkTrace && (stkTrace.length < 10 || stkTrace.length > 10000)) {
        errors.push("Stack trace must be between 10 and 10000 chars.");
      }

      //Attachments validation - allow only 5 files
      const attachments = req.files?.map((file) => `${file.filename}`) || [];
      if (attachments.length > 5) {
        errors.push("A maximum of 5 attachments is allowed.");
      }

      if (errors.length > 0) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: errors });
      }

      const newBug = new BugReport({
        application,
        issueType,
        otherIssueDescription: otherIssue,
        title,
        description,
        stepsToReproduce,
        userSteps,
        browser,
        os,
        errorLogs: errLogs || "",
        stackTrace: stkTrace || "",
        attachments,
        reportedBy: {
          name: reporterName,
          email: reporterEmail,
          role: userRole,
        },
        assignedTeam: assignedTeam || null,

        assignedTo: {
          developer: assignedToDeveloper || null,
          tester: assignedToTester || null,
        },
        status,
        priority,
        changeHistory: [
          {
            type: "Status Change",
            previousStatus: null,
            newStatus: status,
            statusLastUpdated: new Date(),
            changedOn: new Date(),
            changedBy: reporterEmail,
            changedByRole: userRole,
            reason: "Bug reported",
          },
        ],
        duplicateDetectionDone: duplicateDetectionDone === "true",
        isPotentialDuplicate: isPotentialDuplicate === "true",
        similarTo: similarTo ? JSON.parse(similarTo) : [],
      });

      if (assignedToDeveloper || assignedToTester) {
        newBug.changeHistory.push({
          type: "Assignment",
          developer: assignedToDeveloper || null,
          tester: assignedToTester || null,
          changedOn: new Date(),
          changedBy: reporterEmail,
          changedByRole: userRole,
        });
      }
      //Store bug report in database
      await newBug.save();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: reporterEmail,
        subject: `Bug report submitted successfully - Bug ID: ${newBug.bugId}`,
        text: `Dear ${reporterName},

Your bug report has been successfully submitted.

Bug ID: ${newBug.bugId}
Title: ${title}
Description: ${description}
Issue Type: ${issueType}
Application: ${application}
Status: ${status}

You will be notified on updates in the report.
`,
      };

      try {
        await transporter.sendMail(mailOptions);
        res.status(201).json({
          message: "Bug report submitted successfully!",
          bugId: newBug.bugId,
        });
      } catch (emailError) {
        console.error("Error sending email notification:", emailError.message);
        res.status(201).json({
          message:
            "Bug report submitted successfully but email notification failed.",
          bugId: newBug.bugId,
        });
      }
      //Send email to assigned developer
      if (assignedToDeveloper) {
        const devUser = await User.findOne({ email: assignedToDeveloper });

        if (devUser) {
          const devMailOptions = {
            from: process.env.EMAIL_USER,
            to: assignedToDeveloper,
            subject: `New Bug Assigned - Bug ID: ${newBug.bugId}`,
            text: `Dear ${devUser.fullName || "Developer"},

You have been assigned a new bug.

Bug ID: ${newBug.bugId}
Title: ${title}
Application: ${application}
Priority: ${priority || "Not Set"}
Status: ${status}

Please check your dashboard for more details.`,
          };

          try {
            await transporter.sendMail(devMailOptions);
          } catch (emailError) {
            console.error(
              `Error sending email notification:`,
              emailError.message
            );
          }
        }
      }

      //Send email to team lead of the assigned team (if applicable)
      if (assignedTeam) {
        const teamLead = await User.findOne({
          "roles.role": "teamlead",
          "roles.application": application,
          "roles.team": assignedTeam,
        }).select("email fullName");

        if (teamLead) {
          const teamLeadMailOptions = {
            from: process.env.EMAIL_USER,
            to: teamLead.email,
            subject: `Bug Assigned to your Team - Bug ID: ${newBug.bugId}`,
            text: `Dear ${teamLead.fullName || "Team Lead"},

A new bug has been reported and assigned to your team (${assignedTeam}).

Bug ID: ${newBug.bugId}
Title: ${title}
Application: ${application}
Priority: ${priority || "Not Set"}
Status: ${status}

Please check your dashboard for more details.`,
          };

          try {
            await transporter.sendMail(teamLeadMailOptions);
          } catch (emailError) {
            console.error(
              `Error sending email notification:`,
              emailError.message
            );
          }
        }
      }

      //To add bug report as embedding to the FAISS index after bug is saved (used in the duplciate detection)
      try {
        await axios.post(`${process.env.ML_SERVICE_URL || "http://localhost:8000"}/add-embedding`, {
          application: newBug.application,
          bugId: newBug.bugId,
          title: newBug.title,
          description: newBug.description,
          stepsToReproduce: newBug.stepsToReproduce,
          userSteps: newBug.userSteps,
        }, {
          headers: { "x-similarity-key": process.env.SIMILARITY_API_KEY },
        });
      } catch (err) {
        console.error("Error ", err.message);
      }
    } catch (error) {
      console.error("Bug Report submission failed:", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Get bug reports endpoint to get bugs reported by the logged in user
router.get("/reported", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res
        .status(401)
        .json({ error: "User does not exist in the database" });
    }

    //Find all the bugs reported by this user
    const bugReports = await BugReport.find({ "reportedBy.email": userEmail });

    if (!bugReports.length) {
      return res.status(200).json({ message: "No bug reports found." });
    }

    res.status(200).json({ bugs: bugReports });
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

// Get specfic bug by id
router.get("/reported/:bugId", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { bugId } = req.params;
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res
        .status(401)
        .json({ error: "User does not exist in the database" });
    }

    let bugReport;
    //Search for specific bug report reported by the logged in user
    if (bugId) {
      bugReport = await BugReport.findOne({
        "reportedBy.email": userEmail,
        bugId: bugId,
      });
    }

    if (!bugReport) {
      return res
        .status(404)
        .json({ message: "No bug report found with the id " + bugId });
    }

    res.status(200).json({ bugReport });
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

//Add additional information endpoint
router.post(
  "/reported/:bugId/add-info",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const userEmail = req.user.email;
      const { bugId } = req.params;
      const { info } = req.body;

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      if (!info || info.trim().length < 10) {
        return res.status(400).json({
          error: "Additional information must be at least 10 chars.",
        });
      }

      const bugReport = await BugReport.findOne({ bugId });

      //Validate if the bug report with the provided id exists in the database
      if (!bugReport) {
        return res
          .status(404)
          .json({ error: "Bug report to add additional informatin not found" });
      }

      //Check if the logged in user is the original reporter
      if (bugReport.reportedBy.email !== userEmail) {
        return res.status(403).json({
          error:
            "You are not authorized to update this bug report as you are not the reporter of this bug",
        });
      }

      const additionalInfoEntry = {
        date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        info: info.trim(),
      };

      if (!bugReport.additionalInfo) {
        bugReport.additionalInfo = [];
      }

      //Add the newest entry on the top
      bugReport.additionalInfo.unshift(additionalInfoEntry);

      await bugReport.save();

      res.status(200).json({
        message: "Additional info added successfully",
        updatedBug: bugReport,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

//Get bug reports assigned to team
router.get(
  "/assigned/team/:application/:team",
  authenticateUser,
  async (req, res) => {
    try {
      const userEmail = req.user.email;
      const { application, team } = req.params;

      const {
        searchQuery = "",
        searchMode = "exact",
        priority,
        status,
        issueType,
        developer,
        tester,
        startDate,
        endDate,
        page = 1,
        limit = 25,
      } = req.query;

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }
      //Verify that the person getting the bugs assigned to the team is either a team lead or an admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === team
      );

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be a team lead or an admin to get bugs assigned to a team",
        });
      }

      const filter = {
        application,
        assignedTeam: team,
      };

      if (priority) filter.priority = priority;
      if (status) filter.status = status;

      if (developer === "Unassigned") {
        filter["assignedTo.developer"] = null;
      } else if (developer) {
        filter["assignedTo.developer"] = developer;
      }

      if (tester === "Unassigned") {
        filter["assignedTo.tester"] = null;
      } else if (tester) {
        filter["assignedTo.tester"] = tester;
      }

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) {
          const toDate = new Date(endDate);
          toDate.setDate(toDate.getDate() + 1); //includes endDate day
          filter.createdAt.$lte = toDate;
        }
      }

      //Single/combined or because if two ors are used then one will replace the other according to MongoDB rule
      const or = [];

      if (issueType) {
        const mappedKeywords = issueTypeKeywordMap[issueType] || [];
        or.push(
          { issueType: issueType },
          { issueType: { $in: mappedKeywords } },
          { otherIssueTypeDescription: { $in: mappedKeywords } }
        );
      }

      if (searchQuery && searchMode === "exact") {
        const words = searchQuery.toLowerCase().split(" ");
        words.forEach((word) => {
          or.push(
            { bugId: { $regex: word, $options: "i" } },
            { title: { $regex: word, $options: "i" } },
            { description: { $regex: word, $options: "i" } }
          );
        });
      }

      if (or.length > 0) {
        filter.$or = or;
      }

      console.log(filter);
      //skips already fetched results and using parseInt coz the query will be passed as string
      const skip = (parseInt(page) - 1) * parseInt(limit);

      //Get bugs and total docs to show in the UI like (Eg: of 120)
      const [bugs, total] = await Promise.all([
        BugReport.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        BugReport.countDocuments(filter),
      ]);

      res.status(200).json({
        bugs,
        total,
        page: parseInt(page),
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Get bugs assigned to a develpoer
router.get(
  "/assigned/developer/:developerEmail",
  authenticateUser,
  async (req, res) => {
    try {
      const userEmail = req.user.email;
      const { developerEmail } = req.params;

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      // Check if the developer provided exists in the database
      const developer = await User.findOne({ email: developerEmail });
      if (!developer) {
        return res
          .status(404)
          .json({ error: "Developer does not exist in the database" });
      }

      // Retrieve the developer's assigned application and team
      const developerRole = developer.roles.find(
        (role) => role.role === "developer"
      );
      if (!developerRole) {
        return res
          .status(403)
          .json({ error: "Provided user is not a developer." });
      }
      const { application, team } = developerRole;

      // Verify that the person getting the assigned bugs is a developer, team lead of the same team or admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === team
      );
      const isSameDeveloper = userEmail === developerEmail; //Check if the logged in user is trying to fetch bugs he is assihned to

      if (!isAdmin && !isTeamLead && !isSameDeveloper) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be the developer, a team lead or an admin to access developer assigned bugs.",
        });
      }

      // Fetch all bugs assigned to the developer
      const assignedBugs = await BugReport.find({
        application,
        assignedTeam: team,
        "assignedTo.developer": developerEmail,
      });

      if (!assignedBugs.length) {
        return res.status(200).json({
          message: `No bugs assigned to developer ${developerEmail} in ${application} - ${team}`,
        });
      }

      res.status(200).json({ bugs: assignedBugs });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Get bugs assigned to a tester
router.get(
  "/assigned/tester/:testerEmail",
  authenticateUser,
  async (req, res) => {
    try {
      const userEmail = req.user.email;
      const { testerEmail } = req.params;

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      // Check if the tester provided exists in the database
      const tester = await User.findOne({ email: testerEmail });
      if (!tester) {
        return res
          .status(404)
          .json({ error: "Tester does not exist in the database" });
      }

      // Retrieve the tester's assigned application and team
      const testerRole = tester.roles.find((role) => role.role === "tester");
      if (!testerRole) {
        return res
          .status(403)
          .json({ error: "Provided user is not a tester." });
      }
      const { application, team } = testerRole;

      // Verify that the person fetching bugs is a tester, team lead of the same team or admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === team
      );
      const isSameTester = userEmail === testerEmail; //Check if the logged in user is trying to fetch bugs he is assihned to
      if (!isAdmin && !isTeamLead && !isSameTester) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be the tester, a team lead or an admin to access tester-assigned bugs.",
        });
      }

      // Fetch all bugs assigned to the tester
      const assignedBugs = await BugReport.find({
        application,
        assignedTeam: team,
        "assignedTo.tester": testerEmail,
      });

      if (!assignedBugs.length) {
        return res.status(200).json({
          message: `No bugs assigned to tester ${testerEmail} in ${application} - ${team}`,
        });
      }

      res.status(200).json({ bugs: assignedBugs });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Get unassigned bugs
router.get("/unassigned/:application", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { application } = req.params;

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res
        .status(401)
        .json({ error: "User does not exist in the database" });
    }

    //Verify that the person getting the unassigned bugs is either a team lead or an admin
    const isAdmin = user.roles.some((role) => role.role === "admin");
    user.roles.forEach((role) => {
      console.log(role.application);
    });
    const isTeamLead = user.roles.find(
      (role) => role.role === "teamlead" && role.application === application
    );

    if (!isAdmin && !isTeamLead) {
      return res.status(403).json({
        error: `Unauthorized. You must be a team lead of the app provided "${application}" or an admin to get unassigned bugs`,
      });
    }

    //Get unassigned bugs for the given application
    const unassignedBugs = await BugReport.find({
      application,
      assignedTeam: "unassigned",
    });

    if (!unassignedBugs.length) {
      return res
        .status(200)
        .json({ message: "No unassigned bugs found for this application" });
    }

    res.status(200).json({ bugs: unassignedBugs });
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

//Get details of the bug assigned to hte team
router.get("/assigned/team/:bugId", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { bugId } = req.params;

    //Check if getting detail of the similar bug
    const isGettingDetailForSimilarBug =
      req.query.isGettingDetailForSimilarBug === "true";

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res
        .status(401)
        .json({ error: "User does not exist in the database" });
    }

    const bugReport = await BugReport.findOne({ bugId });
    if (!bugReport) {
      return res.status(404).json({
        message: "Bug not found",
      });
    }
    const { application, assignedTeam } = bugReport;

    const isDeveloper = user.roles.some(
      (role) =>
        role.role === "developer" &&
        role.application === application &&
        isGettingDetailForSimilarBug
    );

    const isTester = user.roles.some(
      (role) =>
        role.role === "tester" &&
        role.application === application &&
        isGettingDetailForSimilarBug
    );

    let isTeamLead;
    if (isGettingDetailForSimilarBug) {
      isTeamLead = user.roles.find(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          (isGettingDetailForSimilarBug || role.team === assignedTeam)
      );
    } else {
      isTeamLead = user.roles.find(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );
    }

    //Verify that the person getting the bug assigned to team details is either a team lead or an admin
    const isAdmin = user.roles.some((role) => role.role === "admin");

    if (!isAdmin && !isTeamLead && !isDeveloper && !isTester) {
      return res.status(403).json({
        message:
          "Unauthorized. You must be a team lead or an admin to get bug details",
      });
    }

    if (!bugReport) {
      return res
        .status(200)
        .json({ message: `No team assigned bug found with the id ${bugId}` });
    }

    res.status(200).json({ bugReport });
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

//Assign bug to team
router.put(
  "/assign-team",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkIfAdmin,
  async (req, res) => {
    try {
      const { bugId, assignedTeam } = req.body;
      const assignedByEmail = req.user.email;

      if (!bugId || !assignedTeam) {
        return res
          .status(400)
          .json({ error: "bugId and assignedTeam are required." });
      }

      const validTeams = ["frontend", "backend", "devops"];
      if (!validTeams.includes(assignedTeam)) {
        return res.status(400).json({
          error: "Invalid assignedTeam. Must be frontend, backend, or devops.",
        });
      }

      const user = await User.findOne({ email: assignedByEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "Assigning user does not exist in the database" });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ error: "Bug not found" });
      }

      //Verify that the person assigning the bug is an admin
      const isAdmin = user.roles.some((role) => role.role === "admin");

      const { application, title } = bug;

      //Update team assignment
      bug.assignedTeam = assignedTeam;
      bug.changeHistory.push({
        type: "Team Assignment",
        team: assignedTeam,
        changedBy: assignedByEmail,
        changedByRole: isAdmin ? "admin" : "teamlead",
        changedOn: new Date(),
        reason: "Team manually assigned by admin",
      });

      await bug.save();

      //Send email to team lead of the assigned team
      const teamLead = await User.findOne({
        "roles.role": "teamlead",
        "roles.application": application,
        "roles.team": assignedTeam,
      }).select("email fullName");

      if (teamLead) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: teamLead.email,
          subject: `Bug Assigned to ${assignedTeam} team - Bug ID: ${bug.bugId}`,
          text: `Dear ${teamLead.fullName},

A new bug has been assigned to your team (${assignedTeam}).

Bug ID: ${bug.bugId}
Title: ${title}
Application: ${application}
Assigned By: ${assignedByEmail}

Please log in to the system and assign this bug to an appropriate developer.
`,
        };

        try {
          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error(
            "Error sending email to team lead:",
            emailError.message
          );
        }
      }

      return res.status(200).json({
        message: `Bug assigned to ${assignedTeam} team successfully.`,
        bug,
      });
    } catch (error) {
      console.error("Error ", error.message);
      return res
        .status(500)
        .json({ error: "Server error", details: error.message });
    }
  }
);

//Assign bug to developer
router.put(
  "/assign-developer",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkIfPriorityIsSet,
  async (req, res) => {
    try {
      const { bugId, developerEmail } = req.body;
      const assignedByEmail = req.user.email;

      if (!bugId || !developerEmail) {
        return res.status(400).json({
          message: "bugId and developerEmail are required.",
        });
      }

      const user = await User.findOne({ email: assignedByEmail });
      if (!user) {
        return res.status(401).json({
          error: "User assigning the developer does not exist in the database",
        });
      }

      //Check if the bug exists
      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({
          message: "Bug not found",
        });
      }
      console.log(developerEmail);

      const { application, assignedTeam } = bug;

      //Verify that the person assigning the bug is either a team lead or an admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.find(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );
      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          message:
            "Unauthorized. You must be a team lead or an admin to assign bug to develoepr",
        });
      }

      const restrictedStatuses = [
        "Fix In Progress",
        "Fixed (Testing Pending)",
        "Tester Assigned",
        "Testing In Progress",
        "Tested & Verified",
      ];

      if (restrictedStatuses.includes(bug.status)) {
        return res.status(400).json({
          message: `Bug cannot be assigned/reassigned while it is in '${bug.status}' status.`,
        });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      //Check if the bug is already assigned to a developer
      if (
        !isAdmin &&
        developerEmail !== "Unassign" &&
        bug.assignedTo &&
        bug.assignedTo.developer
      ) {
        return res.status(400).json({
          message: `Bug is already assigned to developer ${bug.assignedTo.developer}. Unassign and try again`,
        });
      }

      // Unassign developer
      if (developerEmail === "Unassign") {
        if (!isAdmin && (!isTeamLead || bug.status !== "Assigned")) {
          return res.status(403).json({
            message:
              "Team leads can unassign only if the bug status is 'Assigned'.",
          });
        }

        const currentDeveloperEmail = bug.assignedTo?.developer;
        const currentDeveloper = await User.findOne({
          email: currentDeveloperEmail,
        });

        bug.assignedTo.developer = null;
        bug.status = "Open";
        (bug.statusLastUpdated = new Date()),
          bug.changeHistory.push({
            type: "Unassign",
            changedBy: assignedByEmail,
            changedByRole: isAdmin ? "admin" : "teamlead",
            changedOn: new Date(),
            reason: "Developer manually unassigned",
          });

        await bug.save();

        //Decrease workload hours based on priority
        const estimatedHours = PRIORITY_DEVELOPER_HOURS[bug.priority];
        if (currentDeveloperEmail && estimatedHours) {
          await User.updateOne(
            {
              email: currentDeveloperEmail,
              "roles.application": application,
              "roles.team": assignedTeam,
              "roles.role": "developer",
            },
            {
              $inc: { "roles.$.workloadHours": -estimatedHours },
            }
          );
        }

        //Notify unassigned developer
        if (currentDeveloperEmail && currentDeveloper?.fullName) {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: currentDeveloperEmail,
            subject: `Bug unassigned - Bug ID: ${bug.bugId}`,
            text: `Dear ${currentDeveloper.fullName},

You have been unassigned from the following bug:

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Assigned Team: ${assignedTeam}

Please check your dashboard for more details.`,
          };

          try {
            await transporter.sendMail(mailOptions);
          } catch (emailError) {
            console.error(
              "Error sending email to unassigned developer",
              emailError.message
            );
          }
        }

        //Notify the other role (admin or team lead)
        let otherPerson = null;

        if (isAdmin) {
          otherPerson = await User.findOne({
            "roles.role": "teamlead",
            "roles.application": application,
            "roles.team": assignedTeam,
          });
        } else if (isTeamLead) {
          otherPerson = await User.findOne({ "roles.role": "admin" });
        }

        if (otherPerson && otherPerson.email !== assignedByEmail) {
          try {
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: otherPerson.email,
              subject: `Developer unassigned - Bug ID: ${bug.bugId}`,
              text: `Hi Admin/TeamLead,

The developer (${currentDeveloperEmail}) has been unassigned from the following bug by ${
                isAdmin ? "Admin" : "Team Lead"
              } (${assignedByEmail}):

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Assigned Team: ${assignedTeam}

This is just for your information.`,
            };

            await transporter.sendMail(mailOptions);
          } catch (err) {
            console.error(
              "Failed to notify other role on unassignment",
              err.message
            );
          }
        }

        return res.status(200).json({
          message: "Developer unassigned successfully.",
          bug,
        });
      }

      //Get list of valid developers in the assigned team
      const response = await axios.get(
        `${process.env.BACKEND_URL || "https://localhost:5000"}/api/developers/${application}/${assignedTeam}`,
        {
          headers: { Authorization: req.headers.authorization },
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }), //Axios in nodejs does not trust
          //self signed SSL like how browsers trust after users accept. So maeke axios in backend trust self signedSSL
        }
      );

      const validDevelopers = response.data;
      const isDeveloperValid = validDevelopers.some(
        (dev) => dev.email === developerEmail
      );

      //Check if developer is part of the team in the application
      if (!isDeveloperValid) {
        return res.status(403).json({
          message:
            "Developer is not part of this application and assigned team.",
        });
      }

      const developer = await User.findOne({
        email: developerEmail,
      }).select("fullName");

      if (!developer) {
        return res.status(404).json({
          message: "Developer not found after .",
        });
      }

      const developerName = developer.fullName;

      const estimatedHours = PRIORITY_DEVELOPER_HOURS[bug.priority];

      //Update workloadHours
      const developerData = await User.findOne({
        email: developerEmail,
        "roles.application": application,
        "roles.team": assignedTeam,
        "roles.role": "developer",
      });

      const currentHours =
        developerData?.roles?.find(
          (r) =>
            r.role === "developer" &&
            r.application === application &&
            r.team === assignedTeam
        )?.workloadHours || 0;

      if (currentHours + estimatedHours > 40) {
        return res.status(400).json({
          message: `Cannot assign bug. Developer workload will exceed 40 hours (current: ${currentHours}, adding: ${estimatedHours}).`,
        });
      }

      const userRole = isAdmin ? "admin" : isTeamLead ? "teamlead" : "";

      // Assign the bug to the developer
      const updatedBug = await BugReport.findOneAndUpdate(
        { bugId },
        {
          $set: {
            assignedTo: {
              developer: developerEmail,
            },
            status: "Assigned",
            statusLastUpdated: new Date(),
          },
          $push: {
            changeHistory: {
              type: "Assignment",
              developer: developerEmail,
              changedBy: req.user?.email,
              changedOn: new Date(),
              changedByRole: userRole,
            },
          },
        },
        { new: true } // returns updated bug. If not provided then it gives the bug report before update
      );

      await User.updateOne(
        {
          email: developerEmail,
          "roles.application": application,
          "roles.team": assignedTeam,
          "roles.role": "developer",
        },
        {
          $inc: { "roles.$.workloadHours": estimatedHours },
        }
      );

      //Send email notification to the assigned developer
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: developerEmail,
        subject: `Bug assigned - Bug ID: ${bug.bugId}`,
        text: `Dear ${developerName},

You have been assigned a new bug.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Team: ${assignedTeam}

Please check your dashboard for moredetails.
`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending email to developer", emailError.message);
      }

      res.status(200).json({
        message: "Bug assigned successfully.",
        bug: updatedBug,
      });
    } catch (error) {
      console.error("Error ", error);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Assign bug to tester
router.put(
  "/assign-tester",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkIfPriorityIsSet,
  async (req, res) => {
    try {
      const { bugId, testerEmail } = req.body;
      const assignedByEmail = req.user.email;

      if (!bugId || !testerEmail) {
        return res.status(400).json({
          message: "bugId and testerEmail are required.",
        });
      }

      const user = await User.findOne({ email: assignedByEmail });
      if (!user) {
        return res.status(401).json({
          error: "User assigning the tester does not exist in the database",
        });
      }

      //Check if the bug exists
      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({
          message: "Bug not found",
        });
      }

      //Check if the bug is already assigned to a tester
      if (
        testerEmail !== "Unassign" &&
        bug.assignedTo &&
        bug.assignedTo.tester
      ) {
        return res.status(400).json({
          message: `Bug is already assigned to tester ${bug.assignedTo.tester}. Unassign and try again`,
        });
      }
      const { application, assignedTeam, status } = bug;

      //Verify that the person assigning the bug to tester is either a team lead or an admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.find(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          message:
            "Unauthorized. You must be a team lead or an admin to assign bug to tester",
        });
      }

      const restrictedStatuses = ["Testing In Progress", "Tested & Verified"];

      if (restrictedStatuses.includes(bug.status)) {
        return res.status(400).json({
          message: `Bug cannot be assigned/reassigned while it is in '${bug.status}' status.`,
        });
      }

      //Unassign tester
      if (testerEmail === "Unassign") {
        if (!isAdmin && (!isTeamLead || bug.status !== "Tester Assigned")) {
          return res.status(403).json({
            message:
              "Team leads can unassign only if the bug status is 'Tester Assigned'.",
          });
        }

        const currentTesterEmail = bug.assignedTo?.tester;
        const currentTester = await User.findOne({
          email: currentTesterEmail,
        });

        bug.assignedTo.tester = null;
        bug.status = "Fixed (Testing Pending)";
        (bug.statusLastUpdated = new Date()),
          bug.changeHistory.push({
            type: "Unassign",
            changedBy: assignedByEmail,
            changedByRole: isAdmin ? "admin" : "teamlead",
            changedOn: new Date(),
            reason: "Tester manually unassigned",
          });

        await bug.save();

        //Decrease workload hours based on priority
        const estimatedHours = PRIORITY_TESTER_HOURS[bug.priority];
        if (currentTesterEmail && estimatedHours) {
          await User.updateOne(
            {
              email: currentTesterEmail,
              "roles.application": application,
              "roles.team": assignedTeam,
              "roles.role": "tester",
            },
            {
              $inc: { "roles.$.workloadHours": -estimatedHours },
            }
          );
        }

        //Notify unassigned tester
        if (currentTesterEmail && currentTester?.fullName) {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: currentTesterEmail,
            subject: `Bug unassigned for testing - Bug ID: ${bug.bugId}`,
            text: `Dear ${currentTester.fullName},

You have been unassigned from the following bug (testing):

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Assigned Team: ${assignedTeam}

Please check your dashboard for more details.`,
          };

          try {
            await transporter.sendMail(mailOptions);
          } catch (emailError) {
            console.error(
              "Error sending email to unassigned tester",
              emailError.message
            );
          }
        }

        //Notify the other role (admin or team lead)
        let otherPerson = null;

        if (isAdmin) {
          otherPerson = await User.findOne({
            "roles.role": "teamlead",
            "roles.application": application,
            "roles.team": assignedTeam,
          });
        } else if (isTeamLead) {
          otherPerson = await User.findOne({ "roles.role": "admin" });
        }

        if (otherPerson && otherPerson.email !== assignedByEmail) {
          try {
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: otherPerson.email,
              subject: `Tester unassigned - Bug ID: ${bug.bugId}`,
              text: `Hi Admin/TeamLead,

The tester (${currentTesterEmail}) has been unassigned from the following bug by ${
                isAdmin ? "Admin" : "Team Lead"
              } (${assignedByEmail}):

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Assigned Team: ${assignedTeam}

This is just for your information.`,
            };

            await transporter.sendMail(mailOptions);
          } catch (err) {
            console.error(
              "Failed to notify other role on unassignment",
              err.message
            );
          }
        }

        return res.status(200).json({
          message: "Tester unassigned successfully.",
          bug,
        });
      }

      //Get list of valid testers in the assigned team
      const response = await axios.get(
        `${process.env.BACKEND_URL || "https://localhost:5000"}/api/testers/${application}/${assignedTeam}`,
        {
          headers: { Authorization: req.headers.authorization },
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }), //Axios in nodejs does not trust
          //self signed SSL like how browsers trust after users accept. So maeke axios in backend trust self signedSSL
        }
      );

      const validTesters = response.data;
      const isTesterValid = validTesters.some(
        (tester) => tester.email === testerEmail
      );

      //Check if tester is part of the team in the application
      if (!isTesterValid) {
        return res.status(403).json({
          message: "Tester is not part of this application and assigned team.",
        });
      }

      const testerName = await User.findOne({ email: testerEmail }).select(
        "fullName"
      );

      const estimatedHours = PRIORITY_TESTER_HOURS[bug.priority];

      const testerData = await User.findOne({
        email: testerEmail,
        "roles.application": application,
        "roles.team": assignedTeam,
        "roles.role": "tester",
      });
      console.log(testerData);
      const currentTesterHours =
        testerData?.roles?.find(
          (r) =>
            r.role === "tester" &&
            r.application === application &&
            r.team === assignedTeam
        )?.workloadHours || 0;

      if (currentTesterHours + estimatedHours > 40) {
        return res.status(400).json({
          message: `Cannot assign bug. Tester workload would exceed 40 hours (current: ${currentTesterHours}, adding: ${estimatedHours}).`,
        });
      }

      const userRole = isAdmin ? "admin" : isTeamLead ? "teamlead" : "";

      // Assign the bug to the tester
      const updatedBug = await BugReport.findOneAndUpdate(
        { bugId },
        {
          $set: {
            assignedTo: {
              developer: bug.assignedTo?.developer,
              tester: testerEmail,
            },
            status: "Tester Assigned",
            statusLastUpdated: new Date(),
          },
          $push: {
            changeHistory: {
              type: "Tester Assignment",
              tester: testerEmail,
              changedBy: req.user?.email,
              changedOn: new Date(),
              changedByRole: userRole,
            },
          },
        },
        { new: true } // returns updated bug. If not provided then it gives the bug report before update
      );
      await User.updateOne(
        {
          email: testerEmail,
          "roles.application": application,
          "roles.team": assignedTeam,
          "roles.role": "tester",
        },
        {
          $inc: { "roles.$.workloadHours": estimatedHours },
        }
      );

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Send email notification to the asisgned tester
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: testerEmail,
        subject: `Bug assigned for testing - Bug ID: ${bug.bugId}`,
        text: `Dear ${testerName.fullName},

You have been assigned a new bug for testing.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Assigned Team: ${assignedTeam}

Please check your dashboard for moredetails.
`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending email to tester", emailError.message);
      }

      res.status(200).json({
        message: "Tester assigned successfully.",
        bug: updatedBug,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Set priority for the bug
router.put(
  "/set-priority",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkIfAdminOrTeamLeadForAppAndTeam,
  async (req, res) => {
    try {
      const { bugId, priority } = req.body;
      const updatedByEmail = req.user.email;

      if (!bugId || !priority) {
        return res.status(400).json({
          message: "bugId and priority are required.",
        });
      }

      const user = await User.findOne({ email: updatedByEmail });
      if (!user) {
        return res.status(401).json({
          error: "User updating the priority does not exist in the database",
        });
      }

      //Check if the bug exists
      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({
          message: "Bug not found.",
        });
      }

      //Verify if the provided priority is one of the below
      const validPriorities = ["Critical", "High", "Medium", "Low"];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          message: "Invalid priority. Allowed - Critical, high, medium, low",
        });
      }

      const { application, assignedTeam } = bug;

      // Verify that the person updating the priority is either a team lead or an admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.find(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          message:
            "Unauthorized. You must be a team lead or an admin to set bug priority",
        });
      }

      if (bug.assignedTo?.developer || bug.assignedTo?.tester) {
        return res.status(400).json({
          message:
            "Cannot change priority after a developer/tester has been assigned.",
        });
      }
      const userRole = isAdmin
        ? "admin"
        : isTeamLead
        ? "teamlead"
        : isDeveloper
        ? "developer"
        : isTester
        ? "tester"
        : "user";
      const previousPriority = bug.priority || "Not set yet";

      //Update the bug priority
      const updatedBug = await BugReport.findOneAndUpdate(
        { bugId },
        {
          priority,
          $push: {
            changeHistory: {
              type: "Priority Change",
              priority: priority,
              changedOn: new Date(),
              changedBy: req.user.email,
              changedByRole: userRole,
              reason: `Priority changed from ${previousPriority} to ${priority}.`,
            },
          },
        },
        { new: true } // returns updated bug. If not provided then it gives the bug report before update
      );

      //Send email after priority update
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const recipients = [];

      //Add developer email if assigned
      if (bug.assignedTo?.developer) {
        recipients.push(bug.assignedTo.developer);
      }

      //Add tester email if assigned
      if (bug.assignedTo?.tester) {
        recipients.push(bug.assignedTo.tester);
      }

      //Add team lead email
      const teamLead = await User.findOne({
        "roles.application": application,
        "roles.team": assignedTeam,
        "roles.role": "teamlead",
      }).select("email");

      if (teamLead) {
        recipients.push(teamLead.email);
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipients,
        subject: `Bug Priority updated - Bug ID: ${bug.bugId}`,
        text: `Dear team,

The priority of the following bug has been updated.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
New Priority: ${priority}

Please check your dashboard for moredetails.`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending reques email", emailError.message);
      }

      res.status(200).json({
        message: "Priority updated successfully.",
        bug: updatedBug,
      });
    } catch (error) {
      console.error("Error ", error);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Update the status of the bug
router.put(
  "/update-status",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkIfPriorityIsSet,
  async (req, res) => {
    try {
      const { bugId, status, reason } = req.body;
      const updatedByEmail = req.user.email;
      console.log("update status");
      if (!bugId || !status) {
        return res
          .status(400)
          .json({ message: "bugId and status are required" });
      }

      const user = await User.findOne({ email: updatedByEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      // Check if the bug exists
      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ message: "Bug not found." });
      }

      const { application, assignedTeam, reportedBy, priority } = bug;
      const currentStatus = bug.status;

      //All valid statuses
      const validStatuses = [
        "Open",
        "Assigned",
        "Fix In Progress",
        "Fixed (Testing Pending)",
        "Tester Assigned",
        "Testing In Progress",
        "Tested & Verified",
        "Closed",
        "Reassigned",
        "Duplicate",
        "Ready For Closure",
      ];

      console.log(status);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          message: `Invalid status. Available - ${validStatuses.join(", ")}`,
        });
      }

      //Only allow 'Open' if current status is 'Closed'
      if (status === "Open" && currentStatus !== "Closed") {
        return res.status(403).json({
          message:
            "Status only can be changed to 'Open' if the current status is 'Closed'.",
        });
      }

      //Validate developer statuses
      const devRequiredStatuses = [
        "Assigned",
        "Fix In Progress",
        "Fixed (Testing Pending)",
      ];

      //Validate tester statuses
      const testerRequiredStatuses = [
        "Tester Assigned",
        "Testing In Progress",
        "Tested & Verified",
      ];

      //Check if developer is assigned when required
      if (devRequiredStatuses.includes(status) && !bug.assignedTo?.developer) {
        return res.status(400).json({
          message: `Developer should be asisgned before selecting status - '${status}'.`,
        });
      }

      //Check if tester is assigned when required
      if (testerRequiredStatuses.includes(status) && !bug.assignedTo?.tester) {
        return res.status(400).json({
          message: `Tester should be asisgned before selecting this status - ${status}'.`,
        });
      }

      //Role based access (Only allow admin, team lead, develoepr or the tester of the team the bug is assigned to)
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );
      const isDeveloper = user.roles.some(
        (role) =>
          role.role === "developer" &&
          role.application === application &&
          role.team === assignedTeam
      );
      const isTester = user.roles.some(
        (role) =>
          role.role === "tester" &&
          role.application === application &&
          role.team === assignedTeam
      );

      if (!isAdmin && !isTeamLead && !isDeveloper && !isTester) {
        return res.status(403).json({
          message:
            "Unauthorized action. You role does not allow to update status. Either your role in the application is not sufficient to update the status of the bug or you are not associated ot the team the bug is assigned to",
        });
      }

      //Prevent manually setting "Ready For Closure"
      if (!isTester && status === "Ready For Closure") {
        return res.status(403).json({
          message:
            "Only testers can move critical bugs to 'Ready For Closure'. Admin or Team Lead can move it to 'Closed'",
        });
      }

      //Role specific status update permissions
      const developerAllowedStatuses = [
        "Fix In Progress",
        "Fixed (Testing Pending)",
      ];
      const testerAllowedStatuses = [
        "Testing In Progress",
        "Tested & Verified",
        "Ready For Closure",
        "Closed",
        "Fix In Progress",
      ];

      const allowedStatusChanges = [
        { from: "Open", to: "Assigned" },
        { from: "Assigned", to: "Fix In Progress" },
        { from: "Fix In Progress", to: "Fixed (Testing Pending)" },
        { from: "Fixed (Testing Pending)", to: "Tester Assigned" },
        { from: "Tester Assigned", to: "Testing In Progress" },
        { from: "Testing In Progress", to: "Tested & Verified" },
        { from: "Tested & Verified", to: "Closed" },
        { from: "Testing In Progress", to: "Fix In Progress" },
        { from: "Reassigned", to: "Assigned" },
      ];
      let isValidForwardChange = isAdmin || isTeamLead;
      // Check if the status update follows the correct sequence
      if (!isAdmin && !isTeamLead) {
        isValidForwardChange = allowedStatusChanges.some(
          (change) => change.from === currentStatus && change.to === status
        );
      }

      //Allow testers to move critical bugs from "Tested & Verified" to "Ready For Closure"
      const isTesterSubmittingCriticalClosure =
        isTester &&
        priority === "Critical" &&
        currentStatus === "Tested & Verified" &&
        status === "Ready For Closure";

      if (isTesterSubmittingCriticalClosure) {
        isValidForwardChange = true;
      }

      //Get the latest status entry
      const changeHistory = bug.changeHistory || [];
      const statusChangeEntries = changeHistory.filter(
        (entry) => entry.type === "Status Change"
      );

      const lastStatusEntry =
        statusChangeEntries.length > 0
          ? statusChangeEntries[statusChangeEntries.length - 1]
          : null;

      //Check if the user is trying to revert to the exact previous state (not any prev stuas) within 15 minutes
      const isValidRevert =
        lastStatusEntry &&
        lastStatusEntry.newStatus === currentStatus && //current status - in the bug report currently
        lastStatusEntry.previousStatus === status && // status - change requested
        lastStatusEntry.changedBy === req.user.email &&
        new Date() - new Date(lastStatusEntry.changedOn) < 15 * 60 * 1000;

      if (!isAdmin && !isTeamLead) {
        if (isDeveloper && !developerAllowedStatuses.includes(status)) {
          if (!isValidRevert) {
            return res.status(403).json({
              message:
                "Developers can only update to Fix In Progress or Fixed (Testing Pending)",
            });
          }
        }

        if (isTester && !testerAllowedStatuses.includes(status)) {
          if (!isValidRevert) {
            return res.status(403).json({
              message:
                "Testers can only update to Testing In Progress, Closed or Fix In Progress or Pending Approva (Ready For Closure)(if critical)",
            });
          }
        }

        // If neither a valid forward change nor a valid revert
        if (!isValidForwardChange && !isValidRevert) {
          return res.status(403).json({
            message: `Invalid change of status from ${currentStatus} to ${status} either because status changed to same state or the forward change to the selected status not possibel or reverting of status update can happen only within 15 mins post status update`,
          });
        }
      }

      // If the bug is critical and the status is "Closed" (not updated by admin or team lead) then approval is required
      if (!isAdmin && !isTeamLead) {
        if (
          priority === "Critical" &&
          status === "Ready For Closure" &&
          isTester &&
          !isAdmin &&
          !isTeamLead
        ) {
          //Find email id of the team lead in whose team the buf is assigned to
          const teamLead = await User.findOne({
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "teamlead",
          }).select("email");

          const adminEmail = "adm1n.bugtrackr@gmail.com";
          const recipients = teamLead
            ? [teamLead.email, adminEmail]
            : [adminEmail];

          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          //Email notification for approval of critical bugs
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipients,
            subject: `Approval Required for bug closure - Bug ID: ${bug.bugId}`,
            text: `Dear Team Lead and Admin,

A tester has marked a critical bug as closed and requires approval.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}

Please approve or reject the closure by visiting the application.
`,
          };

          try {
            await transporter.sendMail(mailOptions);
          } catch (emailError) {
            console.error("Error sending reques email", emailError.message);
          }

          const updatedBug = await BugReport.findOneAndUpdate(
            { bugId },
            {
              status: "Ready For Closure",
              statusLastUpdated: new Date(),
              statusReason: reason || null,
              $push: {
                changeHistory: {
                  type: "Status Change",
                  previousStatus: currentStatus,
                  newStatus: "Ready For Closure",
                  changedOn: new Date(),
                  changedBy: req.user?.email,
                  changedByRole: "tester",
                  reason: reason || null,
                },
              },
            },
            { new: true }
          );
          return res.status(200).json({
            message:
              "Since the bug is critical, status updated to Ready For Closure. Request sent to team lead and admin.",
            bug: updatedBug,
          });
        }
      }
      const userRole = isAdmin
        ? "admin"
        : isTeamLead
        ? "teamlead"
        : isDeveloper
        ? "developer"
        : isTester
        ? "tester"
        : "user";

      const updateFields = {
        status,
        statusLastUpdated: new Date(),
        statusReason: reason || null,
        $push: {
          changeHistory: {
            type: "Status Change",
            previousStatus: currentStatus,
            newStatus: status,
            changedOn: new Date(),
            changedBy: req.user?.email,
            changedByRole: userRole,
            reason: reason || null,
          },
        },
      };

      //if the developer moves the bug back to Fix In Progress within the 15mins window
      if (
        currentStatus === "Fixed (Testing Pending)" &&
        status === "Fix In Progress" &&
        isDeveloper &&
        bug.developerResolutionHours
      ) {
        await User.updateOne(
          {
            email: bug.assignedTo?.developer,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          {
            $inc: {
              "roles.$.workloadHours": bug.developerResolutionHours,
            },
          }
        );
        bug.developerResolutionHours = undefined;
        await bug.save();
      }
      //Get and chcek developer's resolution hours
      if (status === "Fixed (Testing Pending)" && isDeveloper) {
        const { developerResolutionHours } = req.body;

        if (
          developerResolutionHours === undefined ||
          isNaN(developerResolutionHours) ||
          developerResolutionHours <= 0
        ) {
          return res.status(400).json({
            message: `Please provide valid positive number for hours worked by opening the bug and choosing the "Fixed (Testing Pending)"`,
          });
        }

        updateFields.developerResolutionHours = developerResolutionHours;
        //Reduce developer workload
        await User.updateOne(
          {
            email: bug.assignedTo?.developer,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          {
            $inc: {
              "roles.$.workloadHours": -developerResolutionHours,
            },
          }
        );

        if (bug.assignedTo?.tester !== "" && bug.assignedTo?.tester !== null) {
          console.log("============" + bug.assignedTo?.tester);
          updateFields.status = "Tester Assigned";
          await bug.save();
        }
      }
      //if the tester moves the bug back to Testing In Progress within the 15mins window

      if (
        currentStatus === "Tested & Verified" &&
        status === "Testing In Progress" &&
        isTester &&
        bug.testerValidationHours
      ) {
        await User.updateOne(
          {
            email: bug.assignedTo?.tester,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "tester",
          },
          {
            $inc: {
              "roles.$.workloadHours": bug.testerValidationHours,
            },
          }
        );
        bug.testerValidationHours = undefined;
        await bug.save();
      }

      const estimatedDevHours = PRIORITY_DEVELOPER_HOURS[priority];
      const estimatedTesterHours = PRIORITY_DEVELOPER_HOURS[priority];

      //Restore developer workload if moved bug back to Fix In Progress
      if (
        currentStatus === "Testing In Progress" &&
        status === "Fix In Progress" &&
        bug.developerResolutionHours
      ) {
        console.log("estimatedDevHours" + estimatedDevHours);

        await User.updateOne(
          {
            email: bug.assignedTo?.developer,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          {
            $inc: {
              "roles.$.workloadHours": estimatedDevHours,
            },
          }
        );
        bug.developerResolutionHours = undefined;
        await bug.save();
      }

      //Get and chcek tester's validation hours
      if (status === "Tested & Verified" && isTester) {
        const { testerValidationHours } = req.body;

        console.log(testerValidationHours);
        if (
          testerValidationHours === undefined ||
          isNaN(testerValidationHours) ||
          testerValidationHours <= 0
        ) {
          return res.status(400).json({
            message: `Please provide valid positive number for hours worked by opening the bug and choosing the "Tested & Verified"`,
          });
        }

        updateFields.testerValidationHours = testerValidationHours;
        //Reduce tester workload
        await User.updateOne(
          {
            email: bug.assignedTo?.tester,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "tester",
          },
          {
            $inc: {
              "roles.$.workloadHours": -testerValidationHours,
            },
          }
        );
      }

      //Non critical bug status update in the database
      const updatedBug = await BugReport.findOneAndUpdate(
        { bugId },
        updateFields,
        { new: true }
      );

      //To add bug report as embedding to the FAISS priority index after bug is closed (to be used in priority classification)
      if (status === "Closed" && bug?.priority) {
        try {
          await axios.post(`${process.env.ML_SERVICE_URL || "http://localhost:8000"}/add-priority-embedding`, {
            application: bug.application,
            bugId: bug.bugId,
            title: bug.title,
            description: bug.description,
            stepsToReproduce: bug.stepsToReproduce,
            userSteps: bug.userSteps,
          }, {
            headers: { "x-similarity-key": process.env.SIMILARITY_API_KEY },
          });
          console.log("closed bug emdbing added");
        } catch (err) {
          console.error("Error ", err.message);
        }
      }

      //Notify team lead and admin if status is changed to "Fixed (Testing Pending)"
      if (status === "Fixed (Testing Pending)") {
        const teamLead = await User.findOne({
          "roles.application": application,
          "roles.team": assignedTeam,
          "roles.role": "teamlead",
        }).select("email");

        const adminEmail = "adm1n.bugtrackr@gmail.com";
        const recipients = teamLead
          ? [teamLead.email, adminEmail]
          : [adminEmail];

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: recipients,
          subject: `Bug Status Update: Bug id ${bug.bugId} marked as Fixed (Testing Pending)`,
          text: `Dear Team Lead/Admin,

The following bug has been marked as "Fixed (Testing Pending)".

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Assigned Team: ${assignedTeam}

Please assigned tester promptly.
`,
        };

        try {
          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error(
            "Error sending Fixed (Testing Pending) email",
            emailError.message
          );
        }
      }

      if (status === "Closed" && currentStatus === "Assigned") {
        await User.updateOne(
          {
            email: bug.assignedTo?.developer,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          {
            $inc: {
              "roles.$.workloadHours": -estimatedDevHours,
            },
          }
        );
      }

      if (status === "Closed" && currentStatus === "Tester Assigned") {
        await User.updateOne(
          {
            email: bug.assignedTo?.tester,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "tester",
          },
          {
            $inc: {
              "roles.$.workloadHours": -estimatedTesterHours,
            },
          }
        );
      }
      if (status === "Closed") {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        //Email notification on bug closure
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: reportedBy.email,
          subject: `Bug Report update - Bug ID: ${bug.bugId}`,
          text: `Dear ${reportedBy.name},

Your bug report has been marked as Closed.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Final Status: ${status}

Thank you for your report. If you believe this is incorrect, please write an email to adm1n.bugtrackr@gmail.com.
`,
        };

        try {
          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error("Error sending email", emailError.message);
        }
      }

      res
        .status(200)
        .json({ message: "Bug status updated successfully", bug: updatedBug });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Update hours by developer and tester (if bug status is moved by admin or team lead)
router.put("/:bugId/update-hours", authenticateUser, async (req, res) => {
  const { bugId } = req.params;
  const { application, assignedTeam, hoursWorked } = req.body;
  const updatedByEmail = req.user.email;

  if (!bugId) {
    return res.status(400).json({
      message: "bugId is required.",
    });
  }

  if (typeof hoursWorked !== "number" || hoursWorked < 0) {
    return res.status(400).json({
      error: "Invalid hours worked. Please enter a valid positive number",
    });
  }

  const user = await User.findOne({ email: updatedByEmail });
  if (!user) {
    return res.status(401).json({
      error: "User does not exist in the database",
    });
  }

  const bug = await BugReport.findOne({ bugId });
  if (!bug) return res.status(404).json({ error: "Bug not found" });

  try {
    const isDeveloper = user.roles.some(
      (role) =>
        role.role === "developer" && bug.assignedTo.developer === updatedByEmail
    );
    const isTester = user.roles.some(
      (role) =>
        role.role === "tester" && bug.assignedTo.tester === updatedByEmail
    );

    const isAuthorized =
      (isDeveloper && bug.assignedTo?.developer === updatedByEmail) ||
      (isTester && bug.assignedTo?.tester === updatedByEmail);

    if (!isAuthorized) {
      return res
        .status(403)
        .json({ error: "You are not assigned to this bug" });
    }

    //Update the correct field
    if (isDeveloper) {
      const oldHours = bug.developerResolutionHours || 0;
      const workloadAdjustment = oldHours - hoursWorked;
      console.log(workloadAdjustment);
      await User.updateOne(
        {
          email: updatedByEmail,
          "roles.application": application,
          "roles.team": assignedTeam,
          "roles.role": "developer",
        },
        {
          $inc: { "roles.$.workloadHours": workloadAdjustment },
        }
      );
      bug.developerResolutionHours = hoursWorked;
    } else if (isTester) {
      const oldHours = bug.testerValidationHours || 0;
      const workloadAdjustment = oldHours - hoursWorked;

      await User.updateOne(
        {
          email: updatedByEmail,
          "roles.application": application,
          "roles.team": assignedTeam,
          "roles.role": "tester",
        },
        {
          $inc: { "roles.$.workloadHours": workloadAdjustment },
        }
      );
      bug.testerValidationHours = hoursWorked;
    }

    await bug.save();

    res.json({ message: "Workload hours updated successfully", bug });
  } catch (err) {
    console.error("Error ", err);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});
//Mark a bug report as duplicate
router.put(
  "/mark-duplicate",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const { bugId, originalBugId, duplicateExplanation } = req.body;
      const userEmail = req.user.email;
      console.log("sdjnfkd" + originalBugId + "sjdfs");
      if (!bugId || !originalBugId || !duplicateExplanation) {
        return res.status(400).json({
          error: "Bug id, original bug id and explanation are required.",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ message: "Bug not found." });
      }
      console.log(bug);

      const originalBug = await BugReport.findOne({ bugId: originalBugId });
      if (!originalBug) {
        return res.status(404).json({ message: "Original Bug not found." });
      }

      const { application, assignedTeam, assignedTo } = bug;

      //Verify that the person marking the bug as duplicate is a developer, tester, team lead or an admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );

      const isDeveloper = user.roles.some(
        (role) =>
          role.role === "developer" && assignedTo.developer === userEmail
      );
      const isTester = user.roles.some(
        (role) => role.role === "tester" && assignedTo.tester === userEmail
      );

      if (!isAdmin && !isTeamLead && !isDeveloper && !isTester) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be a developer, tester, team lead or an admin to get bugs assigned to a team",
        });
      }

      // Check if the bug is already marked as duplicate
      if (bug.isDuplicate) {
        return res.status(400).json({
          error: "Bug is already marked as a duplictae",
        });
      }

      // Developer and tester can only mark bugs assigned to them
      if (isDeveloper && assignedTo.developer !== userEmail) {
        return res.status(403).json({
          error:
            "Unauthorized. You can only mark bugs assigned to you as duplictae",
        });
      }

      if (isTester && assignedTo.tester !== userEmail) {
        return res.status(403).json({
          error:
            "Unauthorized. You can only mark bugs assigned to you as duplictae.",
        });
      }

      const userRole = isAdmin
        ? "admin"
        : isTeamLead
        ? "teamlead"
        : isDeveloper
        ? "developer"
        : isTester
        ? "tester"
        : "user";

      //Get previous status and update duplciate details
      const previousStatus = bug.status;
      bug.isDuplicate = true;
      bug.originalBugId = originalBugId;
      bug.duplicateExplanation = duplicateExplanation;
      bug.status = "Duplicate";
      (bug.statusLastUpdated = new Date()),
        bug.changeHistory.push({
          type: "Duplicate Mark",
          previousStatus: previousStatus,
          newStatus: "Duplicate",
          changedOn: new Date(),
          changedBy: userEmail,
          changedByRole: userRole,
          reason: `Marked duplicate of ${originalBugId}. Explanation - ${duplicateExplanation}`,
        });

      const estimatedDevHours = PRIORITY_DEVELOPER_HOURS[bug.priority];
      const estimatedTesterHours = PRIORITY_TESTER_HOURS[bug.priority];

      //Remove estimated hours from the developer workloadHours when marked as duplicate in "Assigned" status. If in "Fix In Progress" or in "Fixed (Testing Pending)" then some reasonable hours would have been spent so not reducing hours
      if (assignedTo?.developer && bug.status === "Assigned") {
        await User.updateOne(
          {
            email: assignedTo.developer,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          {
            $inc: { "roles.$.workloadHours": -estimatedDevHours },
          }
        );
      }

      //Remove estimated hours from the tester workloadHours when marked as duplicate in "Tester Assigned" status. If in "Testing In Progress" or in "Tested & Verified" then some reasonable hours would have been spent so not reducing hours
      if (assignedTo?.tester && bug.status === "Tester Assigned") {
        await User.updateOne(
          {
            email: assignedTo.tester,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "tester",
          },
          {
            $inc: { "roles.$.workloadHours": -estimatedTesterHours },
          }
        );
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const recipients = [];

      if (assignedTo?.developer) recipients.push(assignedTo.developer);

      if (assignedTo?.tester) recipients.push(assignedTo.tester);

      const teamLead = await User.findOne({
        "roles.application": application,
        "roles.team": assignedTeam,
        "roles.role": "teamlead",
      }).select("email");

      if (teamLead?.email) recipients.push(teamLead.email);

      recipients.push("adm1n.bugtrackr@gmail.com");

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: Array.from(recipients),
        subject: `Bug Marked as Duplicate - Bug ID: ${bug.bugId}`,
        text: `The following bug has been marked as a duplicate.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Marked Duplicate Of: ${originalBugId}
Explanation: ${duplicateExplanation}
Status: ${bug.status}

Marked by: ${userEmail}

Please check your dashboard for moredetails.`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending duplicate mark email", emailError.message);
      }

      await bug.save();

      res.status(200).json({
        message: "Bug marked as duplciate successfully.",
        bug,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Undo marking a bug report as duplicate
router.put(
  "/undo-duplicate",
  authenticateUser,
  checkIfBugIsClosed,
  async (req, res) => {
    try {
      const { bugId } = req.body;
      const userEmail = req.user.email;

      if (!bugId) {
        return res.status(400).json({
          error: "Bug id is required.",
        });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ message: "Bug not found." });
      }

      const { application, assignedTeam, assignedTo } = bug;

      //Verify that the person undoing the duplicate status is a developer, tester, team lead or an admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );

      const isDeveloper = user.roles.some(
        (role) =>
          role.role === "developer" && assignedTo.developer === userEmail
      );
      const isTester = user.roles.some(
        (role) => role.role === "tester" && assignedTo.tester === userEmail
      );

      if (!isAdmin && !isTeamLead && !isDeveloper && !isTester) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be a developer, tester, team lead or an admin to undo duplicate status.",
        });
      }

      // Check if the bug is actually marked as duplicate
      if (!bug.isDuplicate) {
        return res.status(400).json({
          error: "This bug is not marked as duplicate.",
        });
      }

      // Developer and tester can only undo duplicate assigned to them
      if (isDeveloper && assignedTo.developer !== userEmail) {
        return res.status(403).json({
          error:
            "Unauthorized. You can only undo duplicate status for bugs assigned to you.",
        });
      }

      if (isTester && assignedTo.tester !== userEmail) {
        return res.status(403).json({
          error:
            "Unauthorized. You can only undo duplicate status for bugs assigned to you.",
        });
      }

      const userRole = isAdmin
        ? "admin"
        : isTeamLead
        ? "teamlead"
        : isDeveloper
        ? "developer"
        : isTester
        ? "tester"
        : "user";

      //Undo duplcaite
      bug.isDuplicate = false;
      bug.originalBugId = null;
      bug.duplicateExplanation = null;

      //Since no update to bug is allowed after marking the bug report as duplciate, find the last 'Duplicate Mark' entry
      const lastChange = bug.changeHistory[bug.changeHistory.length - 1];

      if (
        lastChange.type === "Duplicate Mark" &&
        lastChange.newStatus === "Duplicate" &&
        lastChange.previousStatus
      ) {
        bug.status = lastChange.previousStatus;
      } else {
        bug.status = "Open";
      }
      (bug.statusLastUpdated = new Date()),
        bug.changeHistory.push({
          type: "Undo Duplicate",
          previousStatus: "Duplicate",
          newStatus: bug.status,
          changedOn: new Date(),
          changedBy: userEmail,
          changeByRole: userRole,
          reason: `Undo duplicate marking and reverted to previous status.`,
        });

      const estimatedDevHours = PRIORITY_DEVELOPER_HOURS[bug.priority];
      const estimatedTesterHours = PRIORITY_TESTER_HOURS[bug.priority];

      //Add estimated hours to the developer workloadHours when duplicate undone in "Assigned" status. If in "Fix In Progress" or in "Fixed (Testing Pending)" then some reasonable hours would have been spent so not adding hours as already worked on or being worked on
      if (assignedTo?.developer && bug.status === "Assigned") {
        await User.updateOne(
          {
            email: assignedTo.developer,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          {
            $inc: { "roles.$.workloadHours": estimatedDevHours },
          }
        );
      }

      //Add estimated hours to the developer workloadHours when duplicate undone in "Tester Assigned" status. If in "Testing In Progress" or in "Tested & Verified" then some reasonable hours would have been spent so not adding hours as already worked on or being worked on
      if (assignedTo?.tester && bug.status === "Tester Assigned") {
        await User.updateOne(
          {
            email: assignedTo.tester,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "tester",
          },
          {
            $inc: { "roles.$.workloadHours": estimatedTesterHours },
          }
        );
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const recipients = [];

      if (assignedTo?.developer) recipients.push(assignedTo.developer);

      if (assignedTo?.tester) recipients.push(assignedTo.tester);

      const teamLead = await User.findOne({
        "roles.application": application,
        "roles.team": assignedTeam,
        "roles.role": "teamlead",
      }).select("email");

      if (teamLead?.email) recipients.push(teamLead.email);

      recipients.push("adm1n.bugtrackr@gmail.com");

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: Array.from(recipients),
        subject: `Duplicate Status Undone - Bug ID: ${bug.bugId}`,
        text: `The following bug has been undone from duplicate status.

Bug ID: ${bug.bugId}
Title: ${bug.title}

Undo performed by: ${userEmail}

Please check your dashboard for moredetails`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending undo duplicate email", emailError.message);
      }

      await bug.save();

      res.status(200).json({
        message: "Bug duplicate status successfully undone.",
        bug,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Request reallocation of bug
router.put(
  "/request-reallocation",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const { bugId, reason } = req.body;
      const requesterEmail = req.user.email;
      const rsn = reason ? reason.trim().replace(/\r\n/g, "\n") : ""; // to replace the 2 characters added in the backend
      // for a new line entered in the frontend
      if (!bugId || !rsn) {
        return res.status(400).json({
          error: "Bug id and reason are required.",
        });
      }

      if (rsn.length < 10 || rsn.length > 100) {
        return res.status(400).json({
          error: "Reallocation reason must be between 10 and 100 chars.",
        });
      }

      const user = await User.findOne({ email: requesterEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ error: "Bug not found." });
      }

      if (!bug.reallocationRequests) {
        bug.reallocationRequests = { developer: [], tester: [] };
      }

      //Check if the person requesting reallocation is the developer or tester of the bug
      const { assignedTo } = bug;
      const isDeveloper = assignedTo.developer === requesterEmail;
      const isTester = assignedTo.tester === requesterEmail;
      const teamLead = await User.findOne({
        "roles.application": bug.application,
        "roles.team": bug.assignedTeam,
        "roles.role": "teamlead",
      }).select("email");

      if (!isDeveloper && !isTester) {
        return res.status(403).json({
          error:
            "Unauthorized. You can only request reallocation if you are assigned to the bug.",
        });
      }

      //Valid statuses for developer and tester reallocation (if the current status of the bug is not these then cannot submit request)
      const validDevStates = ["Assigned", "Fix In Progress"];
      const validTesterStates = ["Tester Assigned", "Testing In Progress"];

      // Check if the user is allowed to make a reallocation request based on status
      if (isDeveloper && !validDevStates.includes(bug.status)) {
        return res.status(403).json({
          error: `Reallocation can only be requested by developers when the bug status is oen of - ${validDevStates.join(
            ", "
          )}.`,
        });
      }

      if (isTester && !validTesterStates.includes(bug.status)) {
        return res.status(403).json({
          error: `Reallocation can only be requested by testers when the bug status is oen of - ${validTesterStates.join(
            ", "
          )}.`,
        });
      }

      //Check if there is a request by the developer or tester already
      const userRequests = isDeveloper
        ? bug.reallocationRequests.developer
        : bug.reallocationRequests.tester;

      const pendingRequest = userRequests.find(
        (request) =>
          request.requestedBy === requesterEmail &&
          request.requestStatus === "Pending"
      );

      if (pendingRequest) {
        return res.status(400).json({
          error:
            "You have already submitted a pending reallocation request for this bug. Please wait for it to be processed.",
        });
      }

      const reqObj = {
        requestedBy: requesterEmail,
        reason,
        requestStatus: "Pending",
        reviewedBy: null,
        reviewedOn: null,
      };

      if (isDeveloper) {
        bug.reallocationRequests.developer.push(reqObj);
      } else if (isTester) {
        bug.reallocationRequests.tester.push(reqObj);
      }

      bug.changeHistory.push({
        type: "Reallocation Request",
        changedOn: new Date(),
        changedBy: requesterEmail,
        changedByRole: isDeveloper ? "developer" : "tester",
        reallocationRequestDecision: "Pending",
        reason: reason,
      });

      await bug.save();
      //Send email notification to admin and the team lead
      const adminEmail = "adm1n.bugtrackr@gmail.com";
      const recipients = teamLead ? [teamLead.email, adminEmail] : [adminEmail];

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipients,
        subject: `Bug Reallocation Request - Bug id: ${bug.bugId}`,
        text: `Dear Team Lead/Admin,

${isDeveloper ? "Developer" : "Tester"} ${
          user.fullName
        } has requested reallocation for the following bug:

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${bug.application}
Reason: ${reason}

Please review and take appropriate action.
`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending email:", emailError.message);
      }
      res.status(200).json({
        message:
          "Reallocation request sent to team lead and admin for approval.",
        bug,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Fetch all reallocation requests
router.get("/reallocation-requests", authenticateUser, async (req, res) => {
  try {
    const requesterEmail = req.user.email;

    const user = await User.findOne({ email: requesterEmail });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    let application = null;
    let team = null;

    //Check if the person getting reallocation requests is the team lead or admin
    const isAdmin = user.roles.some((role) => role.role === "admin");

    const teamLeadRole = user.roles.find((role) => role.role === "teamlead");

    if (teamLeadRole) {
      application = teamLeadRole.application;
      team = teamLeadRole.team;
    }

    const isTeamLead = teamLeadRole ? true : false;
    const isDevOrTester = user.roles.some(
      (role) => role.role === "developer" || role.role === "tester"
    );
    if (!isAdmin && !isTeamLead && !isDevOrTester) {
      return res.status(403).json({
        error:
          "Unauthorized. You must be a developer,  tester, team lead or an admin to get reallocation requests",
      });
    }

    let query = {};

    //If admin, allow getting all requests
    if (isAdmin) {
      query = {
        $or: [
          { "reallocationRequests.developer": { $exists: true, $ne: [] } },
          { "reallocationRequests.tester": { $exists: true, $ne: [] } },
        ],
      };
    } else if (isTeamLead) {
      //If team lead, only allow getting  requests from their team
      query = {
        application: application,
        assignedTeam: team,
        $or: [
          { "reallocationRequests.developer": { $exists: true, $ne: [] } },
          { "reallocationRequests.tester": { $exists: true, $ne: [] } },
        ],
      };
    } else if (isDevOrTester) {
      // If developers/testers, get bugs where they have submitted a request
      query = {
        $or: [
          { "reallocationRequests.developer.requestedBy": requesterEmail },
          { "reallocationRequests.tester.requestedBy": requesterEmail },
        ],
      };
    }

    const bugs = await BugReport.find(query);

    if (!bugs.length) {
      return res
        .status(404)
        .json({ error: "No reallocation requests were found" });
    }
    //For dev/tester, group only their own requests with bug info
    if (isDevOrTester && !isAdmin && !teamLeadRole) {
      const userRequests = [];

      bugs.forEach((bug) => {
        const bugInfo = {
          bugId: bug.bugId,
          title: bug.title,
          description: bug.description,
          priority: bug.priority,
          status: bug.status,
        };

        // Get all reallocation requests for this bug
        const devRequests = bug.reallocationRequests?.developer || [];
        const testerRequests = bug.reallocationRequests?.tester || [];

        const allRequests = [...devRequests, ...testerRequests];

        allRequests.forEach((request) => {
          //If the request was made by the person trying to get the reallocaiton requests, add it to the list
          if (request.requestedBy === requesterEmail) {
            userRequests.push({
              ...bugInfo,
              requestStatus: request.requestStatus,
              reason: request.reason,
            });
          }
        });
      });

      //Return back just the requests made by this user
      return res.status(200).json({ reallocationRequests: userRequests });
    }
    //For team leads/admins, group bugs by application and assigned team
    const bugsBasedOnAppAndTeam = {};

    bugs.forEach((bug) => {
      const app = bug.application;
      const team = bug.assignedTeam;

      if (!bugsBasedOnAppAndTeam[app]) {
        bugsBasedOnAppAndTeam[app] = {};
      }
      if (!bugsBasedOnAppAndTeam[app][team]) {
        bugsBasedOnAppAndTeam[app][team] = [];
      }

      bugsBasedOnAppAndTeam[app][team].push(bug);
    });

    res.status(200).json({ bugs, bugsBasedOnAppAndTeam });
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

//Approve or reject Reallocation Request
router.put(
  "/approve-reject-reallocation",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const { bugId, requestId, action, developerEmail, testerEmail } =
        req.body;
      const reviewerEmail = req.user.email;

      if (!bugId || !requestId || !action) {
        return res
          .status(400)
          .json({ error: "Bug id, Request is and action are required." });
      }

      if (!["Approved", "Rejected"].includes(action)) {
        return res
          .status(400)
          .json({ error: "Action must be either 'Approved' or 'Rejected'." });
      }

      const user = await User.findOne({ email: reviewerEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database." });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ error: "Bug not found." });
      }

      const { application, assignedTeam } = bug;

      //Check if the person approving or rejecting request is the team lead or admin
      const isAdmin = user.roles.some((role) => role.role === "admin");

      const teamLeadRole = user.roles.find(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );

      const isTeamLead = teamLeadRole ? true : false;

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be a team lead or an admin to approve/reject reallocation request",
        });
      }

      const userRole = isTeamLead ? "teamlead" : "admin";
      const developerRequests = bug.reallocationRequests.developer || [];
      const testerRequests = bug.reallocationRequests.tester || [];

      //Get request entry
      let request = developerRequests.find(
        (req) => req._id.toString() === requestId
      );

      const isDevRequest = request ? true : false;
      if (!request) {
        request = testerRequests.find(
          (req) => req._id.toString() === requestId
        );
      }

      if (!request) {
        return res
          .status(404)
          .json({ error: "Reallocation request not found." });
      }

      if (request.requestStatus !== "Pending") {
        return res
          .status(400)
          .json({ error: "This request has already been reviewed." });
      }

      let reason;
      if (action === "Approved") {
        const currentDevEmail = bug.assignedTo?.developer;
        if (currentDevEmail) {
          const estimatedHours = PRIORITY_DEVELOPER_HOURS[bug.priority];

          await User.updateOne(
            {
              email: currentDevEmail,
              "roles.application": application,
              "roles.team": assignedTeam,
              "roles.role": "developer",
            },
            { $inc: { "roles.$.workloadHours": -estimatedHours } }
          );
        }

        if (isDevRequest && developerEmail) {
          const devUser = await User.findOne({
            email: developerEmail,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          });

          const currentHours =
            devUser?.roles?.find(
              (r) =>
                r.role === "developer" &&
                r.application === application &&
                r.team === assignedTeam
            )?.workloadHours || 0;

          const estimatedHours = PRIORITY_DEVELOPER_HOURS[bug.priority];

          if (currentHours + estimatedHours > 40) {
            bug.assignedTo.developer = null;
            bug.status = "Open";
            bug.statusLastUpdated = new Date();
            bug.changeHistory.push({
              type: "Assignment (Reallocation)",
              developer: null,
              changedBy: user.email,
              changedByRole: userRole,
              changedOn: new Date(),
              reason:
                "Reallocation approved, but selected developer is overloaded. Bug left unassigned.",
            });
            reason =
              "Reallocation approved, but selected developer is overloaded. Bug left unassigned";
          } else {
            bug.assignedTo.developer = developerEmail;
            bug.status = "Assigned";
            bug.statusLastUpdated = new Date();
            bug.changeHistory.push({
              type: "Assignment (Reallocation)",
              developer: developerEmail,
              changedBy: user.email,
              changedByRole: userRole,
              changedOn: new Date(),
              reason: "Developer assigned after reallocation approval",
            });

            await User.updateOne(
              {
                email: developerEmail,
                "roles.application": application,
                "roles.team": assignedTeam,
                "roles.role": "developer",
              },
              { $inc: { "roles.$.workloadHours": estimatedHours } }
            );
          }
        }
      }
      if (!isDevRequest && testerEmail) {
        const currentTesterEmail = bug.assignedTo?.tester;
        if (currentTesterEmail) {
          const estimatedHours = PRIORITY_TESTER_HOURS[bug.priority];

          await User.updateOne(
            {
              email: currentTesterEmail,
              "roles.application": application,
              "roles.team": assignedTeam,
              "roles.role": "tester",
            },
            { $inc: { "roles.$.workloadHours": -estimatedHours } }
          );
        }

        const testerUser = await User.findOne({
          email: testerEmail,
          "roles.application": application,
          "roles.team": assignedTeam,
          "roles.role": "tester",
        });

        const currentTesterHours =
          testerUser?.roles?.find(
            (r) =>
              r.role === "tester" &&
              r.application === application &&
              r.team === assignedTeam
          )?.workloadHours || 0;

        const estimatedTesterHours = PRIORITY_TESTER_HOURS?.[bug.priority] || 0;

        if (currentTesterHours + estimatedTesterHours > 40) {
          bug.assignedTo.tester = null;
          bug.changeHistory.push({
            type: "Assignment (Reallocation)",
            tester: null,
            changedBy: user.email,
            changedByRole: userRole,
            changedOn: new Date(),
            reason:
              "Reallocation approved, but selected tester is overloaded. Tester left unassigned.",
          });
          reason =
            "Reallocation approved, but selected developer is overloaded. Bug left unassigned";
        } else {
          bug.assignedTo.tester = testerEmail;
          if (bug.status === "Fixed (Testing Pending)") {
            bug.status = "Tester Assigned";
          }
          bug.statusLastUpdated = new Date();
          bug.changeHistory.push({
            type: "Assignment (Reallocation)",
            tester: testerEmail,
            changedBy: user.email,
            changedByRole: userRole,
            changedOn: new Date(),
            reason: "Tester manually assigned after reallocation approval",
          });

          await User.updateOne(
            {
              email: testerEmail,
              "roles.application": application,
              "roles.team": assignedTeam,
              "roles.role": "tester",
            },
            { $inc: { "roles.$.workloadHours": estimatedTesterHours } }
          );
        }
      }
      // Update request details
      request.requestStatus = action;
      request.reviewedBy = reviewerEmail;
      request.reviewedOn = new Date();

      bug.changeHistory.push({
        type: "Reallocation Request Decision",
        changedOn: new Date(),
        changedBy: user.email,
        changedByRole: isTeamLead ? "teamlead" : "admin",
        reason: request.reason,
        reallocationRequestDecision: action,
        requestId: request._id,
      });

      await bug.save();
      if (reason && reason.length > 0) {
        res.status(200).json({
          message: `Reallocation request ${action} successfully. ${reason}`,
          bug,
        });
      } else {
        res.status(200).json({
          message: `Reallocation request ${action} successfully.`,
          bug,
        });
      }
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);
//Synonym based search - Commented because it did not give proper results like the sentence transformers approach - cirrent implementation
// router.get("/search", authenticateUser, async (req, res) => {
//   try {
//     const { query } = req.query;

//     const expandedKeywords = await expandSearchQueryWithSynonyms(query);

//     const searchConditions = expandedKeywords.map((word) => ({
//       $or: [
//         { title: { $regex: word, $options: "i" } }, //options i - case insensivtive
//         { description: { $regex: word, $options: "i" } },
//       ],
//     }));

//     const results = await BugReport.find({ $or: searchConditions }); //"or" here include all words individually not strictly match for all words

//     if (!results.length) {
//       return res.status(200).json({ message: "No matching bugs found." });
//     }

//     res.status(200).json({ bugs: results });
//   } catch (error) {
//     console.error("Error ", error.message);
//     res.status(500).json({ error: "Server error", details: error.message });
//   }
// });

//Reopen a closed bug
router.put(
  "/reopen-bug",
  authenticateUser,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      console.log(req.body);
      const { bugId, reason } = req.body;
      const requesterEmail = req.user.email;
      const rsn = reason ? reason.trim().replace(/\r\n/g, "\n") : ""; // to replace the 2 characters added in the backend
      // for a new line entered in the frontend
      if (!bugId || !rsn) {
        return res.status(400).json({
          message: "Bug id and a valid reason are required.",
        });
      }

      if (rsn.length < 10 || rsn.length > 100) {
        return res.status(400).json({
          error: "reopen reason must be between 10 and 100 chars.",
        });
      }

      const user = await User.findOne({ email: requesterEmail });
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ error: "Bug not found" });
      }

      if (!bug.reopenRequests) {
        bug.reopenRequests = [];
      }

      //Check if the person requesting reopening is the admin, team lead, developer or tester of the bug
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === bug.application &&
          role.team === bug.assignedTeam
      );
      const teamLead = await User.findOne({
        "roles.application": bug.application,
        "roles.team": bug.assignedTeam,
        "roles.role": "teamlead",
      }).select("email");

      const isDeveloper = bug.assignedTo?.developer === requesterEmail;
      const isTester = bug.assignedTo?.tester === requesterEmail;

      //Cehck if the bug is already reopened once before
      if ((isDeveloper || isTester) && bug.reopened) {
        return res.status(400).json({
          error:
            "This bug has already been reopened once and cannot be reopened again. If needed please report a new bug.",
        });
      }

      //Check if the bug is in the "Closed" status
      if (bug.status !== "Closed") {
        return res
          .status(400)
          .json({ error: "Bug is not in 'Closed' status." });
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      //If developer or tester requests reopening
      if (isDeveloper || isTester) {
        const lastChange = bug.changeHistory?.[bug.changeHistory.length - 1];
        console.log("lastChange" + lastChange);
        const isLastStatusClosed =
          (lastChange?.type === "Status Change" ||
            lastChange?.type === "Reopen Request Decision") &&
          lastChange?.newStatus === "Closed";

        if (!isLastStatusClosed) {
          return res.status(400).json({
            error: "Reopen request denied. The bug was not recently closed.",
          });
        }

        const closedDate = new Date(lastChange.changedOn);
        const now = new Date();
        const diffInDays = (now - closedDate) / (1000 * 60 * 60 * 24);

        if (diffInDays > 7) {
          return res.status(400).json({
            error:
              "You can only request to reopen a bug within 7 days of its closure.",
          });
        }

        //Check if there is a request by the developer or tester already
        if (!bug.reopenRequests) bug.reopenRequests = [];

        const pendingRequest = bug.reopenRequests.find(
          (req) =>
            req.requestedBy === requesterEmail &&
            req.requestStatus === "Pending"
        );

        if (pendingRequest) {
          return res.status(400).json({
            error:
              "You have already submitted a reopen request for this bug. Please wait for it to be processed.",
          });
        }

        bug.reopenRequests.push({
          requestedBy: requesterEmail,
          role: isDeveloper ? "developer" : "tester",
          requestStatus: "Pending",
          reason: reason,
          requestedOn: new Date(),
        });
        console.log(bug.reopenRequests);

        bug.changeHistory.push({
          type: "Reopen Request",
          changedOn: new Date(),
          changedBy: requesterEmail,
          changedByRole: isDeveloper ? "developer" : "tester",
          reopenRequestdecision: "Pending",
          reason: reason,
        });

        await bug.save();

        //Send email notification to admin and the team lead
        const adminEmail = "adm1n.bugtrackr@gmail.com";
        const recipients = teamLead
          ? [teamLead.email, adminEmail]
          : [adminEmail];

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: recipients,
          subject: `Bug Reopen Request - Bug id: ${bug.bugId}`,
          text: `Dear Team Lead/Admin,

${isDeveloper ? "Developer" : "Tester"} ${
            user.fullName
          } has requested to reopen the following bug:

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${bug.application}
Reason: ${reason}

Please review and take appropriate action.
`,
        };

        try {
          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error("Error sending email:", emailError.message);
        }

        return res.status(200).json({
          message: "Reopen request sent to team lead and admin for approval.",
        });
      }

      const userRole = isAdmin
        ? "admin"
        : isTeamLead
        ? "teamlead"
        : isDeveloper
        ? "developer"
        : isTester
        ? "tester"
        : "";
      //If admin or team lead, can directly reopen
      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be an admin, team lead to reopen the bug directly.",
        });
      }
      bug.status = "Open";

      //Check if original developer can be reassigned
      const priority = bug.priority;
      const assignedDevEmail = bug.assignedTo?.developer;

      if (assignedDevEmail) {
        const devUser = await User.findOne({
          email: assignedDevEmail,
          "roles.application": bug.application,
          "roles.team": bug.assignedTeam,
          "roles.role": "developer",
        });

        const currentWorkload =
          devUser?.roles.find(
            (r) =>
              r.role === "developer" &&
              r.application === bug.application &&
              r.team === bug.assignedTeam
          )?.workloadHours || 0;

        console.log("userRole =============== " + userRole);
        console.log("currentWorkload =============== " + currentWorkload);
        if (currentWorkload + PRIORITY_DEVELOPER_HOURS[priority] <= 40) {
          bug.assignedTo.developer = assignedDevEmail;
          bug.status = "Assigned";
          bug.statusLastUpdated = new Date();
          bug.changeHistory.push({
            type: "Assignment",
            developer: assignedDevEmail,
            changedOn: new Date(),
            changedBy: requesterEmail,
            changedByRole: userRole,
            reason: "Reassigned after reopen",
          });
          await User.updateOne(
            {
              email: assignedDevEmail,
              "roles.application": bug.application,
              "roles.team": bug.assignedTeam,
              "roles.role": "developer",
            },
            {
              $inc: {
                "roles.$.workloadHours": PRIORITY_DEVELOPER_HOURS[priority],
              },
            }
          );
        } else {
          //Fallback to auto assign
          const dev = await assignDeveloper(
            bug.application,
            bug.assignedTeam,
            priority
          );
          console.log(dev);
          if (dev) {
            bug.assignedTo.developer = dev.email;
            bug.status = "Assigned";
            bug.statusLastUpdated = new Date();
            bug.changeHistory.push({
              type: "Assignment",
              developer: dev.email,
              changedOn: new Date(),
              changedBy: requesterEmail,
              changedByRole: userRole,
              reason: "Auto-assigned during reopen (previous dev overloaded)",
            });
          } else {
            bug.assignedTo.developer = null;
            bug.status = "Open";
          }
        }
      }

      bug.statusLastUpdated = new Date();
      bug.reopened = true;

      bug.changeHistory.push({
        type: `Reopen by ${isAdmin ? "admin" : "teamlead"}`,
        previousStatus: "Closed",
        newStatus: "Open",
        changedOn: new Date(),
        changedBy: requesterEmail,
        changedByRole: userRole,
        reason: rsn,
      });

      await bug.save();

      //Send email notification to admin and the team lead
      const recipients = [];
      if (bug.assignedTo?.developer) recipients.push(bug.assignedTo.developer);
      if (bug.assignedTo?.tester) recipients.push(bug.assignedTo.tester);
      if (teamLead) recipients.push(teamLead.email);
      recipients.push("adm1n.bugtrackr@gmail.com");

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: [...recipients],
        subject: `Bug Reopened - Bug ID: ${bug.bugId}`,
        text: `Dear Team,

The following bug has been reopened:

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${bug.application}
Reason: ${reason}
Assigned To: ${bug.assignedTo?.developer}

Please check your dashboard for moredetails.
`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending email:", emailError.message);
      }

      return res.status(200).json({
        message: "Bug reopened successfully and email notifications sent.",
        bug,
      });
    } catch (error) {
      console.error("Error ", error.message);
      return res
        .status(500)
        .json({ error: "Server Error", details: error.message });
    }
  }
);

// Approve or reject Reopen Request
router.put(
  "/approve-reject-reopen",
  authenticateUser,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const { bugId, requestId, action } = req.body;
      const reviewerEmail = req.user.email;

      if (!bugId || !requestId || !action) {
        return res
          .status(400)
          .json({ error: "Bug id, request is and action are required." });
      }

      if (!["Approved", "Rejected"].includes(action)) {
        return res
          .status(400)
          .json({ error: "Action must be either 'Approved' or 'Rejected'." });
      }

      const user = await User.findOne({ email: reviewerEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database." });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ error: "Bug not found." });
      }

      const { application, assignedTeam } = bug;

      if (bug.reopened) {
        return res.status(400).json({
          error:
            "This bug has already been reopened once and so this request cannot be processed.",
        });
      }

      //Check if the person approving or rejecting request is the team lead or admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const teamLeadRole = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === assignedTeam
      );

      const isTeamLead = teamLeadRole ? true : false;

      const userRole = isAdmin ? "admin" : isTeamLead ? "teamlead" : "user";
      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be a team lead or an admin to approve/reject reopen request",
        });
      }

      const request = bug.reopenRequests.find(
        (req) => req._id.toString() === requestId
      );

      if (!request) {
        return res.status(404).json({ error: "Reopen request not found." });
      }

      if (request.requestStatus !== "Pending") {
        return res
          .status(400)
          .json({ error: "This request has already been reviewed." });
      }

      // Update request details
      request.requestStatus = action;
      request.reviewedBy = reviewerEmail;
      request.reviewedOn = new Date();

      if (action === "Approved") {
        bug.status = "Open";
        bug.statusLastUpdated = new Date();

        //Check if original developer can be reassigned
        const priority = bug.priority;
        const assignedDevEmail = bug.assignedTo?.developer;

        if (assignedDevEmail) {
          const devUser = await User.findOne({
            email: assignedDevEmail,
            "roles.application": bug.application,
            "roles.team": bug.assignedTeam,
            "roles.role": "developer",
          });

          const currentWorkload =
            devUser?.roles.find(
              (r) =>
                r.role === "developer" &&
                r.application === bug.application &&
                r.team === bug.assignedTeam
            )?.workloadHours || 0;

          if (currentWorkload + PRIORITY_DEVELOPER_HOURS[priority] <= 40) {
            bug.assignedTo.developer = assignedDevEmail;
            bug.status = "Assigned";
            bug.statusLastUpdated = new Date();
            bug.changeHistory.push({
              type: "Assignment",
              developer: assignedDevEmail,
              changedOn: new Date(),
              changedBy: reviewerEmail,
              changedByRole: userRole,
              reason: "Reassigned after reopen",
            });
          } else {
            //Fallback to auto assign
            const dev = await assignDeveloper(
              bug.application,
              bug.assignedTeam,
              priority
            );

            if (dev) {
              bug.assignedTo.developer = dev.email;
              bug.status = "Assigned";
              bug.statusLastUpdated = new Date();
              bug.changeHistory.push({
                type: "Assignment",
                developer: dev.email,
                changedOn: new Date(),
                changedBy: reviewerEmail,
                changedByRole: userRole,
                reason: "Auto-assigned during reopen (previous dev overloaded)",
              });
            } else {
              bug.assignedTo.developer = null;
              bug.status = "Open";
            }
          }
        }

        bug.statusLastUpdated = new Date();
        bug.reopened = true;

        bug.changeHistory.push({
          type: `Reopen by ${
            isAdmin ? "admin" : "teamlead"
          } on request ${requestId}`,
          previousStatus: "Closed",
          newStatus: "Open",
          statusLastUpdated: new Date(),
          changedOn: new Date(),
          changedBy: reviewerEmail,
          changedByRole: isTeamLead ? "teamlead" : "admin",
          reason: request.reason,
        });
      }
      let newStatus = "Closed";

      if (action === "Approved") {
        if (bug.status === "Assigned") {
          newStatus = "Assigned";
        } else {
          newStatus = "Open";
        }
      }
      bug.changeHistory.push({
        type: "Reopen Request Decision",
        changedOn: new Date(),
        changedBy: reviewerEmail,
        changedByRole: isTeamLead ? "teamlead" : "admin",
        reason: request.reason,
        reopenRequestDecision: action,
        requestId: requestId,
        newStatus: newStatus,
      });

      await bug.save();

      return res.status(200).json({
        message: `Reopen request ${action} successfully.`,
        bug,
      });
    } catch (err) {
      console.error("Error ", err.message);
      return res
        .status(500)
        .json({ error: "Server error", details: err.message });
    }
  }
);

//Fetch all reopen requests
router.get("/reopen-requests", authenticateUser, async (req, res) => {
  try {
    const requesterEmail = req.user.email;

    const user = await User.findOne({ email: requesterEmail });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    let application = null;
    let team = null;

    //Check if the person getting reopen requests is the team lead or admin
    const isAdmin = user.roles.some((role) => role.role === "admin");

    const teamLeadRole = user.roles.find((role) => role.role === "teamlead");
    if (teamLeadRole) {
      application = teamLeadRole.application;
      team = teamLeadRole.team;
    }

    const isTeamLead = teamLeadRole ? true : false;
    const isDevOrTester = user.roles.some(
      (role) => role.role === "developer" || role.role === "tester"
    );

    if (!isAdmin && !isTeamLead && !isDevOrTester) {
      return res.status(403).json({
        error:
          "Unauthorized. You must be a developer,  tester, team lead or admin to get reopen requests.",
      });
    }

    let query = {};

    //If admin, allow getting all requests
    if (isAdmin) {
      query = {
        reopenRequests: { $exists: true, $ne: [] },
      };
    } else if (isTeamLead) {
      //If team lead, only allow getting  requests from their team
      query = {
        application: teamLeadRole.application,
        assignedTeam: teamLeadRole.team,
        reopenRequests: { $exists: true, $ne: [] },
      };
    } else if (isDevOrTester) {
      // If developers/testers, get bugs where they have submitted a request
      query = {
        "reopenRequests.requestedBy": requesterEmail,
      };
    }

    const bugs = await BugReport.find(query);

    if (!bugs.length) {
      return res.status(404).json({ error: "No reopen requests were found" });
    }

    //For dev/tester, group only their own requests with bug info
    if (isDevOrTester && !isAdmin && !teamLeadRole) {
      const userRequests = [];

      bugs.forEach((bug) => {
        const bugInfo = {
          bugId: bug.bugId,
          title: bug.title,
          description: bug.description,
          priority: bug.priority,
          status: bug.status,
        };

        //If the request was made by the person trying to get the reopen requests, add it to the list
        const ownRequests = bug.reopenRequests.filter(
          (req) => req.requestedBy === requesterEmail
        );

        ownRequests.forEach((req) => {
          userRequests.push({
            ...bugInfo,
            requestStatus: req.requestStatus,
            requestedBy: req.requestedBy,
            reason: req.reason,
          });
        });
      });

      //Return back just the requests made by this user
      return res.status(200).json({ reopenRequests: userRequests });
    }
    // For team lead/admins, group bugs by application and assigned team
    const bugsBasedOnAppAndTeam = {};

    bugs.forEach((bug) => {
      const app = bug.application;
      const team = bug.assignedTeam;

      if (!bugsBasedOnAppAndTeam[app]) {
        bugsBasedOnAppAndTeam[app] = {};
      }
      if (!bugsBasedOnAppAndTeam[app][team]) {
        bugsBasedOnAppAndTeam[app][team] = [];
      }

      bugsBasedOnAppAndTeam[app][team].push(bug);
    });

    return res.status(200).json({ bugs, bugsBasedOnAppAndTeam });
  } catch (error) {
    console.error("Error ", error.message);
    return res.status(500).json({
      error: "Server Error",
      details: error.message,
    });
  }
});

// Get fixed bugs for a developer
router.get(
  "/assigned/developer/:developerEmail/fixed-bugs",
  authenticateUser,
  async (req, res) => {
    try {
      const userEmail = req.user.email;
      const { developerEmail } = req.params;

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      const developer = await User.findOne({ email: developerEmail });
      if (!developer) {
        return res
          .status(404)
          .json({ error: "Developer does not exist in the database" });
      }

      const developerRole = developer.roles.find(
        (role) => role.role === "developer"
      );
      if (!developerRole) {
        return res
          .status(403)
          .json({ error: "Provided user is not a developer." });
      }

      const { application, team } = developerRole;

      //Check if the person getting fixed bugs is the developer, team lead or admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === team
      );
      const isSameDeveloper = userEmail === developerEmail;

      if (!isAdmin && !isTeamLead && !isSameDeveloper) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be the developer, team lead or an admin to access the fixed bugs.",
        });
      }

      //Bugs in these statuses will be returned
      const fixedBugStatuses = [
        "Tester Assigned",
        "Testing In Progress",
        "Tested & Verified",
        "Closed",
        "Ready For Closure",
      ];

      const bugs = await BugReport.find({
        application,
        assignedTeam: team,
        "assignedTo.developer": developerEmail,
        status: { $in: fixedBugStatuses },
      });

      if (!bugs.length) {
        return res.status(200).json({
          message: `No bugs found past fixed for ${developerEmail}`,
        });
      }

      res.status(200).json({ bugs });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

// Get bugs tested by tester
router.get(
  "/assigned/tester/:testerEmail/tested-bugs",
  authenticateUser,
  async (req, res) => {
    try {
      const userEmail = req.user.email;
      const { testerEmail } = req.params;

      const user = await User.findOne({ email: testerEmail });
      if (!user) {
        return res
          .status(401)
          .json({ error: "User does not exist in the database" });
      }

      const tester = await User.findOne({ email: testerEmail });
      if (!tester) {
        return res
          .status(404)
          .json({ error: "Tester does not exist in the database" });
      }

      const testerRole = tester.roles.find((role) => role.role === "tester");
      if (!testerRole) {
        return res
          .status(403)
          .json({ error: "Provided user is not a tester." });
      }

      const { application, team } = testerRole;

      //Check if the person getting tested bugs is the developer, team lead or admin
      const isAdmin = user.roles.some((role) => role.role === "admin");
      const isTeamLead = user.roles.some(
        (role) =>
          role.role === "teamlead" &&
          role.application === application &&
          role.team === team
      );
      const isSameTester = userEmail === testerEmail;

      if (!isAdmin && !isTeamLead && !isSameTester) {
        return res.status(403).json({
          error:
            "Unauthorized. You must be the tester, team lead or an admin to access the tested bugs.",
        });
      }

      //Bugs in these statuses will be returned
      const testedBugStatuses = [
        "Tested & Verified",
        "Closed",
        "Ready For Closure",
      ];

      const bugs = await BugReport.find({
        application,
        assignedTeam: team,
        "assignedTo.tester": testerEmail,
        status: { $in: testedBugStatuses },
      });

      if (!bugs.length) {
        return res.status(200).json({
          message: `No bugs found past testing for ${testerEmail}`,
        });
      }

      res.status(200).json({ bugs });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//Return bug reports to python API for embedding
router.get("/for-embedding", checkSimilarityKey, async (req, res) => {
  try {
    //Get all bugs from the database and return the fields below
    const bugs = await BugReport.find(
      {},
      {
        bugId: 1,
        application: 1,
        title: 1,
        description: 1,
        stepsToReproduce: 1,
        userSteps: 1,
        status: 1,
        _id: 0,
      }
    );

    res.json(bugs);
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

//API endpoint to check for duplicate
router.post(
  "/check-duplicate",
  authenticateUser,

  async (req, res) => {
    try {
      const {
        application,
        title,
        description,
        stepsToReproduce,
        userSteps,
        bugId,
      } = req.body;

      let response;
      try {
        if (bugId) {
          const bug = await BugReport.findOne({ bugId });

          if (!bug) {
            return res.status(404).json({ message: "Bug not found isjdksnd" });
          }

          //Not using thecheckIfBugIsClosed and checkIfBugIsDuplicate middlewares because when a new bug report is being reported
          //we won't have the bug id but it's expected in the middlewares
          //So manually checking
          if (bug.status === "Closed") {
            return res
              .status(400)
              .json({ message: "Cannot check duplicate for a closed bug" });
          }

          if (bug.status === "Duplicate") {
            return res
              .status(400)
              .json({ message: "Already marked duplcaite." });
          }

          //Only during these current status of the bug, duplicate check can be done if not done during submisison
          const validStatusesForDuplicateCheck = ["Open", "Assigned"];
          if (!validStatusesForDuplicateCheck.includes(bug.status)) {
            return res.status(400).json({
              message: `Duplicate check is only allowed when bug status is ${validStatusesForDuplicateCheck.join(
                ", "
              )}. Current status is ${bug.status}. So not allowed.`,
            });
          }
        }

        //Send bug details to the Python duplicate detection service to check for similar existing bugs
        response = await axios.post(`${process.env.ML_SERVICE_URL || "http://localhost:8000"}/check-duplicate`, {
          application,
          title,
          description,
          stepsToReproduce,
          userSteps,
        }, {
          headers: { "x-similarity-key": process.env.SIMILARITY_API_KEY },
        });
      } catch (err) {
        console.error("FastAPI error:", err.message);

        return res.status(503).json({
          message: "Duplicate check not done. Service down.",
          error: err.message,
        });
      }

      if (response) {
        const similarBugs = response.data.similar_bugs || [];

        //If bugId is used t ocheck for duplicate (not during submission but after that) update the fields of the bug
        if (bugId) {
          const similarBugIds = similarBugs.map((bug) => bug.bug_id);

          //Update the bug duplciate check details
          const updateFields = {
            duplicateDetectionDone: true,
            isPotentialDuplicate: similarBugIds.length > 0,
            similarTo: similarBugIds,
          };

          await BugReport.findOneAndUpdate({ bugId }, updateFields);
        }

        //If no similarbugs found return empty array
        if (!similarBugs || similarBugs.length === 0) {
          return res.json({ duplicates: [] });
        }

        //If similarbugs found return bug details
        const bugIds = similarBugs.map((bug) => bug.bug_id);
        const bugsDetails = await BugReport.find({ bugId: { $in: bugIds } });

        const fullBugDetails = bugsDetails.map((bug) => ({
          bugId: bug.bugId,
          title: bug.title,
          description: bug.description,
          status: bug.status,
          assignedTeam: bug.assignedTeam,
          assignedTo: bug.assignedTo,
          priority: bug.priority,
          createdAt: bug.createdAt,
          updatedAt: bug.updatedAt,
          stepsToReproduce: bug.stepsToReproduce,
          userSteps: bug.userSteps,
        }));

        res.json({ duplicates: fullBugDetails });
      }
    } catch (error) {
      console.error("Error ", error);
      res.status(500).json({
        message: "Server Error",
        error: error.message,
      });
    }
  }
);

//API endpoint to check classify priority based on a similar bug
router.post("/classify-priority", authenticateUser, async (req, res) => {
  try {
    const { application, title, description } = req.body;

    const response = await axios.post(
      `${process.env.ML_SERVICE_URL || "http://localhost:8000"}/similar-bugs-for-classify-priority?min_score=0.5`,
      {
        application,
        query: `${title} ${description}`.trim(),
      },
      {
        headers: { "x-similarity-key": process.env.SIMILARITY_API_KEY },
      }
    );

    console.log(
      "Similar bugs skjf niskemf klsemfl ksmdfl k" +
        JSON.stringify(response.data)
    );
    const similarBugs = response.data?.similar_bugs || [];
    console.log(similarBugs);
    let matchedBug;
    let fallbackPriority = "Medium";

    if (similarBugs.length > 0) {
      matchedBug = await BugReport.findOne({
        bugId: similarBugs[0].bug_id,
        status: { $in: ["Closed"] },
        priority: { $ne: null },
      });
    } else {
      const text = `${title} ${description}`.toLowerCase();

      const criticalKeywords = [
        "crash",
        "loss",
        "unable",
        "break",
        "fail",
        "failure",
        "stops",
      ];
      const highKeywords = [
        "timeout",
        "not working",
        "error",
        "broken",
        "loading",
      ];
      const mediumKeywords = ["slow", "minor", "misaligned", "small bug"];
      const lowKeywords = ["typo", "cosmetic", "ui", "spelling", "alignment"];

      function containsWord(text, keywords) {
        return keywords.some((keyword) => text.includes(keyword));
      }

      if (containsWord(text, criticalKeywords)) {
        fallbackPriority = "Critical";
      } else if (containsWord(text, highKeywords)) {
        fallbackPriority = "High";
      } else if (containsWord(text, mediumKeywords)) {
        fallbackPriority = "Medium";
      } else if (containsWord(text, lowKeywords)) {
        fallbackPriority = "Low";
      }
    }
    const team = matchedBug?.assignedTeam;

    const teamLead = await User.findOne({
      "roles.application": application,
      "roles.team": team,
      "roles.role": "teamlead",
    }).select("email");

    const adminEmail = "adm1n.bugtrackr@gmail.com";
    const recipients = teamLead ? [teamLead.email, adminEmail] : [adminEmail];

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let emailBody = "";

    if (similarBugs.length > 0) {
      emailBody = `Dear Team Lead and Admin,

A bug has been submitted and its priority was automatically classified using a similar previously reported and closed bug.

Bug Title: ${title}
Application: ${application}
Team: ${team || "Unassigned"}
Priority: ${matchedBug?.priority}

Please review and update the priority if needed.
`;
    } else {
      emailBody = `Dear Team Lead and Admin,

A bug has been submitted and its priority was automatically classified using fallback rule based logic, as no similar bug was matched.

Bug Title: ${title}
Application: ${application}
Team: ${team || "Unassigned"}

Please review and update the priority if needed.
`;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipients,
      subject: `Importaant - Priority classification notification - Bug priority set automatically`,
      text: emailBody,
    };
    try {
      await transporter.sendMail(mailOptions);
      console.log("Priority classification email sent successfully");
    } catch (emailError) {
      console.error("Error sending email", emailError.message);
    }

    if (matchedBug) {
      return res.json({
        priority: matchedBug.priority,
        source: "similar_bug",
        bugId: matchedBug.bugId,
      });
    }

    return res.json({
      priority: fallbackPriority,
      source: "fallback",
    });
  } catch (err) {
    console.error("Error ", err.message);
    return res.status(500).json({
      message: "Server Error",
      error: err.message,
    });
  }
});

//API used to search the database of bugs semantically(based on meaning rather than exact words)
router.post("/search/semantic", authenticateUser, async (req, res) => {
  try {
    const { application, query } = req.body;

    if (!application || !query) {
      return res
        .status(400)
        .json({ message: "Application and query required" });
    }

    const response = await axios.post(`${process.env.ML_SERVICE_URL || "http://localhost:8000"}/search/semantic`, {
      application,
      query,
    }, {
      headers: { "x-similarity-key": process.env.SIMILARITY_API_KEY },
    });
    const similarBugIds = response.data.similar_bugs.map((b) => b.bug_id);
    const bugsDetails = await BugReport.find({ bugId: { $in: similarBugIds } });

    return res.json({ bugs: bugsDetails });
  } catch (error) {
    console.error("Error ", error.message);
    return res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

//API to auto assign developer
router.put(
  "/auto-assign-developer",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkIfPriorityIsSet,
  async (req, res) => {
    try {
      const { bugId } = req.body;
      const userEmail = req.user.email;

      if (!bugId) {
        return res.status(400).json({ message: "Bug id is required." });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(401).json({ message: "User not found." });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ message: "Bug not found." });
      }

      //Check if the bug is already assigned to a developer
      if (bug.assignedTo && bug.assignedTo.developer) {
        return res.status(400).json({
          message: `Bug is already assigned to developer ${bug.assignedTo.developer}. Auto-assignment skipped.`,
        });
      }

      //Make sure priority is set
      if (!bug.priority) {
        return res.status(400).json({
          message: "Bug must have a priority set before auto-assigning.",
        });
      }

      const { application, assignedTeam, priority } = bug;

      //Ensure user is admin or team lead of this team
      const isAdmin = user.roles.some((r) => r.role === "admin");
      const isTeamLead = user.roles.some(
        (r) =>
          r.role === "teamlead" &&
          r.application === application &&
          r.team === assignedTeam
      );

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          message: "Only a team lead or admin can trigger auto assignment.",
        });
      }

      const dev = await assignDeveloper(application, assignedTeam, priority);

      if (!dev) {
        return res.status(200).json({
          message:
            "No eligible developer found. Assign manually or let the bug be unassigned until a dev is available.",
        });
      }

      bug.assignedTo.developer = dev.email;
      bug.status = "Assigned";
      (bug.statusLastUpdated = new Date()),
        bug.changeHistory.push({
          type: "Assignment",
          developer: dev.email,
          changedOn: new Date(),
          changedBy: userEmail,
          changedByRole: isAdmin ? "admin" : "teamlead",
          reason: "Auto-assigned using system logic",
        });

      await bug.save();

      //Updae the workload hours of the matched developer

      if (dev.totalAfterAssignment > 40) {
        await User.updateOne(
          {
            email: dev.email,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          { $inc: { "roles.$.workloadHours": dev.estimatedHours } },
          {
            $set: { "roles.$.overLoaded": true },
          }
        );
      } else {
        await User.updateOne(
          {
            email: dev.email,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "developer",
          },
          {
            $inc: { "roles.$.workloadHours": dev.estimatedHours },
          }
        );
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      if (dev.fallbackNotice) {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: userEmail, //Send to the one (team lead or admin) who triggered assignment
          subject: `Fallback Assignment Notice for Bug ID: ${bug.bugId}`,
          text: `Dear ${user.fullName},
      
      ${dev.fallbackNotice}
      
      Application: ${application}
      Team: ${assignedTeam}
      Assigned Developer: ${dev.fullName} (${dev.email})
      
      Please monitor and reassign if necessary.
      `,
        };

        try {
          await transporter.sendMail(mailOptions);
        } catch (emailErr) {
          console.error("Fallback email error: ", emailErr.message);
        }
      }
      //Send email notification to the assigned developer
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: dev.email,
        subject: `Bug assigned - Bug ID: ${bug.bugId}`,
        text: `Dear ${dev.fullName},

You have been assigned a new bug.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Team: ${assignedTeam}

Please check your dashboard for moredetails.
`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending email to developer", emailError.message);
      }

      res.status(200).json({
        message: `Bug assigned to ${dev.fullName} (${dev.seniority})`,
        developer: dev,
        ...(dev.fallbackNotice && { fallbackNotice: dev.fallbackNotice }),
        status: bug.status,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

//API to auto assign tester
router.put(
  "/auto-assign-tester",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  checkIfPriorityIsSet,
  async (req, res) => {
    try {
      const { bugId } = req.body;
      const userEmail = req.user.email;

      if (!bugId) {
        return res.status(400).json({ message: "Bug id is required." });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user) {
        return res.status(401).json({ message: "User not found." });
      }

      const bug = await BugReport.findOne({ bugId });
      if (!bug) {
        return res.status(404).json({ message: "Bug not found." });
      }

      //Allow only when current status is 'Fixed (Testing Pending)'
      if (bug.status !== "Fixed (Testing Pending)") {
        return res.status(400).json({
          message:
            "Auto-assignment of tester is only allowed when the bug status is 'Fixed (Testing Pending)'.",
        });
      }

      //Check if the bug is already assigned to a developer
      if (bug.assignedTo && bug.assignedTo?.tester) {
        return res.status(400).json({
          message: `Bug is already assigned to tester ${bug.assignedTo.tester}. Auto-assignment skipped.`,
        });
      }

      //Make sure priority is set

      if (!bug.priority) {
        return res.status(400).json({
          message: "Bug must have a priority set before auto-assigning.",
        });
      }

      const { application, assignedTeam, priority } = bug;

      //Ensure user is admin or team lead of this team

      const isAdmin = user.roles.some((r) => r.role === "admin");
      const isTeamLead = user.roles.some(
        (r) =>
          r.role === "teamlead" &&
          r.application === application &&
          r.team === assignedTeam
      );

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({
          message: "Only a team lead or admin can trigger auto assignment.",
        });
      }

      const assignTester = require("../utils/assignTester");
      const tester = await assignTester(application, assignedTeam, priority);

      if (!tester) {
        return res.status(200).json({
          message:
            "No eligible tester found. Assign manually or let the bug remain in pending state.",
        });
      }

      bug.assignedTo.tester = tester.email;
      bug.status = "Tester Assigned";
      (bug.statusLastUpdated = new Date()),
        bug.changeHistory.push({
          type: "Assignment",
          tester: tester.email,
          changedOn: new Date(),
          changedBy: userEmail,
          changedByRole: isAdmin ? "admin" : "teamlead",
          reason: "Auto-assigned using system logic",
        });

      await bug.save();
      console.log(tester.estimatedHours);
      //Updae the workload hours of the matched tester
      if (tester.totalAfterAssignment > 40) {
        await User.updateOne(
          {
            email: tester.email,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "tester",
          },
          { $inc: { "roles.$.workloadHours": tester.estimatedHours } },
          {
            $set: { "roles.$.overLoaded": true },
          }
        );
      } else {
        await User.updateOne(
          {
            email: tester.email,
            "roles.application": application,
            "roles.team": assignedTeam,
            "roles.role": "tester",
          },
          {
            $inc: { "roles.$.workloadHours": tester.estimatedHours },
          }
        );
      }
      // Notify fallback if any
      const PRIORITY_SENIORITY_ORDER = {
        Critical: ["senior", "mid", "junior"],
        High: ["senior", "mid", "junior"],
        Medium: ["mid", "junior", "senior"],
        Low: ["junior", "mid", "senior"],
      };

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      if (tester.fallbackNotice) {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: userEmail, //Send to the one (team lead or admin) who triggered assignment
          subject: `Fallback Assignment Notice for Bug ID: ${bug.bugId}`,
          text: `Dear ${user.fullName},


${tester.fallbackNotice}

Application: ${application}
Team: ${assignedTeam}
Assigned Tester: ${tester.fullName} (${tester.email})

Please monitor and reassign if necessary.`,
        };

        try {
          await transporter.sendMail(mailOptions);
        } catch (emailErr) {
          console.error("Fallback email error: ", emailErr.message);
        }
      }

      //Send email notification to the assigned tester
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: tester.email,
        subject: `Bug assigned for testing - Bug ID: ${bug.bugId}`,
        text: `Dear ${tester.fullName},

You have been assigned a new bug.

Bug ID: ${bug.bugId}
Title: ${bug.title}
Application: ${application}
Team: ${assignedTeam}

Please check your dashboard for moredetails.`,
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Error sending email to tester", emailError.message);
      }

      res.status(200).json({
        message: `Bug assigned to ${tester.fullName} (${tester.seniority})`,
        tester,
        ...(tester.fallbackNotice && { fallbackNotice: tester.fallbackNotice }),
        status: bug.status,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

module.exports = router;
