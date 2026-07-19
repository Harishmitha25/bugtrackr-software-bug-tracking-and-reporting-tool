import React, { useEffect, useState } from "react";
import axios from "axios";
import { TextField, Button } from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import { useTheme } from "@mui/material/styles";
import "react-toastify/dist/ReactToastify.css";

const TesterTestedBugs = () => {
  const [bugs, setBugs] = useState([]);
  const [reasonInputs, setReasonInputs] = useState({});
  const [reasonErrors, setReasonErrors] = useState({});
  const [hoursInputs, setHoursInputs] = useState({});
  const [hoursErrors, setHoursErrors] = useState({});

  const theme = useTheme();
  const token = localStorage.getItem("token");
  const email = localStorage.getItem("loggedInUserEmail");

  const FIELD_LIMITS = {
    reopenReason: { min: 10, max: 100 },
  };

  //Get tested bugs by the tester
  useEffect(() => {
    axios
      .get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assigned/tester/${email}/tested-bugs`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        const filteredBugs = res.data.bugs.filter((bug) => !bug.reopened);

        if (filteredBugs) setBugs(filteredBugs);
        const initialHours = {};
        filteredBugs.forEach((bug) => {
          initialHours[bug.bugId] =
            bug.testerValidationHours !== undefined &&
            bug.testerValidationHours !== null
              ? bug.testerValidationHours
              : "";
        });
        setHoursInputs(initialHours);
      })
      .catch(() => {
        toast.error("Failed to fetch tested bugs");
      });
  }, []);

  //Check for reason and update state and error states
  const handleReasonChange = (bugId, value) => {
    if (value.length <= FIELD_LIMITS.reopenReason.max) {
      setReasonInputs((prev) => ({ ...prev, [bugId]: value }));
      if (!value || value.length < FIELD_LIMITS.reopenReason.min) {
        setReasonErrors((prev) => ({
          ...prev,
          [bugId]: `Reason must be at least ${FIELD_LIMITS.reopenReason.min} characters.`,
        }));
      } else {
        setReasonErrors((prev) => ({ ...prev, [bugId]: "" }));
      }
    }
  };

  //Check and submit reopen request
  const handleReopenRequest = async (bugId) => {
    const reason = reasonInputs[bugId]?.trim();
    if (!reason || reason.length < FIELD_LIMITS.reopenReason.min) {
      setReasonErrors((prev) => ({
        ...prev,
        [bugId]: `Reason must be at least ${FIELD_LIMITS.reopenReason.min} characters.`,
      }));
      toast.error("Reason must be at least 10 characters.");
      return;
    }

    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reopen-bug`,
        { bugId, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Reopen request sent successfully!");
      setReasonInputs((prev) => ({ ...prev, [bugId]: "" }));
      setReasonErrors((prev) => ({ ...prev, [bugId]: "" }));
      setBugs((prevBugs) =>
        prevBugs.map((bug) =>
          bug.bugId === bugId
            ? {
                ...bug,
                reopenRequests: [
                  ...(bug.reopenRequests || []),
                  {
                    requestedBy: email,
                    reason,
                    requestStatus: "Pending",
                  },
                ],
              }
            : bug
        )
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to request reopening"
      );
    }
  };

  //Get reopened requests with pending status
  const getPendingReopenRequest = (bug) => {
    return bug.reopenRequests?.find(
      (req) => req.requestedBy === email && req.requestStatus === "Pending"
    );
  };

  const handleHoursChange = (bugId, value) => {
    const num = parseInt(value);
    setHoursInputs((prev) => ({ ...prev, [bugId]: value }));

    if (isNaN(num) || num < 0) {
      setHoursErrors((prev) => ({ ...prev, [bugId]: "Invalid number" }));
    } else {
      setHoursErrors((prev) => ({ ...prev, [bugId]: "" }));
    }
  };

  const handleUpdateHours = async (bug) => {
    const hoursWorked = parseInt(hoursInputs[bug.bugId]);
    if (isNaN(hoursWorked) || hoursWorked < 0) {
      toast.error("Please enter a valid number");
      return;
    }

    const roles = JSON.parse(localStorage.getItem("roles")) || [];
    const app = roles.length ? roles[0].application : bug.application;
    const team = bug.assignedTeam || bug.team;

    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/${bug.bugId}/update-hours`,
        {
          application: app,
          assignedTeam: team,
          hoursWorked,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Workload hours updated");

      setBugs((prev) =>
        prev.map((b) =>
          b.bugId === bug.bugId
            ? {
                ...b,
                testerValidationHours: hoursWorked,
              }
            : b
        )
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update hours"
      );
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-primary-800">Tested bugs</h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 rounded-md shadow-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Bug ID</th>
              <th className="border p-2">Title</th>
              <th className="border p-2">Status</th>
              <th className="border p-2">Priority</th>
              <th className="border p-2">Created</th>
              <th className="border p-2">Reopen Action</th>
              <th className="border p-2">Hours Worked</th>
            </tr>
          </thead>
          <tbody>
            {bugs.length > 0 ? (
              bugs.map((bug) => {
                const reason = reasonInputs[bug.bugId] || "";
                const error = reasonErrors[bug.bugId];
                const existingRequest = getPendingReopenRequest(bug);

                return (
                  <tr key={bug.bugId}>
                    <td className="border p-2">{bug.bugId}</td>
                    <td className="border p-2">{bug.title}</td>
                    <td
                      className="border p-2 font-semibold"
                      style={{
                        color: theme.palette.status?.[bug.status.toLowerCase()],
                      }}
                    >
                      {bug.status}
                    </td>
                    <td className="border p-2">{bug.priority || "NA"}</td>
                    <td className="border p-2">
                      {new Date(bug.createdAt).toLocaleDateString()}
                    </td>
                    <td className="border p-2">
                      {bug.status === "Closed" ? (
                        existingRequest ? (
                          <div className="text-sm text-gray-700 space-y-1">
                            <p>
                              <strong>Reason:</strong> {existingRequest.reason}
                            </p>
                            <p>
                              <strong>Status:</strong>{" "}
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  existingRequest.requestStatus === "Pending"
                                    ? "text-yellow-800 bg-yellow-100 "
                                    : existingRequest.requestStatus ===
                                      "Approved"
                                    ? "text-green-800 bg-green-100 "
                                    : "text-red-800 bg-red-100"
                                } px-3 py-1 rounded-lg`}
                              >
                                {existingRequest.requestStatus}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <TextField
                              fullWidth
                              label={
                                <span>
                                  Reason <span className="text-red-500">*</span>
                                </span>
                              }
                              multiline
                              rows={2}
                              value={reason}
                              onChange={(e) =>
                                handleReasonChange(bug.bugId, e.target.value)
                              }
                              inputProps={{
                                maxLength: FIELD_LIMITS.reopenReason.max,
                              }}
                              error={!!error}
                              helperText={
                                error ||
                                (reason.length < FIELD_LIMITS.reopenReason.min
                                  ? `Reason must be at least ${FIELD_LIMITS.reopenReason.min} characters.`
                                  : reason.length >=
                                    FIELD_LIMITS.reopenReason.max - 10
                                  ? `Max limit: ${
                                      FIELD_LIMITS.reopenReason.max
                                    } characters (Remaining - ${
                                      FIELD_LIMITS.reopenReason.max -
                                      reason.length
                                    })`
                                  : "")
                              }
                            />
                            <Button
                              variant="contained"
                              color="secondary"
                              onClick={() => handleReopenRequest(bug.bugId)}
                              disabled={
                                reason.length < FIELD_LIMITS.reopenReason.min
                              }
                            >
                              Request Reopen
                            </Button>
                          </div>
                        )
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="border p-2 w-64">
                      <div className="flex flex-col gap-2">
                        <TextField
                          size="small"
                          type="number"
                          label="Hours Worked"
                          value={
                            hoursInputs[bug.bugId] !== undefined
                              ? hoursInputs[bug.bugId]
                              : bug.testerValidationHours !== undefined &&
                                bug.testerValidationHours !== null
                              ? bug.testerValidationHours
                              : ""
                          }
                          onChange={(e) =>
                            handleHoursChange(bug.bugId, e.target.value)
                          }
                          error={!!hoursErrors[bug.bugId]}
                          helperText={hoursErrors[bug.bugId]}
                          fullWidth
                        />
                        <Button
                          variant="contained"
                          size="secondary"
                          onClick={() => handleUpdateHours(bug)}
                          disabled={
                            !hoursInputs[bug.bugId] || !!hoursErrors[bug.bugId]
                          }
                        >
                          Update
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="6"
                  className="border p-4 text-center text-gray-500"
                >
                  No tested bugs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ToastContainer />
    </div>
  );
};

export default TesterTestedBugs;
