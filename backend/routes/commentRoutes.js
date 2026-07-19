const express = require("express");
const authenticateUser = require("../middlewares/authMiddleware");
const BugReport = require("../models/BugReportSchema");
const Comment = require("../models/CommentSchema");
const User = require("../models/UserSchema");
const { sendEmail } = require("../services/emailService");
const {
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
} = require("../middlewares/bugMiddleware");
const router = express.Router();

// Add a comment to a bug report
router.post(
  "/add",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const { bugId, commentText, mentionedUsers } = req.body;
      const commenterEmail = req.user.email;

      const bug = await BugReport.findOne({ bugId });
      if (!bug) return res.status(404).json({ error: "Bug not found" });

      const user = await User.findOne({ email: commenterEmail });
      if (!user) return res.status(404).json({ error: "User not found" });

      // Check if the user belongs to the same application as the bug and has appropriate role
      const userRoleObj = user.roles.find(
        (role) => role.application === bug.application
      );

      const userRole = userRoleObj ? userRoleObj.role : null;

      const allowedRoles = ["developer", "tester", "teamlead", "admin"];
      if (!userRole || !allowedRoles.includes(userRole.toLowerCase())) {
        return res.status(403).json({
          error: "You are not allowed to comment on this bug.",
        });
      }
      //Only allow users within the same application
      let validMentionedUsers = [];
      let invalidMentionedUsers = [];
      if (mentionedUsers && mentionedUsers.length > 0) {
        const appUsers = await User.find({
          "roles.application": bug.application,
        }).select("email");

        //Get valid and invalid mentioned users (user belong to the app or not)
        const appUserEmails = appUsers.map((user) => user.email);
        validMentionedUsers = mentionedUsers.filter((email) =>
          appUserEmails.includes(email)
        );

        invalidMentionedUsers = mentionedUsers.filter((email) => {
          !appUserEmails.includes(email);
        });
        //Error if all mentioned users are invalid
        if (invalidMentionedUsers.length > 0) {
          return res.status(400).json({
            error: "Some mentioned users are not part of this application",
            invalidUsers: invalidMentionedUsers,
          });
        }
      }

      // Create the comment object
      const newComment = {
        text: commentText,
        createdBy: {
          email: commenterEmail,
          name: user.fullName,
          role: userRole,
        },
        mentionedUsers: validMentionedUsers,
        createdAt: new Date(),
        editableUntil: new Date(Date.now() + 15 * 60 * 1000), //Editable for 15 minutes
        deleted: false,
      };

      // Check if a comments entry already exists for this bug
      let bugComments = await Comment.findOne({ bugId });

      if (bugComments) {
        // Add new comment to the beginning (latest comment should appear first)
        bugComments.comments.unshift(newComment);

        await bugComments.save();
        newComment.id = bugComments.comments[0].id;
      } else {
        //Create a new entry if this is the first comment for the bug
        const newCommentEntry = new Comment({
          bugId,
          comments: [newComment],
        });

        await newCommentEntry.save();
        newComment.id = newCommentEntry.comments[0].id;
      }

      // Send email notifications to valid mentioned users
      if (validMentionedUsers.length > 0) {
        sendEmail({
          toEmail: validMentionedUsers,
          subject: `You were mentioned in a bug comment - ${bug.title}`,
          text: `${user.fullName} mentioned you in a comment on bug report ${bug.bugId}: "${commentText}"`,
          html: `<p><strong>${user.fullName}</strong> mentioned you in a comment on <strong>Bug id ${bug.bugId}</strong>:</p>
                   <blockquote>${commentText}</blockquote>
                   <p><a href="${process.env.FRONTEND_URL || "https://localhost:3000"}/dashboard">View bug report</a></p>`,
        });
      }

      res.status(201).json({
        message: "Comment added successfully",
        newComment,
        mentionedUsers: validMentionedUsers,
      });
    } catch (error) {
      console.error("Error ", error.message);
      res.status(500).json({ error: "Server Error", details: error.message });
    }
  }
);

