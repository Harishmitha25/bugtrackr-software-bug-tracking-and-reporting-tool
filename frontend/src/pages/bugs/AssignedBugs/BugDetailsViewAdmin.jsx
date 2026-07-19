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
  TextField,
  IconButton,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Avatar,
  List,
  ListItem,
  ListItemText,
  Popper,
  Paper,
  ClickAwayListener,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import Attachment from "../../../components/Attachment";
import dayjs from "dayjs";
import {
  faEdit,
  faTrash,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import Alert from "@mui/material/Alert";
import MarkAsDuplicate from "../../../components/MarkAsDuplcate";
import { Tooltip } from "@mui/material";
import BugChatBox from "../../../components/BugChatBox";

const statusOptions = [
  "Open",
  "Assigned",
  "Fix In Progress",
  "Fixed (Testing Pending)",
  "Tester Assigned",
  "Testing In Progress",
  "Tested & Verified",
  "Closed",
];

const FIELD_LIMITS = { statusReason: { min: 10, max: 100 } };
const BugDetailsViewAdmin = ({ bugId, onClickingBack }) => {
  const [bug, setBug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", content: "" });

  const [developers, setDevelopers] = useState([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState("");
  const [testers, setTesters] = useState([]);
  const [selectedTester, setSelectedTester] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(bug?.status);

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
  const [selectedReason, setSelectedReason] = useState("");
  const [isStatusChanged, setIsStatusChanged] = useState(false);
  const [similarBugs, setSimilarBugs] = useState([]);
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);
  const token = localStorage.getItem("token");
  const userEmail = localStorage.getItem("loggedInUserEmail");

  //Allow developer assignment only when the bug status is open, assigned, fix in progress (if on sudden leave or reqeusted reallocation)
  const validStatusesForDeveloperAssignment = [
    "Open",
    "Assigned",
    "Fix In Progress",
  ];

  //Allow tester assignment only when the bug status is fixed (testing pending), tester assigned, testing in progress (if on sudden leave or reqeusted reallocation)
  const validStatusesForTesterAssignment = [
    "Fixed (Testing Pending)",
    "Tester Assigned",
    "Testing In Progress",
  ];

  // Fetch bug details that is assigned to the team
  useEffect(() => {
    const fetchBugDetails = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assigned/team/${bugId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.data.bugReport) {
          setBug(response.data.bugReport);
          setSelectedDeveloper(
            response.data.bugReport.assignedTo?.developer || ""
          );
          setSelectedTester(response.data.bugReport.assignedTo?.tester || "");
          setSelectedPriority(response.data.bugReport.priority);
          setAdditionalInfo(response.data.bugReport.additionalInfo || []);
          setSelectedStatus(response.data.bugReport.status || "");
          if (
            response.data.bugReport?.isPotentialDuplicate &&
            response.data.bugReport?.similarTo?.length > 0
          ) {
            response.data.bugReport.similarTo =
              response.data.bugReport.similarTo.filter((id) => id !== bugId);
            const similarBugPromises = response.data.bugReport?.similarTo.map(
              async (similarBugId) => {
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
                  return { bugId: similarBugId }; //fallback with just the id if there is some error
                }
              }
            );

            const similarBugDetails = await Promise.all(similarBugPromises);
            console.log(similarBugDetails);
            setSimilarBugs(similarBugDetails.filter(Boolean));
          }
        }
      } catch (err) {
        setError("Failed to fetch bug details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBugDetails();
  }, [bugId]);

  //Fetch developers list of the team
  useEffect(() => {
    if (bug?.application && bug?.assignedTeam) {
      const fetchDevelopers = async () => {
        try {
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/developers/${bug.application}/${bug.assignedTeam}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setDevelopers(response.data);
        } catch (err) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to fetch developers to assign bug"
          );
        }
      };
      fetchDevelopers();
    }
  }, [bug]);

  //Fetch testers list of the team
  useEffect(() => {
    if (bug?.application && bug?.assignedTeam) {
      const fetchTesters = async () => {
        try {
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/testers/${bug?.application}/${bug?.assignedTeam}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setTesters(response.data);
        } catch (err) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to fetch testers to assign bug"
          );
        }
      };
      fetchTesters();
    }
  }, [bug]);
  //To check for char count and update the reason state
  const handleReasonChange = (e) => {
    const { value } = e.target;
    const trimmedValue = value.slice(0, FIELD_LIMITS.statusReason.max);
    setSelectedReason(trimmedValue);
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

  //Fetch comments for the bug report selected
  useEffect(() => {
    if (!bug) return;
    const fetchBugData = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/${bug?.bugId}/details`,
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
    if (!bug || !bug.application) {
      return;
    }
    const fetchMentionableUsers = async () => {
      console.log("jbasdjksensdkj " + JSON.stringify(bug));
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/applications/${bug.application}/mentionable-users`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setmentionableUSers(response.data.users || []);
        setAllMentionableUSers(response.data.users || []);
        console.log(response.data);
      } catch (err) {
        console.error("Failed to fetch mentionable users.");
      }
    };

    fetchMentionableUsers();
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
      const alreadyAdded = prevMentions.some((u) => u.email === user.email);
      return alreadyAdded ? prevMentions : [...prevMentions, user];
    });

    setShowMentions(false);
  };

  //Set edited comment text and id
  const handleEditComment = (comment) => {
    if (editingCommentId === comment.id) {
      setEditingCommentId(null);
      setEditedCommentText("");
    } else {
      setEditingCommentId(comment.id);
      setEditedCommentText(comment.text);
    }
  };

  //Unset edited comment text and id
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditedCommentText("");
  };

  //To save edited comment
  const handleSaveEditedComment = async (commentId) => {
    if (!editedCommentText.trim()) {
      toast.error("Comment cannot be empty.");
      return;
    }

    const existingComment = comments.find(
      (comment) => comment.id === commentId
    );
    if (existingComment.text === editedCommentText) {
      setEditingCommentId(null);
      return;
    }

    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/comments/edit/${commentId}`,
        { bugId, updatedComment: editedCommentText },
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
      setEditedCommentText("");
    } catch (err) {
      console.log(err);
      toast.error(
        err.response.data?.error ||
          err.response?.data?.message ||
          "Failed to update comment."
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
        <p>Are you sure you want to delete this comment?</p>
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
          data: { bugId }, // need to pass body data via data field in the config object
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
          bugId: bug?.bugId,
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

  const statusSteps = [
    "Open",
    "Assigned",
    "Fix In Progress",
    "Fixed (Testing Pending)",
    "Tester Assigned",
    "Testing In Progress",
    "Tested & Verified",
    "Ready For Closure",
    "Closed",
  ];

  //Get the current status from the bug report and assign to the current status index
  const currentStatusIndex = statusSteps.indexOf(bug?.status);
  //Update bug status with reason (Team leads and admin are allowed to move the bug to any status)
  const handleUpdateBugStatus = async () => {
    if (!selectedStatus || !selectedReason) {
      toast.error("Please select a status and provide a reason.");
      return;
    }

    //Only allow reopening to 'Open' from 'Closed'
    if (selectedStatus === "Open" && bug.status !== "Closed") {
      toast.error(
        "Status only can be changed to 'Open' if the current status is 'Closed'."
      );
      return;
    }

    const isReopening = bug.status === "Closed" && selectedStatus === "Reopen";
    const endpoint = isReopening
      ? `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reopen-bug`
      : `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/update-status`;

    const requestBody = isReopening
      ? {
          bugId: bug.bugId,
          reason: selectedReason,
        }
      : {
          bugId: bug.bugId,
          status: selectedStatus,
          reason: selectedReason,
        };
    try {
      const response = await axios.put(
        endpoint,
        requestBody,

        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.message) {
        toast.success(response.data.message);
        if (isReopening) {
          setSelectedDeveloper("");
          setSelectedTester("");
          setSelectedPriority("");
        }
      } else {
        toast.success("Status updated successfully!");
      }

      setBug(response.data.bug);
      setSelectedStatus(response.data.bug.status);
      setSelectedReason("");
      setIsStatusChanged(false);
    } catch (err) {
      setSelectedStatus(null);
      setSelectedReason("");

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update status."
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

  //Show loader
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <CircularProgress />
      </div>
    );

  //Show error message
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  //To check if the comment is editable or deletable
  const isCommentEditablOrDeleteable = (createdAt) => {
    const commentTime = dayjs(createdAt);
    const currentTime = dayjs();
    const timeDiff = currentTime.diff(commentTime, "minute");

    return timeDiff <= 15;
  };

  const handleDuplicateCheck = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/check-duplicate`,
        {
          application: bug.application,
          title: bug.title,
          description: bug.description,
          stepsToReproduce: bug.stepsToReproduce,
          userSteps: bug.userSteps,
          bugId: bug.bugId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const { duplicates } = response.data;
      setDuplicateCheckDone(true);

      if (duplicates.length > 0) {
        setBug((prev) => ({
          ...prev,
          isPotentialDuplicate: true,
          similarTo: duplicates.map((d) => d.bugId),
        }));

        toast.success("Duplicate check completed. Similar bugs found.");
        setSimilarBugs(duplicates);
      } else {
        toast.info("No similar bugs found.");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to run duplicate check."
      );
    }
  };

  const handleAutoAssignDeveloper = async () => {
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/auto-assign-developer`,
        { bugId: bug.bugId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { message, fallbackNotice, developer, status } = response.data;

      if (developer?.email) {
        setSelectedDeveloper(developer.email);
        setSelectedStatus("Assigned");
        setBug((prev) => ({
          ...prev,
          assignedTo: { ...prev.assignedTo, developer: developer.email },
          status: status,
        }));

        toast.success(message || "Developer assigned successfully.");
        if (fallbackNotice) toast.info(fallbackNotice);
      } else {
        toast.warning("No eligible developer found for auto-assignment.");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to auto-assign developer."
      );
    }
  };

  const handleAutoAssignTester = async () => {
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/auto-assign-tester`,
        { bugId: bug.bugId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { message, fallbackNotice, tester, status } = response.data;

      if (tester?.email) {
        setSelectedTester(tester.email);
        setSelectedStatus("Tester Assigned");
        setBug((prev) => ({
          ...prev,
          assignedTo: { ...prev.assignedTo, tester: tester.email },
          status: status,
        }));

        toast.success(message || "Tester assigned successfully.");
        if (fallbackNotice) toast.info(fallbackNotice);
      } else {
        toast.warning("No eligible tester found for auto-assignment.");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to auto-assign tester."
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 bg-white shadow-lg rounded-lg">
      <button
        onClick={onClickingBack}
        className="text-primary hover:underline mb-4 flex items-center"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
        Back to Assigned Bugs
      </button>
      <div className="flex gap-10">
        <div className="flex-1">
          <div className="flex items-center mb-4">
            <h3 className="text-2xl font-bold">{bug.title}</h3>
            <span className="text font-semibold text-gray-700 bg-gray-200 px-4 py-1 rounded-full ml-4">
              {bug.bugId}
            </span>
          </div>

          {/* Status progress */}
          {bug?.status !== "Duplicate" && (
            <Stepper alternativeLabel className="my-6">
              {statusSteps.map((step, index) => (
                <Step
                  key={index}
                  completed={index < currentStatusIndex}
                  active={index === currentStatusIndex}
                >
                  {/* Set appropriate colour for the status */}
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
          <p className="text-gray-600 text-lg break-all whitespace-pre-wrap">
            {bug.description}
          </p>
          {bug.attachments.length > 0 && (
            <div className="mt-4">
              {bug.attachments.map((file, index) => {
                return <Attachment fileName={file} />;
              })}
            </div>
          )}
          <p className="text-lg text-gray-700">
            <strong>Application:</strong> {bug.application}
          </p>
          <p className="text-lg text-gray-700">
            <strong>Issue Type:</strong> {bug.issueType}
          </p>
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
          {bug.reportedBy && (
            <p className="text-lg text-gray-700">
              <strong>Reported By:</strong> {bug?.reportedBy?.name} (
              {bug?.reportedBy?.email})
            </p>
          )}
          {!bug.duplicateDetectionDone && !duplicateCheckDone && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleDuplicateCheck}
              sx={{ mt: 2 }}
            >
              Check for duplicate
            </Button>
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
                              Object.values(similarBug.userSteps || {}).join(
                                " "
                              )}
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
              bug.status = newStatus;
              bug.originalBugId = updatedOriginalBugId;
              bug.duplicateExplanation = updatedExplanation;

              setSelectedStatus(newStatus);
            }}
          />
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
                  zIndex: 1300, //Bring popper to the front (on top of elements)
                }}
              >
                <ClickAwayListener onClickAway={() => setShowMentions(false)}>
                  <Paper className="border rounded shadow-md p-2 w-64">
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

            <div class="max-h-[300px] overflow-y-auto border border-[#ddd] rounded-[5px] p-2.5">
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
                      primary={<strong>{comment.createdBy.name}</strong>}
                      secondary={
                        comment.deleted ? (
                          <em className="text-gray-500">
                            This comment was deleted by the person who commented
                            it
                            <p>{formatDateTime(comment.createdAt)}</p>
                          </em>
                        ) : editingCommentId === comment.id ? (
                          <div className="flex items-center gap-2">
                            {editingCommentId} - {comment.id}
                            <TextField
                              fullWidth
                              variant="outlined"
                              value={editedCommentText}
                              onChange={(e) =>
                                setEditedCommentText(e.target.value)
                              }
                            />
                            <IconButton
                              onClick={() =>
                                handleSaveEditedComment(comment.id)
                              }
                              color="success"
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </IconButton>
                            <IconButton
                              onClick={handleCancelEdit}
                              color="error"
                            >
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
                              {/* <span> because Tooltip (MUI component) does not work on disabled element (IconButton) so wrap
                               * it with <span> */}
                              <IconButton
                                size="small"
                                onClick={() => handleEditComment(comment)}
                                color="primary"
                                disabled={
                                  !isCommentEditablOrDeleteable(
                                    comment.createdAt
                                  )
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
                                  !isCommentEditablOrDeleteable(
                                    comment.createdAt
                                  )
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
        </div>

        {bug.assignedTeam === "unassigned" ? (
          <>
            <div className="w-1/3 bg-gray-50 p-4 rounded-lg shadow-md">
              <p className="text-lg text-gray-700 mb-2">
                <strong>Assign Team:</strong>
              </p>
              <FormControl fullWidth>
                <Select
                  value={bug.assignedTeam}
                  onChange={async (e) => {
                    try {
                      const response = await axios.put(
                        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assign-team`,
                        { bugId: bug.bugId, assignedTeam: e.target.value },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      setBug((prev) => ({
                        ...prev,
                        assignedTeam: response.data.bug.assignedTeam,
                      }));
                      toast.success("Team assigned successfully");
                    } catch (err) {
                      toast.error(
                        err.response.data?.error ||
                          err.response?.data?.message ||
                          "Failed to assign team"
                      );
                    }
                  }}
                >
                  <MenuItem value="frontend">Frontend</MenuItem>
                  <MenuItem value="backend">Backend</MenuItem>
                  <MenuItem value="devops">DevOps</MenuItem>
                </Select>
              </FormControl>
            </div>
          </>
        ) : (
          <>
            <div className="w-1/3 bg-gray-50 p-4 rounded-lg shadow-md">
              {bug.issueType === "Other" && bug.otherIssueDescription && (
                <p className="text-lg text-gray-700">
                  <strong>Other Issue Description:</strong>{" "}
                  {bug.otherIssueDescription}
                </p>
              )}
              {/* Set priority */}
              <FormControl fullWidth style={{ marginBottom: "0.5rem" }}>
                <p className="text-lg text-gray-700">
                  <strong>Set Priority:</strong>
                </p>
                <Select
                  value={selectedPriority || bug?.priority}
                  onChange={async (e) => {
                    setSelectedPriority(e.target.value);
                    try {
                      console.log(bug);
                      await axios.put(
                        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/set-priority`,
                        { bugId: bug.bugId, priority: e.target.value },
                        {
                          headers: { Authorization: `Bearer ${token}` },
                          params: {
                            application: bug.application,
                            team: bug.assignedTeam,
                          },
                        }
                      );
                      toast.success("Priority updated successfully");
                    } catch (err) {
                      console.log(err);
                      toast.error(
                        err.response?.data?.message ||
                          "Failed to update priority"
                      );
                    }
                  }}
                >
                  {["Critical", "High", "Medium", "Low"].map((level) => (
                    <MenuItem key={level} value={level}>
                      {level}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* Assign developer */}
              {validStatusesForDeveloperAssignment.includes(bug.status) && (
                <FormControl
                  fullWidth
                  style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}
                >
                  <p className="text-lg text-gray-700">
                    <strong>Assign Developer:</strong>
                  </p>
                  <Select
                    value={selectedDeveloper || bug.assignedTo?.developer}
                    onChange={async (e) => {
                      // setSelectedDeveloper(e.target.value);
                      // setSelectedStatus("Assigned"); //To update the dropdown value after developer assignment
                      try {
                        const response = await axios.put(
                          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assign-developer`,
                          { bugId: bug.bugId, developerEmail: e.target.value },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        setSelectedDeveloper(
                          e.target.value === "Unassign"
                            ? "Unassigned"
                            : e.target.value
                        );
                        setSelectedStatus(
                          e.target.value === "Unassign" ? "Open" : "Assigned"
                        ); //To update the dropdown value after developer assignment
                        // toast.success("Developer assigned successfully");
                        toast.success(
                          e.target.value === "Unassign"
                            ? "Developer unassigned successfully"
                            : "Developer assigned successfully"
                        );
                        setBug(response.data.bug);
                      } catch (err) {
                        toast.error(
                          err.response.data?.error ||
                            err.response?.data?.message ||
                            "Failed to assign developer"
                        );
                      }
                    }}
                  >
                    {developers.length > 0 &&
                      developers.map((dev) => (
                        <MenuItem key={dev.email} value={dev.email}>
                          {dev.fullName} ({dev.email})
                        </MenuItem>
                      ))}
                    {bug.assignedTo?.developer && (
                      <MenuItem value="Unassign">Unassign</MenuItem>
                    )}
                  </Select>
                  {!bug.assignedTo?.developer && (
                    <>
                      <p className="text-center text-sm text-gray-500 my-2 font-semibold">
                        OR
                      </p>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleAutoAssignDeveloper}
                        style={{ marginTop: "0.5rem" }}
                      >
                        Auto-Assign Developer
                      </Button>
                    </>
                  )}
                </FormControl>
              )}
              {validStatusesForTesterAssignment.includes(bug.status) && (
                <FormControl
                  fullWidth
                  style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}
                >
                  <p className="text-lg text-gray-700">
                    <strong>Assign Tester:</strong>
                  </p>
                  <Select
                    value={selectedTester || bug.assignedTo?.tester}
                    onChange={async (e) => {
                      setSelectedTester(e.target.value);
                      setSelectedStatus("Tester Assigned"); //To update the dropdown value after tester assignment

                      try {
                        const response = await axios.put(
                          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assign-tester`,
                          { bugId: bug.bugId, testerEmail: e.target.value },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        setSelectedTester(
                          e.target.value === "Unassign"
                            ? "Unassigned"
                            : e.target.value
                        );

                        setSelectedStatus(
                          e.target.value === "Unassign"
                            ? "Fixed (Testing Pending)"
                            : "Tester Assigned"
                        );
                        toast.success(
                          e.target.value === "Unassign"
                            ? "Tester unassigned successfully"
                            : "Tester assigned successfully"
                        );
                        setBug(response.data.bug);
                      } catch (err) {
                        toast.error(
                          err.response.data?.error ||
                            err.response?.data?.message ||
                            "Failed to assign tester"
                        );
                      }
                    }}
                  >
                    {testers.length > 0 &&
                      testers.map((tester) => (
                        <MenuItem key={tester.email} value={tester.email}>
                          {tester.fullName} ({tester.email})
                        </MenuItem>
                      ))}
                    {bug.assignedTo?.tester && (
                      <MenuItem value="Unassign">Unassign</MenuItem>
                    )}
                  </Select>
                  {!bug.assignedTo?.tester && (
                    <>
                      <p className="text-center text-sm text-gray-500 my-2 font-semibold">
                        OR
                      </p>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleAutoAssignTester}
                        style={{ marginTop: "0.5rem" }}
                      >
                        Auto-Assign Tester
                      </Button>
                    </>
                  )}
                </FormControl>
              )}
              <div className="border-t border-gray-300 mt-4"></div>

              <FormControl fullWidth margin="normal">
                <p className="text-lg text-gray-700">
                  <strong>Select Status:</strong>
                </p>
                <Select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setIsStatusChanged(true);
                  }}
                >
                  <MenuItem value={bug.status}>{bug.status}</MenuItem>
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                  {bug.status === "Closed" && (
                    <MenuItem value="Reopen">Reopen</MenuItem>
                  )}
                </Select>
              </FormControl>
              {isStatusChanged && selectedStatus && (
                <Alert severity="info" className="mt-2 mb-2">
                  Please change status and provide a reason and click{" "}
                  <strong>Update Status</strong>
                  to apply the changes.
                </Alert>
              )}
              <TextField
                label="Reason for Status Change"
                value={selectedReason}
                onChange={handleReasonChange}
                fullWidth
                margin="normal"
                helperText={
                  <span
                    style={{
                      color:
                        selectedReason.length > 0 &&
                        selectedReason.length < FIELD_LIMITS.statusReason.min
                          ? "red"
                          : "grey",
                    }}
                  >
                    {selectedReason.length < FIELD_LIMITS.statusReason.min
                      ? `Reason must be at least ${FIELD_LIMITS.statusReason.min} characters.`
                      : selectedReason.length >=
                        FIELD_LIMITS.statusReason.max - 10
                      ? `Max limit: ${
                          FIELD_LIMITS.statusReason.max
                        } characters (Remaining - ${
                          FIELD_LIMITS.statusReason.max - selectedReason.length
                        })`
                      : ""}
                  </span>
                }
              />

              <Button
                variant="contained"
                color="primary"
                onClick={handleUpdateBugStatus}
                disabled={!selectedStatus || !selectedReason}
                className="mt-2.5"
              >
                Update Status
              </Button>
              <p className="text-lg font-semibold text-primary">
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
              {additionalInfo.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-primary">
                    Additional Information
                  </h2>
                  <ul className="list-disc pl-5 text-gray-700">
                    {additionalInfo.map((item, index) => (
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
          </>
        )}
      </div>

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
      <BugChatBox
        bugId={bug.bugId}
        currentUser={{
          fullName: localStorage.getItem("loggedInUserFullName"),
          email: localStorage.getItem("loggedInUserEmail"),
          role: "admin",
        }}
      />
      <ToastContainer />
    </div>
  );
};

export default BugDetailsViewAdmin;
