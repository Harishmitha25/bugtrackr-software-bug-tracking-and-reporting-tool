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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPaperclip } from "@fortawesome/free-solid-svg-icons";
import BugChatBox from "../../../components/BugChatBox";
import Attachment from "../../../components/Attachment";

const ReportedBugDetails = ({ bugId, onClickingBack }) => {
  const [bug, setBug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", content: "" });
  const [additionalInfo, setAdditionalInfo] = useState([]);
  const [newInfo, setNewInfo] = useState("");
  const loggedInUserEmail = localStorage.getItem("loggedInUserEmail");
  const roleHierarchy = ["user", "developer", "tester", "teamlead", "admin"];

  //Fetch bug details
  useEffect(() => {
    const fetchBugDetails = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reported/${bugId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        console.log(response);
        setBug(response.data.bugReport);
        setAdditionalInfo(response.data.bugReport.additionalInfo || []);
      } catch (err) {
        setError("Failed to fetch bug details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBugDetails();
  }, [bugId]);

  //Add additional information
  const handleAddInfo = async () => {
    if (newInfo.trim().length < 10) {
      toast.error("additional information should be atleast 10 chars");
      return;
    }

    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reported/${bugId}/add-info`,
        { info: newInfo },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      setAdditionalInfo([
        { date: dayjs().format("YYYY-MM-DD HH:mm:ss"), info: newInfo },
        ...additionalInfo,
      ]);
      setNewInfo("");
    } catch (err) {
      toast.error("Failed to add additional information");
    }
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

  //Format (in a user friendly manner) date and time of additional information added
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

  const statusSteps = [
    "Open",
    "Assigned",
    "Fix In Progress",
    "Fixed (Testing Pending)",
    "Tester Assigned",
    "Testing In Progress",
    "Closed",
  ];

  //Get the current status from the bug report and assign to the current status index
  const currentStatusIndex = statusSteps.indexOf(bug?.status);

  //Show loader
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

  //Show error message
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="max-w-6xl mx-auto p-8 bg-white shadow-lg rounded-lg">
      <button
        onClick={onClickingBack}
        className="text-primary hover:underline mb-4 flex items-center"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
        Back to Reported Bugs
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
          <p className="text-gray-600 text-lg mb-4 break-all whitespace-pre-wrap">
            {bug.description}
          </p>
          {bug.attachments.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-primary">
                Attachments
              </h2>
              <div className="mt-4">
                {bug.attachments.map((file, index) => {
                  return <Attachment fileName={file} key={index} />;
                })}
              </div>
            </>
          )}

          {/* Add additional information */}
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-3">
              Additional Information
            </h4>
            {bug.reportedBy.email === loggedInUserEmail && (
              <div className="flex items-center mb-4 space-x-2">
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder="Add additional information"
                  value={newInfo}
                  onChange={(e) => setNewInfo(e.target.value)}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAddInfo}
                >
                  Add
                </Button>
              </div>
            )}
            {additionalInfo.length > 0 && (
              <div className="bg-gray-100 p-4 rounded-md">
                {additionalInfo.map((info, index) => (
                  <div key={index} className="mb-3 p-3 border-b last:border-0">
                    <p className="font-bold text-gray-800">
                      {formatDateTime(info.date)}
                    </p>

                    <p className="mt-1 text-gray-700">{info.info}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-1/3 bg-gray-50 p-4 rounded-lg shadow-md">
          <p className="text-lg text-gray-700">
            <strong>Application:</strong> {bug.application}
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

export default ReportedBugDetails;