//View bug details and comments
router.get("/:bugId/details", authenticateUser, async (req, res) => {
  try {
    const { bugId } = req.params;
    const userEmail = req.user.email;

    const bug = await BugReport.findOne({ bugId });
    if (!bug) return res.status(404).json({ error: "Bug not found" });

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isAdmin = user.roles.some((role) => role.role === "admin");
    // Check if the user is in the assigned team or mentioned in any comment
    const userInAssignedTeam = user.roles.some(
      (role) =>
        role.application === bug.application && role.team === bug.assignedTeam
    );
    const mentionedInComment = await Comment.exists({
      bugId,
      "comments.mentionedUsers": userEmail,
    });

    if (!userInAssignedTeam && !mentionedInComment && !isAdmin) {
      return res.status(403).json({
        error: "You are not authorized to view this bug report",
      });
    }

    // Get comments for the bug
    const bugComments = await Comment.findOne({ bugId });

    res.status(200).json({ bug, comments: bugComments?.comments || [] });
  } catch (error) {
    console.error("Error ", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

//Edit a comment (within 15 mins)
router.put(
  "/edit/:commentId",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const { updatedComment } = req.body;
      const userEmail = req.user.email;

      //Find the comment in the comments array
      const bugComments = await Comment.findOne({ "comments.id": commentId });
      if (!bugComments)
        return res.status(404).json({ error: "Comment not found" });

      const comment = bugComments.comments.find(
        (commnet) => commnet.id === commentId
      );

      // Check if the user is the commenter and if the edit is within the allowed time (15 mins)
      if (comment.createdBy.email !== userEmail) {
        return res
          .status(403)
          .json({ error: "You can only edit your own comment" });
      }
      if (new Date() > new Date(comment.editableUntil)) {
        return res.status(403).json({
          error:
            "Cannot be edited. The comment can only be edited within 15 minutes of being added",
        });
      }

      comment.text = updatedComment;
      await bugComments.save();

      res.status(200).json({ message: "Comment updated successfully" });
    } catch (error) {
      console.error("Error ", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

// Archive comment (will marked as deleted true but will be available in the database)
router.delete(
  "/delete/:commentId",
  authenticateUser,
  checkIfBugIsClosed,
  checkIfBugIsDuplicate,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const userEmail = req.user.email;

      // Find the comment
      const bugComments = await Comment.findOne({ "comments.id": commentId });
      console.log(commentId);

      if (!bugComments)
        return res.status(404).json({ error: "Comment not found" });
      const comment = bugComments.comments.find(
        (commnet) => commnet.id === commentId
      );

      // Check if the user is the commenter or an admin
      const user = await User.findOne({ email: userEmail });
      const isAdmin = user.roles.some((role) => role.role === "admin");

      if (comment?.createdBy?.email !== userEmail && !isAdmin) {
        return res.status(403).json({
          error:
            "You cannot delete this comment as you are not the commenter or the admin",
        });
      }
      if (new Date() > new Date(comment.editableUntil) && !isAdmin) {
        return res.status(403).json({
          error:
            "Cannot be deleted. The comment can only be deleted within 15 minutes of being added",
        });
      }

      // Archive the comment
      comment.deleted = true;
      await bugComments.save();

      res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error ", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

//Return mentioned comments
router.get("/mentioned", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;

    //get all comments where logged in user is mentioned
    const mentionedComments = await Comment.find({
      comments: {
        $elemMatch: { mentionedUsers: userEmail },
      },
    });
    console.log("aksjdkajs", mentionedComments);

    if (!mentionedComments.length) {
      return res.status(200).json({ bugs: [] });
    }

    //Get only unique bug ids (if user is mentioned more than once in a report)
    const bugIds = [
      ...new Set(mentionedComments.map((comment) => comment.bugId)),
    ];

    console.log("iiiiiiiiiiiii", bugIds);
    const bugs = await BugReport.find({ bugId: { $in: bugIds } });

    res.status(200).json({ bugs });
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

//Get bug details for the mentioned comment
router.get("/mentioned/:bugId", authenticateUser, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { bugId } = req.params;

    const bugReport = await BugReport.findOne({ bugId });

    if (!bugReport) {
      return res.status(404).json({ error: "Bug not found" });
    }

    //Check if the user is mentioned in any comment for this bug
    const mentionedInComment = await Comment.exists({
      bugId,
      "comments.mentionedUsers": userEmail,
    });

    if (!mentionedInComment) {
      return res.status(403).json({
        error: "You are not authorized to view this bug",
      });
    }

    res.status(200).json({ bugReport });
  } catch (error) {
    console.error("Error ", error.message);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

module.exports = router;
