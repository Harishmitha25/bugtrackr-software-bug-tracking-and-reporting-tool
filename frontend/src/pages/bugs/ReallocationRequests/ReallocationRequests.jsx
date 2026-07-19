import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { debounce } from "lodash";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
const ReallocationRequests = () => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [searchMode, setSearchMode] = useState("exact");

  //Get the reallocation requests by the logged in user
  useEffect(() => {
    const token = localStorage.getItem("token");
    axios
      .get(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reallocation-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setRequests(res.data.reallocationRequests || []);
        setFilteredRequests(res.data.reallocationRequests || []);
      })
      .catch(() => setError("Failed to fetch bugs"));
  }, []);

  //Filter bugs (Dropdown)
  const filteredData = useMemo(() => {
    const base =
      searchMode === "exact"
        ? requests.filter((bug) => {
            const query = searchQuery.toLowerCase();
            return (
              bug.title?.toLowerCase().includes(query) ||
              bug.bugId?.toLowerCase().includes(query) ||
              bug.status?.toLowerCase().includes(query) ||
              bug.priority?.toLowerCase().includes(query)
            );
          })
        : filteredRequests;

    return base.filter((bug) => {
      const matchesPriority = priorityFilter
        ? bug.priority === priorityFilter
        : true;
      const matchesStatus = statusFilter ? bug.status === statusFilter : true;
      const matchesRequestStatus = requestStatusFilter
        ? bug.requestStatus === requestStatusFilter
        : true;

      const bugDate = dayjs(bug.createdAt);
      const from = startDate ? dayjs(startDate) : null;
      const to = endDate ? dayjs(endDate) : null;

      const matchesDate =
        (!from || bugDate.isAfter(from.subtract(1, "day"))) &&
        (!to || bugDate.isBefore(to.add(1, "day")));

      return (
        matchesPriority && matchesStatus && matchesRequestStatus && matchesDate
      );
    });
  }, [
    requests,
    filteredRequests,
    searchQuery,
    searchMode,
    priorityFilter,
    statusFilter,
    requestStatusFilter,
    startDate,
    endDate,
  ]);

  //Method to handle semantic search
  const handleSemanticSearch = () => {
    if (searchQuery.trim()) {
      const app = getPrimaryRoleApp(JSON.parse(localStorage.getItem("roles")));
      debouncedSemanticSearch(searchQuery, app);
    }
  };

  const roleHierarchy = ["user", "developer", "tester", "teamlead", "admin"];

  //Get app for the primary role
  const getPrimaryRoleApp = (roles) => {
    if (!roles || roles.length === 0) return null;

    roles.sort(
      (a, b) => roleHierarchy.indexOf(b.role) - roleHierarchy.indexOf(a.role)
    );

    return roles[0].application || null;
  };

  //MEthod to get response from semantic search API - Waits until the suser stop for 500ms before sending the search request
  const debouncedSemanticSearch = debounce(async (query, app) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/search/semantic`,
        { application: app, query },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const similarBugs = response.data.bugs || [];
      const matching = requests.filter((bug) =>
        similarBugs.some((s) => s.bugId === bug.bugId)
      );

      setFilteredRequests(matching);
    } catch (err) {
      console.log(err);
      toast.error("Semantic search failed. Service down.");
    }
  }, 500);

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
    {
      field: "title",
      headerName: "Title",
      flex: 2,
      renderCell: (params) => (
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={params.row.title}
        >
          {params.row.title}
        </span>
      ),
    },
    { field: "priority", headerName: "Priority", flex: 1 },
    { field: "status", headerName: "Status", flex: 1 },
    {
      field: "requestStatus",
      headerName: "Request Status",
      flex: 1,
      renderCell: (params) => {
        const colorMap = {
          Pending: "#b7791f",
          Approved: "#2f855a",
          Rejected: "#c53030",
        };
        const bgColorMap = {
          Pending: "#fefcbf",
          Approved: "#c6f6d5",
          Rejected: "#fed7d7",
        };
        return (
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.85rem",
              color: colorMap[params.value] || "#000",
              backgroundColor: bgColorMap[params.value] || "#f0f0f0",
            }}
          >
            {params.value}
          </span>
        );
      },
    },
    {
      field: "reason",
      headerName: "Reason",
      flex: 2,
      renderCell: (params) => (
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={params.row.reason}
        >
          {params.row.reason}
        </span>
      ),
    },
  ];

  return (
    <>
      <Box sx={{ p: 3 }}>
        <Typography
          variant="h5"
          fontWeight="bold"
          color="primary.dark"
          gutterBottom
        >
          My Reallocation Requests
        </Typography>

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          flexWrap="wrap"
          gap={2}
          mb={3}
        >
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}
          >
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
                <Button
                  variant="contained"
                  onClick={handleSemanticSearch}
                  disabled={!searchQuery.trim()}
                >
                  Search
                </Button>
              )}

              {searchMode === "semantic" && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setFilteredRequests(requests);
                  }}
                >
                  Reset
                </Button>
              )}
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  setSearchQuery("");
                  setPriorityFilter("");
                  setStatusFilter("");
                  setRequestStatusFilter("");
                  setStartDate("");
                  setEndDate("");
                  setFilteredRequests(requests);
                }}
              >
                Reset All
              </Button>
            </Box>
          </Box>

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
              <MenuItem value="Closed">Closed</MenuItem>
              <MenuItem value="Duplicate">Duplicate</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Request Status</InputLabel>
            <Select
              label="Request Status"
              value={requestStatusFilter}
              onChange={(e) => setRequestStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
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

        {error ? (
          <Typography color="error" textAlign="center">
            {error}
          </Typography>
        ) : (
          <DataGrid
            style={{ height: 380 }}
            rows={filteredData}
            columns={columns}
            getRowId={(row) => `${row.bugId}-${row.requestStatus}`}
            pageSize={25}
            rowsPerPageOptions={[10, 25, 50, 100]}
            disableSelectionOnClick
          />
        )}
      </Box>
      <ToastContainer />
    </>
  );
};

export default ReallocationRequests;
