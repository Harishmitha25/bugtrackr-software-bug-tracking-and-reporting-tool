import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Avatar,
  Button,
  List,
  ListItem,
  ListItemText,
  Popper,
  Paper,
  ClickAwayListener,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faTrash,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import dayjs from "dayjs";
import MarkAsDuplicate from "../../../components/MarkAsDuplcate";
import { Tooltip } from "@mui/material";
import RequestReallocation from "../../../components/RequestReallocation";
import BugChatBox from "../../../components/BugChatBox";

import Attachment from "../../../components/Attachment";

//Approximate estimated hours for each of the bugs accordinh to their priority
const estimatedHoursByPriority = {
  Critical: 6,
  High: 9,
  Medium: 3,
  Low: 1,
};

const validStatusTransitions = {
  Assigned: ["Fix In Progress"],
  "Fix In Progress": ["Fixed (Testing Pending)"],
  "Fixed (Testing Pending)": ["Fix In Progress"],
};

const DeveloperBugDetailsModal = ({ bug, onClose, updateBugLocally }) => {
  const [selectedStatus, setSelectedStatus] = useState(bug.status);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [mentionableUSers, setmentionableUSers] = useState([]);
  const [allmentionableUSers, setAllMentionableUSers] = useState([]);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedCommentText, setEditedCommentText] = useState("");
  const [pendingDeleteComment, setPendingDeleteComment] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", content: "" });
  const [developerResolutionHours, setDeveloperResolutionHours] = useState("");
  const [similarBugs, setSimilarBugs] = useState([]);

  const token = localStorage.getItem("token");
  const userEmail = localStorage.getItem("loggedInUserEmail");

  const changeHistory = bug.changeHistory || [];
  const statusChangeEntries = changeHistory.filter(
    (entry) => entry.type === "Status Change"
  );
  const lastStatusEntry =
    statusChangeEntries.length > 0
      ? statusChangeEntries[statusChangeEntries.length - 1]
      : null;

  // Check if the bug can be reverted to its previous state
  const canRevertToPreviosState =
    lastStatusEntry &&
    lastStatusEntry.newStatus === bug.status && //ensures the bug is still in the last updated status before allowing revert
    new Date() - new Date(lastStatusEntry.changedOn) < 15 * 60 * 1000;

  const forwardChanges = validStatusTransitions[bug.status] || [];

  const revertChange = canRevertToPreviosState
    ? [lastStatusEntry.previousStatus]
    : [];

  //Combine both and use set to remove duplicates
  const availableStatuses = [...new Set([...forwardChanges, ...revertChange])];

  //Get comments added in the bug report
  useEffect(() => {
    const fetchBugData = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/${bug.bugId}/details`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setComments(response.data.comments);
      } catch (err) {
        console.error(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Failed to fetch comments."
        );
      }
    };

    if (bug) {
      fetchBugData();
    }
  }, [bug]);

  //Get mentionable (tech members in the app) users
  useEffect(() => {
    const fetchmentionableUSers = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/applications/${bug.application}/mentionable-users`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setmentionableUSers(response.data.users || []);
        setAllMentionableUSers(response.data.users || []);
      } catch (err) {
        console.error("Failed to fetch mentionable users.");
      }
    };

    fetchmentionableUSers();
  }, [bug]);

  useEffect(() => {
    const fetchSimilarBugs = async () => {
      if (bug?.isPotentialDuplicate && bug?.similarTo?.length > 0) {
        try {
          const filteredIds = bug.similarTo.filter((id) => id !== bug.bugId);
          const similarBugPromises = filteredIds.map(async (similarBugId) => {
            try {
              const res = await axios.get(
                `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assigned/team/${similarBugId}?isGettingDetailForSimilarBug=true`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              return res.data.bugReport;
            } catch (error) {
              console.error(
                `Failed to fetch details for ${similarBugId}`,
                error.message
              );
              return { bugId: similarBugId };
            }
          });

          const similarBugDetails = await Promise.all(similarBugPromises);
          setSimilarBugs(similarBugDetails.filter(Boolean));
        } catch (err) {
          console.error("Failed to fetch similar bugs", err.message);
        }
      }
    };

    if (bug) {
      fetchSimilarBugs();
    }
  }, [bug]);

  const handleStatusChange = async (newStatus) => {
    console.log(availableStatuses);
    if (!availableStatuses.includes(newStatus)) {
      toast.error(
        "Invalid status transition either because the forward change to the selected status not possibel or reverting of status update can happen only within 15 mins post status update"
      );
      return;
    }
    if (newStatus === "Fixed (Testing Pending)") {
      if (
        !bug.developerResolutionHours &&
        (developerResolutionHours === "" ||
          isNaN(developerResolutionHours) ||
          developerResolutionHours < 0)
      ) {
        toast.error("Please enter valid hours worked before submitting.");
        return;
      }
    }

    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/update-status`, //Update status on dropdown value change
        {
          bugId: bug.bugId,
          status: newStatus,
          developerResolutionHours:
            selectedStatus === "Fixed (Testing Pending)"
              ? developerResolutionHours
              : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Bug status updated successfully.");
      updateBugLocally(bug.bugId, {
        status: newStatus,
        developerResolutionHours: developerResolutionHours,
        statusLastUpdated: new Date(),
      });
      setSelectedStatus(newStatus);
      bug.status = newStatus;
      bug.developerResolutionHours = developerResolutionHours;
      setDeveloperResolutionHours("");
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update status."
      );
    }
  };

  //Watch for @ in the comment to display mentionable users
  const handleCommentChange = (e) => {
    const value = e.target.value;
    setNewComment(value);

    const words = value.split(" ");
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      //Showing the mentionable users only when the it starts with @ because @ could b eused in the
      //commentfor some other purpose like adding an email
      const typedText = lastWord.substring(1).toLowerCase();

      if (typedText.length > 0) {
        const filteredUsers = allmentionableUSers.filter((user) =>
          user.name.toLowerCase().startsWith(typedText)
        );
        setmentionableUSers(filteredUsers);
      } else {
        setmentionableUSers(allmentionableUSers);
      }

      setShowMentions(true);
      setAnchorEl(e.target);
    } else {
      setShowMentions(false);
    }
  };

  //Update the comment with the mentioned user's name and ypdate mentioned users state
  const handleMentionSelect = (user) => {
    setNewComment((prev) => {
      const atIndex = prev.lastIndexOf("@");
      if (atIndex !== -1) {
        return prev.substring(0, atIndex) + `@${user.name} `;
      }
      return prev;
    });

    setMentionedUsers((prevMentions) => {
      const alreadyMEntioned = prevMentions.some((u) => u.email === user.email); //To avoid adding same mentioned person's email twice
      return alreadyMEntioned ? prevMentions : [...prevMentions, user];
    });

    setShowMentions(false);
  };

  //Set edited comment text and id
  const handleEditComment = (comment) => {
    console.log(comment);
    setEditingCommentId(comment.id);
    setEditedCommentText(comment.text);
  };

  //Unset edited comment text and id
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditedCommentText("");
  };

  //To save edited comment
  const handleSaveEditedComment = async (commentId) => {
    console.log(editedCommentText);
    if (!editedCommentText.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/edit/${commentId}`,
        { bugId: bug.bugId, updatedComment: editedCommentText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.id === commentId
            ? { ...comment, text: editedCommentText }
            : comment
        )
      );

      toast.success("Comment updated successfully.");
      setEditingCommentId(null);
    } catch (err) {
      console.log(err);
      toast.error(
        err.response.data?.error ||
          err.response?.data?.message ||
          "Failed to update comment"
      );
    }
  };

  //Delete entered comment
  const handleDeleteComment = (commentId) => {
    console.log(commentId);
    setPendingDeleteComment(commentId);
    //Store toast id to close it as needed
    const toastId = toast.info(
      <div>
        <p>Are you sure you want to delete this commnet ?</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          <button
            onClick={() => confirmDelete(commentId, toastId)}
            className="bg-red-600 text-white py-1 px-3 rounded-md hover:bg-red-700 transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => cancelDelete(toastId)}
            className="bg-gray-500 text-white py-1 px-3 rounded-md hover:bg-gray-600 transition-colors"
          >
            No
          </button>
        </div>
      </div>,
      {
        autoClose: false, //Keep the confirmation toast displayed until yes or no is clicked
      }
    );
  };

  const cancelDelete = (toastId) => {
    toast.dismiss(toastId);
  };

  //Delete (archive the comment)
  const confirmDelete = async (commentId, toastId) => {
    toast.dismiss(toastId);

    try {
      await axios.delete(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/delete/${commentId}`,
        {
          data: { bugId: bug.bugId }, // need to pass body data via data field in the config object
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setComments((prevComments) =>
        prevComments.filter((comment) => comment.id !== commentId)
      );

      toast.success("Comment deleted successfully.");
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to delete comment."
      );
    }
  };

  //Add comment to the bug
  const handleCommentSubmit = async () => {
    if (!newComment.trim()) {
      toast.error("Comment cannot be empty.");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/add`,
        {
          bugId: bug.bugId,
          commentText: newComment,
          mentionedUsers: mentionedUsers.map((user) => user.email),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data.newComment);
      setComments([response.data.newComment, ...comments]);
      setNewComment("");
      setMentionedUsers([]);
      toast.success("Comment added successfully.");
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to add comment."
      );
    }
  };

  //Format the date and time the comment was added
  const formatDateTime = (date) => {
    const now = dayjs();
    const diffInHours = now.diff(dayjs(date), "hour");
    const diffInDays = now.diff(dayjs(date), "day");

    if (diffInHours < 24) {
      return diffInHours === 1 ? "1 hour ago" : `${diffInHours} hours ago`;
    } else if (diffInDays < 7) {
      return diffInDays === 1 ? "1 day ago" : `${diffInDays} days ago`;
    } else {
      return dayjs(date).format("YYYY-MM-DD HH:mm");
    }
  };

  //To check if the comment is editable or deletable
  const isCommentEditablOrDeleteable = (createdAt) => {
    const commentTime = dayjs(createdAt);
    const currentTime = dayjs();
    const timeDiff = currentTime.diff(commentTime, "minute");

    return timeDiff <= 15;
  };

  //To check if a pending request exists for developer
  const checkIfPendingRequestExists = (bug) => {
    if (!bug.reallocationRequests || !bug.reallocationRequests.developer)
      return false;

    const requests = bug.reallocationRequests.developer.filter(
      (request) =>
        request.requestedBy === localStorage.getItem("loggedInUserEmail")
    );

    return requests.some((request) => request.requestStatus === "Pending");
  };

  //Get the latest request reason
  const getLatestRequestReason = (bug) => {
    if (!bug.reallocationRequests || !bug.reallocationRequests.developer)
      return "";

    const requests = bug.reallocationRequests.developer.filter(
      (request) =>
        request.requestedBy === localStorage.getItem("loggedInUserEmail")
    );

    return requests.length > 0 ? requests[requests.length - 1].reason : "";
  };

  //Get the latest request status
  const getLatestRequestStatus = (bug) => {
    if (!bug.reallocationRequests || !bug.reallocationRequests.developer)
      return "";

    const requests = bug.reallocationRequests.developer.filter(
      (request) =>
        request.requestedBy === localStorage.getItem("loggedInUserEmail")
    );

    return requests.length > 0
      ? requests[requests.length - 1].requestStatus
      : "";
  };

  //Set content for the expanded section
  const toggleAccordionExpantion = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  //Set modal content for opened modal
  const handleOpenModal = (title, content) => {
    setModalContent({ title, content });
    setOpenModal(true);
  };

  //Remove/Reset modal content for modal close
  const handleCloseModal = () => {
    setOpenModal(false);
    setModalContent({ title: "", content: "" });
  };
  return (
    <div>
      <Dialog open={Boolean(bug)} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle className="flex justify-between items-center">
          {bug.title}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <div className="flex">
            <div className="w-2/3 p-4 border-r">
              <p>
                <strong>Bug ID:</strong> {bug.bugId}
              </p>
              <p>
                <strong>Status:</strong> {bug.status}
              </p>
              <p>
                <strong>Application:</strong> {bug.application}
              </p>
              <p>
                <strong>Issue Type:</strong> {bug.issueType}
              </p>
              {bug.issueType === "Other" && bug.otherIssueDescription && (
                <p>
                  <strong>Other Issue Description:</strong>{" "}
                  {bug.otherIssueDescription}
                </p>
              )}
              {bug.browser && (
                <p>
                  <strong>Browser:</strong> {bug.browser}
                </p>
              )}
              {bug.os && (
                <p>
                  <strong>OS:</strong> {bug.os}
                </p>
              )}
              <p className="whitespace-pre-wrap">
                <strong>Description:</strong> {bug.description}
              </p>
              {bug.priority && (
                <p className="text-gray-700">
                  <strong>Priority:</strong> {bug?.priority}
                </p>
              )}
              {bug.reportedBy && (
                <p className="text-gray-700">
                  <strong>Reported By:</strong> {bug?.reportedBy?.name} (
                  {bug?.reportedBy?.email})
                </p>
              )}
              {bug.assignedTo?.tester && (
                <p className="text-gray-700">
                  <strong>Assigned Tester:</strong> {bug?.assignedTo?.tester} (
                  {bug?.assignedTo?.tester})
                </p>
              )}
              {bug?.isPotentialDuplicate && (
                <Accordion className="mt-4">
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <span className="font-semibold text-primary">
                      Potential Duplicate Bug(s)
                    </span>
                  </AccordionSummary>
                  <AccordionDetails>
                    {similarBugs.length === 0 ? (
                      <p className="text-gray-600">
                        No similar bugs could be loaded.
                      </p>
                    ) : (
                      similarBugs.map((similarBug, index) => (
                        <div
                          key={index}
                          className="mb-4 border rounded p-3 bg-gray-50 shadow-sm"
                        >
                          <p className="text-sm text-gray-800">
                            <strong>Bug ID:</strong> {similarBug.bugId}
                          </p>
                          {similarBug.title ? (
                            <>
                              <p className="text-sm text-gray-800">
                                <strong>Title:</strong> {similarBug.title}
                              </p>
                              <p className="text-sm text-gray-800">
                                <strong>Status:</strong> {similarBug.status}
                              </p>
                              <p className="text-sm text-gray-800">
                                <strong>Description:</strong>{" "}
                                {similarBug.description}
                              </p>
                              <p className="text-sm text-gray-800">
                                <strong>Steps to Reproduce:</strong>{" "}
                                {similarBug.stepsToReproduce ||
                                  Object.values(
                                    similarBug.userSteps || {}
                                  ).join(" ")}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-500 text-sm italic">
                              Details for this bug could not be loaded.
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </AccordionDetails>
                </Accordion>
              )}

              {bug.attachments.length > 0 && (
                <>
                  <p>
                    <strong>Attachments:</strong>
                  </p>
                  <div className="mt-4">
                    {bug.attachments.map((file, index) => {
                      return <Attachment fileName={file} key={index} />;
                    })}
                  </div>
                </>
              )}

              <MarkAsDuplicate
                bugId={bug.bugId}
                isAlreadyDuplicate={bug.status === "Duplicate"}
                existingoriginalBugId={bug.originalBugId}
                existingExplanation={bug.duplicateExplanation}
                onMarkedDuplicate={(
                  newStatus,
                  updatedOriginalBugId,
                  updatedExplanation
                ) => {
                  updateBugLocally(bug.bugId, {
                    status: newStatus,
                    originalBugId: updatedOriginalBugId,
                    duplicateExplanation: updatedExplanation,
                  });
                  bug.status = newStatus;
                  setSelectedStatus(newStatus);
                }}
              />

              <RequestReallocation
                bugId={bug.bugId}
                isAlreadyRequseted={checkIfPendingRequestExists(bug)}
                existingRequestReason={getLatestRequestReason(bug)}
                existingRequestStatus={getLatestRequestStatus(bug)}
                onRequestReallocation={(reallocationRequests) => {
                  if (!bug.reallocationRequests) {
                    bug.reallocationRequests = { developer: [], tester: [] };
                  }

                  //Update the bug object with the newly added request to update the UI instantly
                  bug.reallocationRequests = reallocationRequests;
                  updateBugLocally(bug.bugId, { status: bug.status });
                }}
              />
            </div>

            <div className="w-1/3 p-4">
              <div className="mb-4">
                <label className="block font-semibold">Update Status:</label>
                <Select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="border p-2 rounded w-full"
                >
                  {bug.status !== "Duplicate" && (
                    <MenuItem value={bug.status}>{bug.status}</MenuItem>
                  )}
                  {validStatusTransitions[bug.status]?.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </div>
              {bug.priority &&
                selectedStatus === "Fixed (Testing Pending)" &&
                (bug.status !== "Fixed (Testing Pending)" ? (
                  <TextField
                    label={"Hours Worked"}
                    type="number"
                    value={
                      developerResolutionHours === 0 || developerResolutionHours
                        ? developerResolutionHours
                        : ""
                    }
                    onChange={(e) =>
                      setDeveloperResolutionHours(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    inputProps={{
                      step: 1,
                      inputMode: "numeric",
                    }}
                    helperText={`Enter valid numeric value please`}
                    fullWidth
                  />
                ) : (
                  <div className="mb-4">
                    <p className="text-gray-700">
                      <strong>Hours Worked:</strong>{" "}
                      {bug.developerResolutionHours} hours
                    </p>
                  </div>
                ))}

              <Button
                variant="contained"
                color="primary"
                onClick={() => handleStatusChange(selectedStatus)}
              >
                Submit Status Update
              </Button>

              <div>
                <p className="text-gray-700">
                  <strong>Estimated Hours:</strong>{" "}
                  {estimatedHoursByPriority[bug.priority] || "NA"}
                </p>
              </div>
              {bug.additionalInfo.length > 0 && (
                <div>
                  <p className="text-gray-700">
                    <strong>Additional Information:</strong>{" "}
                  </p>
                  <ul className="list-disc pl-5 text-gray-700">
                    {bug.additionalInfo.map((item, index) => (
                      <li
                        key={item._id || index}
                        className="break-words whitespace-pre-wrap"
                      >
                        {item.info + " - "}
                        <span className="text-sm text-gray-500">
                          {formatDateTime(item.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-gray-700">
                <strong>Steps to Reproduce</strong>
              </p>
              {bug.stepsToReproduce ? (
                <p className="text-gray-700 break-words whitespace-pre-wrap">
                  {bug.stepsToReproduce}
                </p>
              ) : (
                <ul>
                  {Object.values(bug.userSteps || {}).map((step, index) => (
                    <li
                      key={index}
                      className="text-gray-700 break-words whitespace-pre-wrap"
                    >
                      {step}
                    </li>
                  ))}
                </ul>
              )}
              {/* Accordions for error logs and stack trace */}
              {[
                { title: "Error Logs", content: bug.errorLogs },
                { title: "Stack Trace", content: bug.stackTrace },
              ].map(
                (section, index) =>
                  section.content && (
                    <Accordion
                      key={index}
                      expanded={expandedSection === section.title}
                      onChange={() => toggleAccordionExpantion(section.title)}
                      className="mt-4"
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        className="bg-gray-100"
                      >
                        <span className="font-semibold">{section.title}</span>
                      </AccordionSummary>
                      <AccordionDetails>
                        <p className="text-gray-700 line-clamp-3">
                          {section.content.length > 200
                            ? section.content.substring(0, 200) + "..."
                            : section.content}
                        </p>
                        {section.content.length > 200 && (
                          <Button
                            onClick={() =>
                              handleOpenModal(section.title, section.content)
                            }
                            className="text-primary mt-2"
                            variant="outlined"
                            size="small"
                          >
                            View More
                          </Button>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  )
              )}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-2">Comments</h3>

            <div className="relative">
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Add a comment"
                  value={newComment}
                  onChange={handleCommentChange}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCommentSubmit}
                  style={{ height: "56px" }}
                >
                  Post
                </Button>
              </div>
              <Popper
                open={showMentions}
                anchorEl={anchorEl}
                placement="bottom-start"
                style={{
                  zIndex: 10000, //Bring popper to the front (on top of elements)
                }}
              >
                <ClickAwayListener onClickAway={() => setShowMentions(false)}>
                  <Paper elevation={3}>
                    {mentionableUSers.length > 0 ? (
                      mentionableUSers.map((user) => (
                        <MenuItem
                          key={user.email}
                          onClick={() => handleMentionSelect(user)}
                        >
                          {user.name}
                        </MenuItem>
                      ))
                    ) : (
                      <p className="text-gray-500 p-2">
                        No mentionable users found
                      </p>
                    )}
                  </Paper>
                </ClickAwayListener>
              </Popper>
            </div>

            <List>
              {comments.map((comment) => (
                <ListItem
                  key={comment.id}
                  className="border-b flex items-center"
                >
                  <Avatar className="mr-3">
                    {comment.createdBy.name.charAt(0).toUpperCase() +
                      comment.createdBy.name
                        .split(" ")[1]
                        .charAt(0)
                        .toUpperCase()}
                  </Avatar>

                  <ListItemText
                    primary={
                      comment.deleted ? (
                        <em className="text-gray-500">
                          This comment was deleted by the person who commented
                          it
                        </em>
                      ) : (
                        <strong>{comment.createdBy.name}</strong>
                      )
                    }
                    secondary={
                      comment.deleted ? (
                        ""
                      ) : editingCommentId === comment.id ? (
                        <div className="flex items-center gap-2">
                          <TextField
                            fullWidth
                            variant="outlined"
                            value={editedCommentText}
                            onChange={(e) =>
                              setEditedCommentText(e.target.value)
                            }
                          />
                          <IconButton
                            onClick={() => handleSaveEditedComment(comment.id)}
                            color="success"
                          >
                            <FontAwesomeIcon icon={faCheck} />
                          </IconButton>
                          <IconButton onClick={handleCancelEdit} color="error">
                            <FontAwesomeIcon icon={faTimes} />
                          </IconButton>
                        </div>
                      ) : (
                        <>
                          <p>{comment.text}</p>
                          <span className="text-sm text-gray-500">
                            {formatDateTime(comment.createdAt)}
                          </span>
                        </>
                      )
                    }
                  />

                  {!comment.deleted &&
                    editingCommentId !== comment.id &&
                    comment.createdBy.email === userEmail &&
                    !comment.deleted && (
                      <div className="flex gap-2">
                        <Tooltip
                          title={
                            isCommentEditablOrDeleteable(comment.createdAt)
                              ? ""
                              : "Can only be edited within 15 mins of addition"
                          }
                        >
                          <span>
                            {/* <span> because Tooltip (MUI component) does not work on disabled element (IconButton) so wrap
                             * it with <span> */}
                            <IconButton
                              size="small"
                              onClick={() => handleEditComment(comment)}
                              color="primary"
                              disabled={
                                !isCommentEditablOrDeleteable(comment.createdAt)
                              }
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip
                          title={
                            isCommentEditablOrDeleteable(comment.createdAt)
                              ? ""
                              : "Can only be deleted within 15 mins of addition"
                          }
                        >
                          <span>
                            {/* <span> because Tooltip (MUI component) does not work on disabled element (IconButton) so wrap
                             * it with <span> */}
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteComment(comment.id)}
                              color="error"
                              disabled={
                                !isCommentEditablOrDeleteable(comment.createdAt)
                              }
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </div>
                    )}
                </ListItem>
              ))}
            </List>
          </div>
          <BugChatBox
            bugId={bug.bugId}
            currentUser={{
              fullName: localStorage.getItem("loggedInUserFullName"),
              email: localStorage.getItem("loggedInUserEmail"),
              role: "developer",
            }}
          />
        </DialogContent>
      </Dialog>
      {/* Modal for large content */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle className="flex justify-between items-center">
          {modalContent.title}
          <IconButton onClick={handleCloseModal} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        {/* <pre> to preservce line breaks and whitespaces */}
        <DialogContent>
          <pre className="whitespace-pre-wrap text-gray-700">
            {modalContent.content}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeveloperBugDetailsModal;
