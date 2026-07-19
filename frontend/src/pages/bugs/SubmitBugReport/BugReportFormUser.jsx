import React, { useState, useEffect, useCallback } from "react";
import {
  TextField,
  Select,
  MenuItem,
  Button,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";

//Character limits for each fields
const FIELD_LIMITS = {
  title: { min: 15, max: 30 },
  description: { min: 30, max: 100 },
  userStep1: { min: 20, max: 300 },
  userStep2: { min: 20, max: 300 },
  otherIssueDescription: { min: 15, max: 50 },
  maxAttachments: 5,
};

const BugReportFormUser = () => {
  const userRole = localStorage.getItem("primaryRole");
  const userEmail = localStorage.getItem("loggedInUserEmail");
  const token = localStorage.getItem("token");

  const [bugReportFormErrors, setBugReportFormErrors] = useState({});
  const [issueTypes, setIssueTypes] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [fullBugReportFormData, setfullBugReportFormData] = useState(null);

  // Function to auto detect the current browser and OS
  const getBrowserAndOS = () => {
    const userAgent = navigator.userAgent;

    let os = "Unknown OS";
    if (userAgent.indexOf("Win") !== -1) os = "Windows";
    else if (userAgent.indexOf("Mac") !== -1) os = "MacOS";
    else if (userAgent.indexOf("Linux") !== -1) os = "Linux";
    else if (userAgent.indexOf("Android") !== -1) os = "Android";
    else if (
      userAgent.indexOf("iPhone") !== -1 ||
      userAgent.indexOf("iPad") !== -1
    )
      os = "iOS";

    let browser = "Unknown Browser";
    if (userAgent.indexOf("Edg") !== -1) browser = "Edge";
    else if (userAgent.indexOf("Chrome") !== -1) browser = "Chrome";
    else if (userAgent.indexOf("Firefox") !== -1) browser = "Firefox";
    else if (
      userAgent.indexOf("Safari") !== -1 &&
      userAgent.indexOf("Chrome") === -1
    )
      browser = "Safari";
    else if (
      userAgent.indexOf("MSIE") !== -1 ||
      userAgent.indexOf("Trident") !== -1
    )
      browser = "Internet Explorer";

    return { browser, os };
  };

  //Initialise bugReportFormData
  const [bugReportFormData, setBugReportFormData] = useState({
    application: "",
    issueType: "",
    title: "",
    description: "",
    userStep1: "",
    userStep2: "",
    attachments: [],
    browser: getBrowserAndOS().browser,
    os: getBrowserAndOS().os,
    otherIssueDescription: "",
    assignedTeam: "",
    status: "Open",
  });

  //Get issue types based on role
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/issue-types?userRole=${userRole}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setIssueTypes(res.data))
      .catch((err) => console.error("Error fetching issue types", err));
  }, [userRole]);

  //Check and update form and erro states
  const handleTextChange = (e) => {
    const { name, value } = e.target;
    if (FIELD_LIMITS[name] && value.length > FIELD_LIMITS[name].max) return;
    const trimmedValue = FIELD_LIMITS[name]
      ? value.slice(0, FIELD_LIMITS[name].max)
      : value;

    setBugReportFormData((prev) => ({ ...prev, [name]: trimmedValue }));
    setBugReportFormErrors((prev) => ({ ...prev, [name]: false }));
  };

  //Set form data and form errors
  const handleChange = (e) => {
    const { name, value } = e.target;
    setBugReportFormData((prev) => ({ ...prev, [name]: value }));
    setBugReportFormErrors((prev) => ({ ...prev, [name]: false }));

    if (name === "issueType") {
      const associatedTeam = getTeamAsscociatedToIssueType(value);
      setBugReportFormData((prev) => ({
        ...prev,
        assignedTeam: associatedTeam,
      }));
    }
  };
  //Get team associated with the issue type
  const getTeamAsscociatedToIssueType = (issueTypeName) => {
    const issue = issueTypes.find((type) => type.name === issueTypeName);
    return issue ? issue.associatedTeam : "unassigned";
  };

  // Validate form fields
  const validateFields = () => {
    let errors = {};
    Object.keys(FIELD_LIMITS).forEach((field) => {
      if (
        (!bugReportFormData[field] ||
          bugReportFormData[field].length < FIELD_LIMITS[field].min) &&
        (field !== "otherIssueDescription" ||
          bugReportFormData.issueType === "Other") &&
        (field !== "maxAttachments" ||
          bugReportFormData.attachments.length > FIELD_LIMITS.maxAttachments)
      ) {
        errors[field] = true;
      }
    });

    if (!bugReportFormData.application) errors.application = true;
    if (!bugReportFormData.issueType) errors.issueType = true;

    return errors;
  };

  //Files limit configuration and update state
  const onDrop = useCallback(
    (acceptedFiles) => {
      const totalFiles =
        bugReportFormData.attachments.length + acceptedFiles.length;

      if (totalFiles > FIELD_LIMITS.maxAttachments) {
        toast.error("Max upload 5 files.");
        return;
      }

      setBugReportFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...acceptedFiles],
      }));
    },
    [bugReportFormData.attachments]
  );

  // Files rejection due to invalid formats and more than 5 files added
  const onDropRejected = useCallback((fileRejections) => {
    console.log(fileRejections);
    if (fileRejections[0].errors[0]?.code === "file-invalid-type") {
      toast.error("Invalid file format. Allowed files are images and videos");
    } else if (fileRejections[0].errors[0]?.code === "too-many-files") {
      toast.error("Max upload 5 files.");
    }
  }, []);

  // Remove files from attachments list
  const handleRemoveFile = (index) => {
    setBugReportFormData((prev) => {
      const updatedFiles = prev.attachments.filter((_, i) => i !== index);
      return { ...prev, attachments: updatedFiles };
    });
  };

  // Dropzone config - allows only images and videos for geenral users
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDropRejected,
    multiple: true,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"],
      "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"],
    },
    maxFiles: FIELD_LIMITS.maxAttachments,
  });

  // Validate fields and submit bug report
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitted(true);

    const errors = validateFields();
    console.log(errors);
    setBugReportFormErrors(errors);

    if (Object.values(errors).some((err) => err)) {
      toast.error(
        "Please fill all required fields and/or adhere to the standards of the fields."
      );
      return;
    }
    const bugReportFormDataToSend = new FormData();

    try {
      bugReportFormDataToSend.append("title", bugReportFormData.title);
      bugReportFormDataToSend.append(
        "description",
        bugReportFormData.description
      );
      bugReportFormDataToSend.append(
        "application",
        bugReportFormData.application
      );
      bugReportFormDataToSend.append("issueType", bugReportFormData.issueType);
      bugReportFormDataToSend.append("browser", bugReportFormData.browser);
      bugReportFormDataToSend.append("os", bugReportFormData.os);
      bugReportFormDataToSend.append("userRole", userRole);

      bugReportFormDataToSend.append(
        "reporterName",
        localStorage.getItem("loggedInUserFullName")
      );
      bugReportFormDataToSend.append("reporterEmail", userEmail);

      bugReportFormDataToSend.append("userStep1", bugReportFormData.userStep1);
      bugReportFormDataToSend.append("userStep2", bugReportFormData.userStep2);
      bugReportFormDataToSend.append(
        "assignedTeam",
        bugReportFormData.assignedTeam
      );

      bugReportFormDataToSend.append("status", bugReportFormData.status);

      if (bugReportFormData.issueType === "Other") {
        bugReportFormDataToSend.append(
          "otherIssueDescription",
          bugReportFormData.otherIssueDescription
        );
      }

      if (bugReportFormData.attachments.length > 0) {
        bugReportFormData.attachments.forEach((file) => {
          bugReportFormDataToSend.append("attachments", file);
        });
      }

      const autoPriority = await classifyBugPriority(
        bugReportFormData.application,
        bugReportFormData.title,
        bugReportFormData.description
      );

      if (autoPriority) {
        bugReportFormDataToSend.append("priority", autoPriority);
      }
      const duplcaiteCheckResponse = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/check-duplicate`,
        {
          application: bugReportFormData.application,
          title: bugReportFormData.title,
          description: bugReportFormData.description,
          userSteps: {
            step1: bugReportFormData.userStep1,
            step2: bugReportFormData.userStep2,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const duplicates = duplcaiteCheckResponse.data.duplicates;
      bugReportFormDataToSend.append("duplicateDetectionDone", true);

      if (duplicates.length > 0) {
        bugReportFormDataToSend.append("isPotentialDuplicate", true);
        bugReportFormDataToSend.append(
          "similarTo",
          JSON.stringify(duplicates.map((bug) => bug.bugId))
        );

        setfullBugReportFormData(bugReportFormDataToSend);
        setDuplicates(duplicates);
        setShowDuplicateWarning(true);
      } else {
        await finalizeSubmission(bugReportFormDataToSend);
      }
    } catch (error) {
      finalizeSubmission(bugReportFormDataToSend); // IF there is any error smoothly submit the report without overloading
      //reporter with toast like duplciate check failed or smething
    }
  };

  const classifyBugPriority = async (application, title, description) => {
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/classify-priority`,
        {
          application,
          title,
          description,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(res.data);
      const priority = res.data.priority;
      return priority;
    } catch (err) {
      console.error("Priority classification failed", err.message);
      return null;
    }
  };

  const finalizeSubmission = async (bugReportFormDataToSend) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/submit`,
        bugReportFormDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success("Bug report submitted successfully.");
      resetForm();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Error finalizing the bug submission."
      );
    }
  };

  const handleSubmitAnyway = () => {
    if (fullBugReportFormData) {
      setShowDuplicateWarning(false);
      finalizeSubmission(fullBugReportFormData);
    } else {
      toast.error("Please try again.");
    }
  };

  const handleCancelSubmit = () => {
    setShowDuplicateWarning(false);
    resetForm();
  };
  const resetForm = () => {
    setBugReportFormData({
      application: "",
      issueType: "",
      title: "",
      description: "",
      userStep1: "",
      userStep2: "",
      attachments: [],
      browser: "",
      os: "",
      assignedTeam: "",
      otherIssueDescription: "",
      status: "Open",
    });
    setBugReportFormErrors({});
    setIsSubmitted(false);
    setDuplicates([]);
    setShowDuplicateWarning(false);
  }; //Format the date and time the comment was added
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

  return (
    <div className="flex flex-col h-full w-full">
      <div className="bg-primary text-white p-2 shadow-md">Report a Bug</div>

      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <TextField
            fullWidth
            label={
              <span>
                Bug Title <span className="text-red-500">*</span>
              </span>
            }
            name="title"
            value={bugReportFormData.title || ""}
            inputProps={{ maxLength: FIELD_LIMITS.title.max }}
            onChange={handleTextChange}
            error={
              isSubmitted &&
              (bugReportFormErrors.title ||
                bugReportFormData.title.length < FIELD_LIMITS.title.min)
            }
            helperText={
              <span
                style={{
                  color:
                    bugReportFormData.title.length > 0 &&
                    bugReportFormData.title.length < FIELD_LIMITS.title.min
                      ? "red"
                      : "grey",
                }}
              >
                {bugReportFormData.title.length < FIELD_LIMITS.title.min
                  ? `Title must be at least ${FIELD_LIMITS.title.min} characters.`
                  : bugReportFormData.title.length >= FIELD_LIMITS.title.max - 5
                  ? `Max limit: ${
                      FIELD_LIMITS.title.max
                    } characters (Remaining - ${
                      FIELD_LIMITS.title.max - bugReportFormData.title.length
                    })`
                  : ""}
              </span>
            }
          />

          <TextField
            fullWidth
            label={
              <span>
                Description <span className="text-red-500">*</span>
              </span>
            }
            name="description"
            value={bugReportFormData.description || ""}
            onChange={handleTextChange}
            multiline
            rows={3}
            inputProps={{ maxLength: FIELD_LIMITS.description.max }}
            error={
              isSubmitted &&
              (bugReportFormErrors.description ||
                bugReportFormData.description.length <
                  FIELD_LIMITS.description.min)
            }
            helperText={
              <span
                style={{
                  color:
                    bugReportFormData.description.length > 0 &&
                    bugReportFormData.description.length <
                      FIELD_LIMITS.description.min
                      ? "red"
                      : "grey",
                }}
              >
                {bugReportFormData.description.length <
                FIELD_LIMITS.description.min
                  ? `Description must be at least ${FIELD_LIMITS.description.min} characters.`
                  : bugReportFormData.description.length >=
                    FIELD_LIMITS.description.max - 5
                  ? `Max limit: ${
                      FIELD_LIMITS.description.max
                    } characters (Remaining - ${
                      FIELD_LIMITS.description.max -
                      bugReportFormData.description.length
                    })`
                  : ""}
              </span>
            }
          />

          <FormControl
            fullWidth
            error={isSubmitted && bugReportFormErrors.application}
          >
            <InputLabel shrink={bugReportFormData.application !== ""}>
              Application <span className="text-red-500">*</span>
            </InputLabel>
            <Select
              name="application"
              value={bugReportFormData.application || ""}
              onChange={handleChange}
              displayEmpty
            >
              {JSON.parse(localStorage.getItem("roles") || "[]")
                .map((role) => role.application)
                .filter((value, index, self) => self.indexOf(value) === index)
                .map((app) => (
                  <MenuItem key={app} value={app}>
                    {app}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl
            fullWidth
            error={isSubmitted && bugReportFormErrors.issueType}
          >
            <InputLabel shrink={bugReportFormData.issueType !== ""}>
              Issue Type <span className="text-red-500">*</span>
            </InputLabel>
            <Select
              name="issueType"
              value={bugReportFormData.issueType || ""}
              onChange={handleChange}
              displayEmpty
            >
              {issueTypes.map((type) => (
                <MenuItem key={type.name} value={type.name}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Only visible if the issue type is "Other"*/}

          {bugReportFormData.issueType === "Other" && (
            <TextField
              fullWidth
              name="otherIssueDescription"
              value={bugReportFormData.otherIssueDescription || ""}
              onChange={handleTextChange}
              multiline
              label={
                <span>
                  Please explain <span className="text-red-500">*</span>
                </span>
              }
              rows={3}
              inputProps={{ maxLength: FIELD_LIMITS.otherIssueDescription.max }}
              error={
                isSubmitted &&
                (bugReportFormErrors.otherIssueDescription ||
                  bugReportFormData.otherIssueDescription.length <
                    FIELD_LIMITS.otherIssueDescription.min)
              }
              helperText={
                <span
                  style={{
                    color:
                      bugReportFormData.otherIssueDescription.length > 0 &&
                      bugReportFormData.otherIssueDescription.length <
                        FIELD_LIMITS.otherIssueDescription.min
                        ? "red"
                        : "grey",
                  }}
                >
                  {bugReportFormData.otherIssueDescription.length <
                  FIELD_LIMITS.otherIssueDescription.min
                    ? `Explanation must be at least ${FIELD_LIMITS.otherIssueDescription.min} characters.`
                    : bugReportFormData.otherIssueDescription.length >=
                      FIELD_LIMITS.otherIssueDescription.max - 5
                    ? `Max limit: ${
                        FIELD_LIMITS.otherIssueDescription.max
                      } characters (Remaining - ${
                        FIELD_LIMITS.otherIssueDescription.max -
                        bugReportFormData.otherIssueDescription.length
                      })`
                    : ""}
                </span>
              }
            />
          )}
          <p className="text-grey">Help Reproduce Issue</p>
          <TextField
            fullWidth
            label={
              <span>
                What were you trying to do?{" "}
                <span className="text-red-500">*</span>
              </span>
            }
            name="userStep1"
            value={bugReportFormData.userStep1 || ""}
            onChange={handleTextChange}
            multiline
            rows={2}
            inputProps={{ maxLength: FIELD_LIMITS.userStep1.max }}
            error={
              isSubmitted &&
              (bugReportFormErrors.userStep1 ||
                bugReportFormData.userStep1.length < FIELD_LIMITS.userStep1.min)
            }
            helperText={
              <span
                style={{
                  color:
                    bugReportFormData.userStep1.length > 0 &&
                    bugReportFormData.userStep1.length <
                      FIELD_LIMITS.userStep1.min
                      ? "red"
                      : "grey",
                }}
              >
                {bugReportFormData.userStep1.length < FIELD_LIMITS.userStep1.min
                  ? `Must be at least ${FIELD_LIMITS.userStep1.min} characters.`
                  : bugReportFormData.userStep1.length >=
                    FIELD_LIMITS.userStep1.max - 5
                  ? `Max limit: ${
                      FIELD_LIMITS.userStep1.max
                    } characters (Remaining - ${
                      FIELD_LIMITS.userStep1.max -
                      bugReportFormData.userStep1.length
                    })`
                  : ""}
              </span>
            }
          />

          <TextField
            fullWidth
            label={
              <span>
                What happened instead? <span className="text-red-500">*</span>
              </span>
            }
            name="userStep2"
            value={bugReportFormData.userStep2 || ""}
            onChange={handleTextChange}
            multiline
            rows={2}
            inputProps={{ maxLength: FIELD_LIMITS.userStep2.max }}
            error={
              isSubmitted &&
              (bugReportFormErrors.userStep2 ||
                bugReportFormData.userStep2.length < FIELD_LIMITS.userStep2.min)
            }
            helperText={
              <span
                style={{
                  color:
                    bugReportFormData.userStep2.length > 0 &&
                    bugReportFormData.userStep2.length <
                      FIELD_LIMITS.userStep2.min
                      ? "red"
                      : "grey",
                }}
              >
                {bugReportFormData.userStep2.length < FIELD_LIMITS.userStep2.min
                  ? `Must be at least ${FIELD_LIMITS.userStep2.min} characters.`
                  : bugReportFormData.userStep2.length >=
                    FIELD_LIMITS.userStep2.max - 5
                  ? `Max limit: ${
                      FIELD_LIMITS.userStep2.max
                    } characters (Remaining - ${
                      FIELD_LIMITS.userStep2.max -
                      bugReportFormData.userStep2.length
                    })`
                  : ""}
              </span>
            }
          />
          <FormControl fullWidth>
            <InputLabel>Browser</InputLabel>
            <Select
              name="browser"
              value={bugReportFormData.browser || ""}
              onChange={handleChange}
            >
              <MenuItem value="" disabled>
                Select Browser
              </MenuItem>
              {["Chrome", "Firefox", "Safari", "Edge"].map((browser) => (
                <MenuItem key={browser} value={browser}>
                  {browser}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>OS</InputLabel>
            <Select
              name="os"
              value={bugReportFormData.os || ""}
              onChange={handleChange}
            >
              <MenuItem value="" disabled>
                Select OS
              </MenuItem>
              {["Windows", "MacOS", "Linux", "Android", "iOS"].map((os) => (
                <MenuItem key={os} value={os}>
                  {os}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <div
            {...getRootProps()}
            className="border-dashed border-2 p-4 text-center cursor-pointer"
          >
            <input {...getInputProps()} />
            <p>Drag & drop images/videos here, or click to select</p>
          </div>
          {bugReportFormData.attachments.length > 0 && (
            <ul>
              {bugReportFormData.attachments.map((file, index) => (
                <li key={index} className="flex justify-between items-center">
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-500 ml-2"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button type="submit" variant="contained" color="primary" fullWidth>
            Submit Bug Report
          </Button>
        </form>
        <Dialog open={showDuplicateWarning} onClose={handleCancelSubmit}>
          <DialogTitle className="flex justify-between items-center">
            Potential Duplicate Bugs Found
            <IconButton onClick={handleCancelSubmit} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <p className="mb-2">
              The following bugs are similar to the one you are submitting:
            </p>
            <List>
              {duplicates.map((duplicate) => (
                <ListItem key={duplicate.bugId} alignItems="flex-start">
                  <ListItemText
                    primary={
                      <div>
                        <div className="text-sm text-gray-600">
                          <strong>Bug ID:</strong> {duplicate.bugId}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Title:</strong> {duplicate.title}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Status:</strong> {duplicate.status}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Reported:</strong>{" "}
                          {duplicate.createdAt
                            ? formatDateTime(duplicate.createdAt)
                            : "N/A"}
                        </div>
                      </div>
                    }
                    secondary={
                      <div className="text-sm text-gray-700 mt-1">
                        <div>
                          <strong>Description:</strong> {duplicate.description}
                        </div>
                        <div className="mt-1">
                          <strong>Steps to Reproduce:</strong>{" "}
                          {duplicate.stepsToReproduce
                            ? duplicate.stepsToReproduce
                            : duplicate.userSteps
                            ? `${duplicate.userSteps.step1 || ""} ${
                                duplicate.userSteps.step2 || ""
                              }`
                            : "N/A"}
                        </div>
                      </div>
                    }
                  />
                </ListItem>
              ))}
            </List>
            <div className="flex justify-between mt-4">
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmitAnyway}
              >
                Submit Anyway
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleCancelSubmit}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ToastContainer />
    </div>
  );
};

export default BugReportFormUser;
