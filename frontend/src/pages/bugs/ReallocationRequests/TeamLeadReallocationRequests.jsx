import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Tabs,
  Tab,
  Box,
  Typography,
  Button,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from "@mui/material";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
const TeamLeadReallocationRequests = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [developerRequests, setDeveloperRequests] = useState([]);
  const [testerRequests, setTesterRequests] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [testers, setTesters] = useState([]);
  const [selectedDeveloper, setSelectedDeveloper] = useState(null);
  const [selectedTester, setSelectedTester] = useState(null);
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState({});
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  //Get all reallocation reqeusts
  useEffect(() => {
    const fetchReallocationRequests = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reallocation-requests`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { bugsBasedOnAppAndTeam } = response.data;
        const devRequests = [];
        const testRequests = [];

        Object.values(bugsBasedOnAppAndTeam).forEach((app) => {
          Object.values(app).forEach((team) => {
            team.forEach((bug) => {
              if (bug.reallocationRequests?.developer.length > 0) {
                devRequests.push(bug);
              }
              if (bug.reallocationRequests?.tester.length > 0) {
                testRequests.push(bug);
              }
            });
          });
        });

        setDeveloperRequests(devRequests);
        setTesterRequests(testRequests);
      } catch (error) {
        toast.error(
          error.response?.data?.error ||
            error.response?.data?.message ||
            "Failed to fetch reallocation requests."
        );
      }
    };

    fetchReallocationRequests();
  }, []);

  //Developers or Testers requests tabs
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  //Approve/Reject reallocation reuqest and re assign develoepr or tester accordingly
  const handleApiCalls = async (bugId, role, requestId) => {
    try {
      const status = selectedApprovalStatus[bugId];
      if (!status) return;

      const requestPayload = {
        bugId,
        requestId,
        action: status,
      };

      if (role === "developer" && status === "Approved") {
        requestPayload.developerEmail = selectedDeveloper;
      }

      if (role === "tester" && status === "Approved") {
        requestPayload.testerEmail = selectedTester;
      }

      const response = await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/approve-reject-reallocation`,
        requestPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message || "Request processed");

      if (role === "developer") {
        setDeveloperRequests((prevBugs) =>
          prevBugs.map((bug) => {
            if (bug.bugId === bugId) {
              const updatedRequests = bug.reallocationRequests.developer.map(
                (request) => {
                  if (request._id === requestId) {
                    return { ...request, requestStatus: status };
                  }
                  return request;
                }
              );
              return {
                ...bug,
                reallocationRequests: {
                  ...bug.reallocationRequests,
                  developer: updatedRequests,
                },
              };
            }
            return bug;
          })
        );
      }

      if (role === "tester") {
        setTesterRequests((prevBugs) =>
          prevBugs.map((bug) => {
            if (bug.bugId === bugId) {
              const updatedRequests = bug.reallocationRequests.tester.map(
                (request) => {
                  if (request._id === requestId) {
                    return { ...request, requestStatus: status };
                  }
                  return request;
                }
              );
              return {
                ...bug,
                reallocationRequests: {
                  ...bug.reallocationRequests,
                  tester: updatedRequests,
                },
              };
            }
            return bug;
          })
        );
      }

      setSelectedDeveloper(null);
      setSelectedTester(null);
      setSelectedApprovalStatus({});
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to process the request."
      );
    }
  };

  //Used to display content for each tab. Eg: if 'value' is 0 then only the TabPanel with 'index' 0 will be visible
  const TabPanel = ({ children, value, index }) => {
    return (
      <div role="tabpanel" hidden={value !== index}>
        {value === index && (
          <Box p={3}>
            <Typography>{children}</Typography>
          </Box>
        )}
      </div>
    );
  };

  return (
    <div>
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tab label="Developer Requests" />
        <Tab label="Tester Requests" />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        {developerRequests.map((bug, index) => (
          <div key={bug.bugId} className="p-4 mb-4 bg-white shadow rounded">
            <p>
              <strong>Bug ID:</strong> {bug.bugId}
            </p>
            <p>
              <strong>Title:</strong> {bug.title}
            </p>
            <p>
              <strong>Description:</strong> {bug.description}
            </p>
            <p>
              <strong>Priority:</strong> {bug.priority}
            </p>

            {bug.reallocationRequests.developer.map((request, i) => (
              <div key={i}>
                <p>
                  <strong>Reason:</strong> {request.reason}
                </p>
                <p>
                  <strong>Requested By:</strong> {request.requestedBy}
                </p>
                <p>
                  <strong>Request Status:</strong>{" "}
                  <span
                    className={`${
                      request.requestStatus === "Pending"
                        ? "text-yellow-800 bg-yellow-100"
                        : request.requestStatus === "Approved"
                        ? "text-green-800 bg-green-100"
                        : "text-red-800 bg-red-100"
                    } px-3 py-1 rounded-lg`}
                  >
                    {request.requestStatus}
                  </span>
                </p>
                {request.requestStatus !== "Approved" &&
                  request.requestStatus !== "Rejected" && (
                    <>
                      <FormControl
                        fullWidth
                        style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}
                      >
                        <InputLabel>
                          Approve/Reject <span className="text-red-500">*</span>
                        </InputLabel>
                        <Select
                          value={selectedApprovalStatus[bug.bugId] || ""}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            setSelectedApprovalStatus((prev) => ({
                              ...prev,
                              [bug.bugId]: newStatus,
                            }));

                            if (newStatus === "Approved") {
                              try {
                                const response = await axios.get(
                                  `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/developers/${bug.application}/${bug.assignedTeam}`,
                                  {
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                  }
                                );
                                //Filter out the reallocation requested person from the response data
                                const filteredDevelopers =
                                  response?.data.filter(
                                    (dev) => dev.email !== request.requestedBy
                                  );
                                setDevelopers(filteredDevelopers);
                              } catch (err) {
                                setError(
                                  err.response?.data?.message ||
                                    err.message ||
                                    "Failed to fetch developers to assign bug"
                                );
                              }
                            }
                          }}
                        >
                          <MenuItem value="">Select Approval Status</MenuItem>
                          <MenuItem value="Approved">Approve</MenuItem>
                          <MenuItem value="Rejected">Reject</MenuItem>
                        </Select>
                      </FormControl>

                      {selectedApprovalStatus[bug.bugId] === "Approved" && (
                        <FormControl
                          fullWidth
                          style={{
                            marginTop: "0.5rem",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <InputLabel>
                            Select Developer{" "}
                            <span className="text-red-500">*</span>
                          </InputLabel>
                          <Select
                            value={selectedDeveloper || ""}
                            onChange={(e) =>
                              setSelectedDeveloper(e.target.value)
                            }
                          >
                            {developers.map((dev) => (
                              <MenuItem key={dev.email} value={dev.email}>
                                {dev.fullName} ({dev.email})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={
                          !(
                            selectedApprovalStatus[bug.bugId] === "Rejected" ||
                            (selectedApprovalStatus[bug.bugId] === "Approved" &&
                              selectedDeveloper)
                          )
                        }
                        onClick={() =>
                          handleApiCalls(bug.bugId, "developer", request._id)
                        }
                      >
                        Process Request
                      </Button>
                    </>
                  )}
              </div>
            ))}
          </div>
        ))}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {testerRequests.map((bug, index) => (
          <div key={bug.bugId} className="p-4 mb-4 bg-white shadow rounded">
            <p>
              <strong>Bug ID:</strong> {bug.bugId}
            </p>
            <p>
              <strong>Title:</strong> {bug.title}
            </p>
            <p>
              <strong>Description:</strong> {bug.description}
            </p>
            <p>
              <strong>Priority:</strong> {bug.priority}
            </p>

            {bug.reallocationRequests.tester.map((request, i) => (
              <div key={i}>
                <p>
                  <strong>Reason:</strong> {request.reason}
                </p>
                <p>
                  <strong>Requested By:</strong> {request.requestedBy}
                </p>
                <p>
                  <span
                    className={`${
                      request.requestStatus === "Pending"
                        ? "text-yellow-800 bg-yellow-100"
                        : request.requestStatus === "Approved"
                        ? "text-green-800 bg-green-100"
                        : "text-red-800 bg-red-100"
                    } px-3 py-1 rounded-lg`}
                  >
                    {request.requestStatus}
                  </span>
                </p>
                {request.requestStatus !== "Approved" &&
                  request.requestStatus !== "Rejected" && (
                    <>
                      <FormControl
                        fullWidth
                        style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}
                      >
                        <InputLabel>
                          Approve/Reject <span className="text-red-500">*</span>
                        </InputLabel>
                        <Select
                          value={selectedApprovalStatus[bug.bugId] || ""}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            setSelectedApprovalStatus((prev) => ({
                              ...prev,
                              [bug.bugId]: newStatus,
                            }));

                            if (newStatus === "Approved") {
                              try {
                                const response = await axios.get(
                                  `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/testers/${bug.application}/${bug.assignedTeam}`,
                                  {
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                  }
                                );
                                //Filter out the reallocation requested person from the response data
                                const filteredTesters = response?.data.filter(
                                  (tester) =>
                                    tester.email !== request.requestedBy
                                );
                                setTesters(filteredTesters);
                              } catch (err) {
                                setError(
                                  err.response?.data?.message ||
                                    err.message ||
                                    "Failed to fetch testers to assign bug"
                                );
                              }
                            }
                          }}
                        >
                          <MenuItem value="">Select Approval Status</MenuItem>
                          <MenuItem value="Approved">Approve</MenuItem>
                          <MenuItem value="Rejected">Reject</MenuItem>
                        </Select>
                      </FormControl>
                      {selectedApprovalStatus[bug.bugId] === "Approved" && (
                        <FormControl
                          fullWidth
                          style={{
                            marginTop: "0.5rem",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <InputLabel>
                            Select Tester{" "}
                            <span className="text-red-500">*</span>
                          </InputLabel>
                          <Select
                            value={selectedTester || ""}
                            onChange={(e) => setSelectedTester(e.target.value)}
                          >
                            {testers.map((tester) => (
                              <MenuItem key={tester.email} value={tester.email}>
                                {tester.fullName} ({tester.email})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={
                          !(
                            selectedApprovalStatus[bug.bugId] === "Rejected" ||
                            (selectedApprovalStatus[bug.bugId] === "Approved" &&
                              selectedTester)
                          )
                        }
                        onClick={() =>
                          handleApiCalls(bug.bugId, "tester", request._id)
                        }
                      >
                        Process Request
                      </Button>
                    </>
                  )}
              </div>
            ))}
          </div>
        ))}
      </TabPanel>
      <ToastContainer></ToastContainer>
    </div>
  );
};

export default TeamLeadReallocationRequests;
