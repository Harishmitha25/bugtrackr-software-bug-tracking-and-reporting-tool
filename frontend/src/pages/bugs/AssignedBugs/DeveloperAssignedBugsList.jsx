import React, { useState, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import DeveloperBugDetailsModal from "./DeveloperAssignedBugDetailsModal";
import BugColumn from "../../../components/BugColumn";

const statuses = [
  "Assigned",
  "Fix In Progress",
  "Fixed (Testing Pending)",
  "Duplicate",
];

const DeveloperAssignedBugsList = () => {
  const [bugs, setBugs] = useState([]);
  const [selectedBug, setSelectedBug] = useState(null);
  const token = localStorage.getItem("token");

  //Get list of bugs assigned to the logged developer
  useEffect(() => {
    const fetchBugs = async () => {
      try {
        const userEmail = localStorage.getItem("loggedInUserEmail");
        if (!userEmail || !token) {
          console.log("User not logged in.");
          return;
        }

        const res = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assigned/developer/${encodeURIComponent(
            userEmail
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setBugs(res.data.bugs || []);
      } catch (err) {
        toast.error("Error fetching assigned bugs.");
      }
    };

    fetchBugs();
  }, []);

  //Update status of the bug and move the card to the appropriate column only if the status update succeeds
  const moveBug = async (bugId, newStatus) => {
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/update-status`,
        { bugId, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        setBugs((prevBugs) =>
          prevBugs.map((bug) => (bug.bugId === bugId ? response.data.bug : bug))
        );
        toast.success("Bug status updated successfully.");
      } else {
        toast.error("Failed to update bug status.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to update bug status."
      );
    }
  };

  //To make sure the card is displayed inthe correct column even if the status is changed using the dropdown in the details page
  //and the bug details are updated
  const updateBugLocally = (bugId, updates) => {
    setBugs((prevBugs) =>
      prevBugs.map((bug) =>
        bug.bugId === bugId ? { ...bug, ...updates } : bug
      )
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex space-x-4 p-4">
        {statuses.map((status) => (
          <BugColumn
            key={status}
            status={status}
            bugs={bugs.filter((bug) => bug.status === status)}
            moveBug={moveBug}
            setSelectedBug={setSelectedBug}
          />
        ))}
      </div>

      {selectedBug && (
        <DeveloperBugDetailsModal
          bug={selectedBug}
          onClose={() => setSelectedBug(null)}
          updateBugLocally={updateBugLocally}
        />
      )}
      <ToastContainer />
    </DndProvider>
  );
};

export default DeveloperAssignedBugsList;
