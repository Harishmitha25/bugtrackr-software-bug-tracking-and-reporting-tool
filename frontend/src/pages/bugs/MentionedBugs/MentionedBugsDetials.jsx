import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  IconButton,
  CircularProgress,
  TextField,
  Popper,
  Paper,
  ClickAwayListener,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Tooltip,
} from "@mui/material";
import {
  faEdit,
  faTrash,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import dayjs from "dayjs";
import BugChatBox from "../../../components/BugChatBox";

import Attachment from "../../../components/Attachment";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
const MentionedBugsDetials = ({ bugId, onClickingBack }) => {
  const [bug, setBug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", content: "" });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [mentionableUSers, setmentionableUSers] = useState([]);
  const [allmentionableUSers, setAllmentionableUSers] = useState([]);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedCommentText, setEditedCommentText] = useState("");
  const [pendingDeleteComment, setPendingDeleteComment] = useState(null);
  const token = localStorage.getItem("token");
  const userEmail = localStorage.getItem("loggedInUserEmail");
  const roleHierarchy = ["user", "developer", "tester", "teamlead", "admin"];

  //Fetch bug details where logged in user is mentioned
  useEffect(() => {
    const fetchBugDetails = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/mentioned/${bugId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setBug(response.data.bugReport);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Failed to fetch bug details."
        );
      }
    };

    if (bugId) fetchBugDetails();
  }, [bugId]);

  //Fetch only comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/${bugId}/details`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setComments(response.data.comments);
      } catch (err) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Failed to fetch comments."
        );
      } finally {
        setLoading(false);
      }
    };

    if (bugId) fetchComments();
  }, [bugId]);

  const statusSteps = [
    "Open",
    "Assigned",
    "Fix In Progress",
    "Fixed (Testing Pending)",
    "Tester Assigned",
    "Testing In Progress",
    "Closed",
  ];

  const currentStatusIndex = statusSteps.indexOf(bug?.status);

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

  //Get mentionable (tech members in the app) users
  useEffect(() => {
    const fetchmentionableUSers = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/applications/${bug.application}/mentionable-users`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setmentionableUSers(response.data.users || []);
        setAllmentionableUSers(response.data.users || []);
      } catch (err) {
        console.error("Failed to fetch mentionable users.");
      }
    };

    fetchmentionableUSers();
  }, [bug]);

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
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <CircularProgress />
      </div>
    );

  //Get the primary role of the logged in user of the app
  const getPrimaryRole = (roles) => {
    roles.sort(
      (a, b) => roleHierarchy.indexOf(b.role) - roleHierarchy.indexOf(a.role)
    );

    return roles.length > 0 ? roles[0].role : "user";
  };
  const primaryRole = getPrimaryRole(JSON.parse(localStorage.getItem("roles")));

  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="max-w-6xl mx-auto p-8 bg-white shadow-lg rounded-lg">
      <button
        onClick={onClickingBack}
        className="text-primary hover:underline mb-4 flex items-center"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
        Back to Mentioned Bugs
      </button>

      <div className="flex gap-10">
        <div className="flex-1">
          <div className="flex items-center mb-4">
            <h3 className="text-2xl font-bold">{bug.title}</h3>
            <span className="text font-semibold text-gray-700 bg-gray-200 px-4 py-1 rounded-full ml-4">
              {bug.bugId}
            </span>
          </div>

          {bug?.status !== "Duplicate" && (
            <Stepper alternativeLabel className="my-6">
              {statusSteps.map((step, index) => (
                <Step
                  key={index}
                  completed={index < currentStatusIndex}
                  active={index === currentStatusIndex}
                >
                  <StepLabel
                    sx={{
                      "& .MuiStepIcon-root": {
                        color:
                          index < currentStatusIndex
                            ? "green !important"
                            : index === currentStatusIndex
                            ? "primary"
                            : "gray",
                      },
                    }}
                  >
                    {step}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          <h2 className="text-lg font-semibold text-primary">Description</h2>
          <p className="text-gray-600 text-lg mb-4 break-all whitespace-pre-wrap">
            {bug.description}
          </p>

          {bug.attachments.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-primary">
                Attachments
              </h2>
              <div className="mt-4">
                {bug.attachments.map((file, index) => (
                  <Attachment key={index} fileName={file} />
                ))}
              </div>
            </>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-primary mb-2">
              Comments
            </h2>

            <div className="relative mb-4">
              <div className="flex items-center gap-2">
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
                style={{ zIndex: 10000 }}
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
                    {comment.createdBy.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </Avatar>

                  <ListItemText
                    primary={
                      comment.deleted ? (
                        <em className="text-gray-500">
                          This comment was deleted
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
                    comment.createdBy.email === userEmail && (
                      <div className="flex gap-2">
                        <Tooltip
                          title={
                            isCommentEditablOrDeleteable(comment.createdAt)
                              ? ""
                              : "Can only be edited within 15 mins of addition"
                          }
                        >
                          <span>
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
        </div>

        <div className="w-1/3 bg-gray-50 p-4 rounded-lg shadow-md">
          <p className="text-lg text-gray-700">
            <strong>Application:</strong> {bug.application}
          </p>
          <p className="text-lg text-gray-700">
            <strong>Assigned Team:</strong> {bug.assignedTeam || "Not assigned"}
          </p>
          <p className="text-lg text-gray-700">
            <strong>Priority:</strong> {bug.priority || "Not set"}
          </p>
          <p className="text-lg text-gray-700">
            <strong>Issue Type:</strong> {bug.issueType}
          </p>
          {bug.issueType === "Other" && bug.otherIssueDescription && (
            <p className="text-lg text-gray-700">
              <strong>Other Issue Description:</strong>{" "}
              {bug.otherIssueDescription}
            </p>
          )}
          {bug.browser && (
            <p className="text-lg text-gray-700">
              <strong>Browser:</strong> {bug.browser}
            </p>
          )}
          {bug.os && (
            <p className="text-lg text-gray-700">
              <strong>OS:</strong> {bug.os}
            </p>
          )}
          <p className="text-lg font-semibold text-primary mt-4 mb-2">
            Steps to Reproduce
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
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-3">
              Additional Information
            </h4>
            {bug.additionalInfo?.length > 0 && (
              <div className="bg-gray-100 p-4 rounded-md">
                {bug.additionalInfo.map((info, index) => (
                  <div key={index} className="mb-3 p-3 border-b last:border-0">
                    <p className="font-bold text-gray-800">
                      {dayjs(info.date).format("YYYY-MM-DD HH:mm")}
                    </p>
                    <p className="mt-1 text-gray-700">{info.info}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {[
            { title: "Error Logs", content: bug.errorLogs },
            { title: "Stack Trace", content: bug.stackTrace },
          ].map((section, index) =>
            section.content ? (
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
            ) : null
          )}
        </div>
      </div>

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
        <DialogContent>
          <pre className="whitespace-pre-wrap text-gray-700">
            {modalContent.content}
          </pre>
        </DialogContent>
      </Dialog>
      <ToastContainer />
      <BugChatBox
        bugId={bugId}
        currentUser={{
          fullName: localStorage.getItem("loggedInUserFullName"),
          email: localStorage.getItem("loggedInUserEmail"),
          role: primaryRole,
        }}
      />
    </div>
  );
};

export default MentionedBugsDetials;
