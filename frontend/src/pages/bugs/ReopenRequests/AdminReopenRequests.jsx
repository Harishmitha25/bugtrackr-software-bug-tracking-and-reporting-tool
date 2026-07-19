import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Button,
} from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AdminReopenRequests = () => {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [allRequests, setAllRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);

  const token = localStorage.getItem("token");
  //Get applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/applications`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setApplications(response.data);
      } catch (err) {
        toast.error("Failed to fetch applications.");
      }
    };
    fetchApplications();
  }, []);

  //Get all reopen reqeusts
  useEffect(() => {
    const fetchReopenRequests = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reopen-requests`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { bugsBasedOnAppAndTeam } = response.data;
        const allRequests = [];

        Object.values(bugsBasedOnAppAndTeam).forEach((app) => {
          Object.values(app).forEach((team) => {
            team.forEach((bug) => {
              bug.reopenRequests.forEach((request) => {
                allRequests.push({
                  ...request,
                  bugId: bug.bugId,
                  title: bug.title,
                  application: bug.application,
                  assignedTeam: bug.assignedTeam,
                });
              });
            });
          });
        });

        setAllRequests(allRequests);
      } catch (err) {
        toast.error("Failed to fetch reopen requests.");
      }
    };

    fetchReopenRequests();
  }, []);

  //Get the reopen requests from teh app and the team
  const fetchFilteredRequests = () => {
    if (!selectedApp || !selectedTeam) {
      toast.error("Please select both application and team.");
      return;
    }

    const filtered = allRequests.filter(
      (r) => r.application === selectedApp && r.assignedTeam === selectedTeam
    );
    setFilteredRequests(filtered);
  };

  //Confirmation to Approve/Reject reopen request
  const handleDescision = (bugId, requestId, action) => {
    const toastId = toast.info(
      <div>
        <p>
          Are you sure you want to <strong>{action}</strong> this reopen
          request?
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px",
            marginTop: "10px",
          }}
        >
          <button
            className="bg-green-600 text-white py-1 px-3 rounded hover:bg-green-700"
            onClick={() => confirmDecision(bugId, requestId, action, toastId)}
          >
            Yes
          </button>
          <button
            className="bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600"
            onClick={() => toast.dismiss(toastId)}
          >
            No
          </button>
        </div>
      </div>,
      { autoClose: false }
    );
  };

  //Approve/Reject reopen request
  const confirmDecision = async (bugId, requestId, action, toastId) => {
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/approve-reject-reopen`,
        { bugId, requestId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.dismiss(toastId);
      toast.success(`Reopen request ${action} successfully.`);

      setFilteredRequests((prev) =>
        prev.map((req) =>
          req._id === requestId ? { ...req, requestStatus: action } : req
        )
      );
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to update the decision.");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Reopen Requests</h2>

      <div className="flex gap-4 mb-6">
        <FormControl fullWidth>
          <InputLabel>Select Application</InputLabel>
          <Select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
          >
            {applications.map((app) => (
              <MenuItem key={app.name} value={app.name}>
                {app.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Select Team</InputLabel>
          <Select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {["frontend", "backend", "devops"].map((team) => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="primary"
          onClick={fetchFilteredRequests}
        >
          Search
        </Button>
      </div>

      {filteredRequests.length === 0 ? (
        <p className="text-gray-600">
          No reopen requests found or application and team are not applied.
        </p>
      ) : (
        filteredRequests.map((req, index) => (
          <div
            key={index}
            className="bg-white p-4 shadow rounded mb-4 border border-gray-200"
          >
            <p>
              <strong>Bug ID:</strong> {req.bugId}
            </p>
            <p>
              <strong>Title:</strong> {req.title}
            </p>
            <p>
              <strong>Application:</strong> {req.application}
            </p>
            <p>
              <strong>Assigned Team:</strong> {req.assignedTeam}
            </p>
            <p>
              <strong>Requested By:</strong> {req.requestedBy} ({req.role})
            </p>
            <p>
              <strong>Reason:</strong> {req.reason}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <span
                className={`${
                  req.requestStatus === "Pending"
                    ? "text-yellow-800 bg-yellow-100"
                    : req.requestStatus === "Approved"
                    ? "text-green-800 bg-green-100"
                    : "text-red-800 bg-red-100"
                } px-3 py-1 rounded-lg`}
              >
                {req.requestStatus}
              </span>
            </p>

            {req.requestStatus === "Pending" && (
              <div className="mt-3 flex gap-3">
                <Button
                  variant="contained"
                  color="success"
                  onClick={() =>
                    handleDescision(req.bugId, req._id, "Approved")
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() =>
                    handleDescision(req.bugId, req._id, "Rejected")
                  }
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      <ToastContainer />
    </div>
  );
};

export default AdminReopenRequests;
