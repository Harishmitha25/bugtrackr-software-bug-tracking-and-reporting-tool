import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  TextField,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { toast, ToastContainer } from "react-toastify";
import { useTheme } from "@mui/material/styles";
import "react-toastify/dist/ReactToastify.css";
import dayjs from "dayjs";
import { debounce } from "lodash";
import "react-toastify/dist/ReactToastify.css";
const DeveloperFixedBugs = () => {
  const [bugs, setBugs] = useState([]);
  const [allBugs, setAllBugs] = useState([]);
  const [reasonInputs, setReasonInputs] = useState({});
  const [reasonErrors, setReasonErrors] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("exact");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hoursInputs, setHoursInputs] = useState({});
  const [hoursErrors, setHoursErrors] = useState({});

  const [error, setError] = useState("");

  const theme = useTheme();
  const token = localStorage.getItem("token");
  const email = localStorage.getItem("loggedInUserEmail");

  const FIELD_LIMITS = {
    reopenReason: { min: 10, max: 100 },
  };

  //Get fixed bugs by the developer
  useEffect(() => {
    axios
      .get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assigned/developer/${email}/fixed-bugs`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => {
        if (res.data.bugs) {
          setAllBugs(res.data.bugs);
          setBugs(res.data.bugs);
        }
      })
      .catch(() => toast.error("Failed to fetch past bugs"));
  }, []);

  //Filter for exact search
  useEffect(() => {
    if (searchMode === "exact") {
      const filtered = allBugs.filter((bug) => {
        const query = searchQuery.toLowerCase();
        return (
          bug.title?.toLowerCase().includes(query) ||
          bug.bugId?.toLowerCase().includes(query) ||
          bug.status?.toLowerCase().includes(query) ||
          bug.priority?.toLowerCase().includes(query)
        );
      });
      setBugs(filtered);
    }
  }, [searchQuery, searchMode]);

  //Method to handle semantic search
  const handleSemanticSearch = () => {
    const app = getPrimaryRoleApp(JSON.parse(localStorage.getItem("roles")));
    debouncedSemanticSearch(searchQuery, app);
  };

  //MEthod to get response from semantic search API - Waits until the suser stop for 500ms before sending the search request
  const debouncedSemanticSearch = debounce(async (query, app) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/search/semantic`,
        { application: app, query },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const similarBugs = response.data.bugs || [];
      const filtered = allBugs.filter((bug) =>
        similarBugs.some((s) => s.bugId === bug.bugId)
      );
      setBugs(filtered);
    } catch (err) {
      console.log(err);
      toast.error("Semantic search failed. Service down.");
    }
  }, 500);

  //Get app for the primary role
  const getPrimaryRoleApp = (roles) => {
    const roleHierarchy = ["user", "developer", "tester", "teamlead", "admin"];
    if (!roles || roles.length === 0) return null;
    roles.sort(
      (a, b) => roleHierarchy.indexOf(b.role) - roleHierarchy.indexOf(a.role)
    );
    return roles[0].application || null;
  };

  //Filter bugs (Dropdown) - useMemo is used here to filter bugs only when necessary
  const filteredBugs = useMemo(() => {
    return bugs.filter((bug) => {
      const matchesPriority = priorityFilter
        ? bug.priority === priorityFilter
        : true;
      const matchesStatus = statusFilter ? bug.status === statusFilter : true;
      const bugDate = dayjs(bug.createdAt);
      const from = startDate ? dayjs(startDate) : null;
      const to = endDate ? dayjs(endDate) : null;

      //Inclusive date range
      const matchesDate =
        (!from || bugDate.isAfter(from.subtract(1, "day"))) &&
        (!to || bugDate.isBefore(to.add(1, "day")));
      return matchesPriority && matchesStatus && matchesDate;
    });
  }, [bugs, priorityFilter, statusFilter, startDate, endDate]);

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
    const reason = reasonInputs[bugId];
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
    const value = parseInt(hoursInputs[bug.bugId]);
    if (isNaN(value) || value < 0) {
      toast.error("Please enter a valid positive number");
      return;
    }

    const app = getPrimaryRoleApp(JSON.parse(localStorage.getItem("roles")));
    const team = bug.assignedTeam;

    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/${bug.bugId}/update-hours`,
        {
          application: app,
          assignedTeam: team,
          hoursWorked: value,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Workload hours updated");

      //to update local state
      setBugs((prev) =>
        prev.map((b) =>
          b.bugId === bug.bugId
            ? {
                ...b,
                developerResolutionHours: value,
              }
            : b
        )
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update workload hours"
      );
    }
  };

  //List of columns in the table
  const columns = [
    {
      field: "bugId",
      headerName: "Bug ID",
      flex: 1,
      sortComparator: (a, b) => {
        const numA = parseInt(a.split("-")[1]);
        const numB = parseInt(b.split("-")[1]);
        return numA - numB;
      },
    },
    { field: "title", headerName: "Title", flex: 2 },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <strong
          style={{
            color:
              theme.palette.status?.[params.row.status?.toLowerCase()] ||
              "#000",
          }}
        >
          {params.row.status || "—"}
        </strong>
      ),
    },
    { field: "priority", headerName: "Priority", flex: 1 },
    {
      field: "createdAt",
      headerName: "Reported Date",
      flex: 1,
      renderCell: (params) =>
        params.row.createdAt
          ? new Date(params.row.createdAt).toLocaleDateString()
          : "—",
    },
    {
      field: "actions",
      headerName: "Reopen Action",
      flex: 3,
      sortable: false,
      renderCell: (params) => {
        const bug = params.row;
        const reason = reasonInputs[bug.bugId] || "";
        const error = reasonErrors[bug.bugId];
        const existingRequest = getPendingReopenRequest(bug);

        if (bug.status !== "Closed") {
          return <span style={{ color: "#888" }}>N/A</span>;
        }

        if (existingRequest) {
          return (
            <Box sx={{ maxWidth: "100%", overflow: "hidden" }}>
              <Typography variant="body2">
                <strong>Reason:</strong> {existingRequest.reason}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      existingRequest.requestStatus === "Pending"
                        ? "#b7791f"
                        : existingRequest.requestStatus === "Approved"
                        ? "#2f855a"
                        : "#c53030",
                  }}
                >
                  {existingRequest.requestStatus}
                </span>
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              width: "100%",
              maxHeight: "150px",
              overflow: "auto",
              p: 1,
            }}
          >
            <TextField
              fullWidth
              multiline
              rows={1}
              value={reason}
              label={
                <span>
                  Reason <span style={{ color: "red" }}>*</span>
                </span>
              }
              onChange={(e) => handleReasonChange(bug.bugId, e.target.value)}
              inputProps={{ maxLength: FIELD_LIMITS.reopenReason.max }}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.stopPropagation(); //to prevent pressing space from scrolling to the bottom of the table
                }
              }}
              error={!!error}
              helperText={
                error ||
                (reason.length < FIELD_LIMITS.reopenReason.min
                  ? `Reason must be at least ${FIELD_LIMITS.reopenReason.min} characters.`
                  : reason.length >= FIELD_LIMITS.reopenReason.max - 10
                  ? `Max limit: ${FIELD_LIMITS.reopenReason.max} (Remaining: ${
                      FIELD_LIMITS.reopenReason.max - reason.length
                    })`
                  : "")
              }
            />
            <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => handleReopenRequest(bug.bugId)}
                disabled={reason.length < FIELD_LIMITS.reopenReason.min}
              >
                Request Reopen
              </Button>
            </Box>
          </Box>
        );
      },
    },
    {
      field: "hoursWorked",
      headerName: "Hours Worked",
      flex: 2,
      sortable: false,
      renderCell: (params) => {
        const bug = params.row;
        const hours =
          hoursInputs[bug.bugId] !== undefined
            ? hoursInputs[bug.bugId]
            : bug.developerResolutionHours !== undefined &&
              bug.developerResolutionHours !== null
            ? bug.developerResolutionHours
            : "";
        const error = hoursErrors[bug.bugId];

        return (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              width: "100%",
              gap: 1,
              p: 1,
              boxSizing: "border-box",
            }}
          >
            <TextField
              size="small"
              type="number"
              label="Hours Worked"
              fullWidth
              value={hours}
              onChange={(e) => handleHoursChange(bug.bugId, e.target.value)}
              error={!!error}
              helperText={error || ""}
              inputProps={{ min: 0 }}
            />
            <Button
              variant="contained"
              size="secondary"
              fullWidth
              onClick={() => handleUpdateHours(bug)}
              disabled={!hours || !!error}
            >
              Update
            </Button>
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        fontWeight="bold"
        color="primary.dark"
        gutterBottom
      >
        Fixed Bugs
      </Typography>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap={2}
        mb={3}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
          <RadioGroup
            row
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value)}
          >
            <FormControlLabel
              value="exact"
              control={<Radio />}
              label="Exact Match"
            />
            <FormControlLabel
              value="semantic"
              control={<Radio />}
              label="Semantic Search"
            />
          </RadioGroup>

          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <TextField
              label="Search by title or ID"
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: 250 }}
            />
            {searchMode === "semantic" && (
              <>
                <Button
                  variant="contained"
                  onClick={handleSemanticSearch}
                  disabled={!searchQuery.trim()}
                >
                  Search
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setBugs(allBugs);
                  }}
                >
                  Reset
                </Button>
              </>
            )}
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setSearchQuery("");
                setSearchMode("exact");
                setPriorityFilter("");
                setStatusFilter("");
                setStartDate("");
                setEndDate("");
                setBugs(allBugs);
              }}
            >
              Reset All
            </Button>
          </Box>
        </Box>

        <Box
          display="flex"
          flexWrap="wrap"
          gap={2}
          alignItems="flex-end"
          justifyContent="flex-end"
          sx={{ flexShrink: 0 }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              label="Priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Critical">Critical</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Open">Open</MenuItem>
              <MenuItem value="Assigned">Assigned</MenuItem>
              <MenuItem value="Fix In Progress">Fix In Progress</MenuItem>
              <MenuItem value="Fixed (Testing Pending)">
                Fixed (Testing Pending)
              </MenuItem>
              <MenuItem value="Tester Assigned">Tester Assigned</MenuItem>
              <MenuItem value="Testing In Progress">
                Testing In Progress
              </MenuItem>
              <MenuItem value="Tested & Verified">Tested & Verified</MenuItem>
              <MenuItem value="Ready For Closure">Ready For Closure</MenuItem>
              <MenuItem value="Closed">Closed</MenuItem>
              <MenuItem value="Duplicate">Duplicate</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            inputProps={{
              max: endDate || dayjs().format("YYYY-MM-DD"),
            }}
          />

          <TextField
            size="small"
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            inputProps={{
              min: startDate || "2025-01-01",
              max: dayjs().format("YYYY-MM-DD"),
            }}
          />
        </Box>
      </Box>

      {error ? (
        <Typography color="error" textAlign="center">
          {error}
        </Typography>
      ) : (
        <DataGrid
          style={{ height: 380 }}
          rows={filteredBugs}
          columns={columns}
          getRowId={(row) => row.bugId}
          pageSize={25}
          rowsPerPageOptions={[10, 25, 50, 100]}
          disableSelectionOnClick
          getRowHeight={(params) => {
            return params.model.status === "Closed" ? 160 : 120;
          }}
        />
      )}

      <ToastContainer />
    </Box>
  );
};

export default DeveloperFixedBugs;
