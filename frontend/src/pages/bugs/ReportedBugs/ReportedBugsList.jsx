import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  // TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { debounce } from "lodash";
import { exportToCSV, exportToPDF } from "../../../utils/exportUtils";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
//List the reported bugs
const ReportedBugsList = ({ onSelectBug }) => {
  const [allBugs, setAllBugs] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("exact");
  const [error, setError] = useState("");

  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const theme = useTheme();

  //Get the bugs reported by the logged in user
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/reported`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((response) => {
        setAllBugs(response.data.bugs);
        setBugs(response.data.bugs);
      })
      .catch((error) => setError(error.message || "Failed to fetch bugs"));
  }, []);

  //Filter for exact search
  useEffect(() => {
    if (searchMode === "exact") {
      const filtered =
        allBugs &&
        allBugs?.length > 0 &&
        allBugs.filter((bug) => {
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

  //Filter bugs (Dropdown) - useMemo is used here to filter bugs only when necessary
  const filteredBugs = useMemo(() => {
    return (
      bugs &&
      bugs?.length > 0 &&
      bugs.filter((bug) => {
        const matchesPriority = priorityFilter
          ? bug.priority === priorityFilter
          : true;
        const matchesStatus = statusFilter ? bug.status === statusFilter : true;

        const bugDate = dayjs(bug.createdAt);
        const from = startDate ? dayjs(startDate) : null;
        const to = endDate ? dayjs(endDate) : null;
        const matchesDate =
          (!from || bugDate.isAfter(from.subtract(1, "day"))) &&
          (!to || bugDate.isBefore(to.add(1, "day")));

        return matchesPriority && matchesStatus && matchesDate;
      })
    );
  }, [bugs, priorityFilter, statusFilter, startDate, endDate]);

  //Method to handle semantic search
  const handleSemanticSearch = () => {
    const app = getPrimaryRoleApp(JSON.parse(localStorage.getItem("roles")));
    debouncedSemanticSearch(searchQuery, app, setError);
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
    {
      field: "title",
      headerName: "Title",
      flex: 2,
      sortComparator: (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
      renderCell: (params) => (
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {params.row.title || "—"}
        </span>
      ),
    },
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
    {
      field: "priority",
      headerName: "Priority",
      flex: 1,
      renderCell: (params) => params.row.priority || "Not set",
    },
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
      headerName: "Actions",
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={() => onSelectBug(params.row.bugId)}
        >
          View
        </Button>
      ),
    },
  ];

  //MEthod to get response from semantic search API - Waits until the suser stop for 500ms before sending the search request
  const debouncedSemanticSearch = debounce(async (query, app, setError) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/search/semantic`,
        {
          application: app,
          query,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const similarBugs = response.data.bugs || [];

      const filteredSemantic = allBugs.filter((bug) =>
        similarBugs.some((s) => s.bugId === bug.bugId)
      );

      setBugs(filteredSemantic);
    } catch (err) {
      console.log(err);
      toast.error("Semantic search failed. Service down.");
    }
  }, 500);

  const roleHierarchy = ["user", "developer", "tester", "teamlead", "admin"];

  //Get app for the primary role
  const getPrimaryRoleApp = (roles) => {
    console.log(roles);
    if (!roles || roles?.length === 0) return null;

    roles.sort(
      (a, b) => roleHierarchy.indexOf(b.role) - roleHierarchy.indexOf(a.role)
    );

    return roles[0].application || null;
  };

  //Headers (column) for the table
  const headers = ["Bug ID", "Title", "Status", "Priority", "Reported Date"];

  //Map method to convert each bug data into an array of values to match headers
  const mapper = (bug) => [
    bug.bugId,
    bug.title,
    bug.status,
    bug.priority || "Not set",
    bug.createdAt ? new Date(bug.createdAt).toLocaleDateString() : "-",
  ];

  //Show error message
  if (error) return <p className="text-red-500 text-center">{error}</p>;
  return (
    <>
      <Box sx={{ p: 3 }}>
        <Typography
          variant="h5"
          fontWeight="bold"
          color="primary.dark"
          gutterBottom
        >
          My Bug Reports
        </Typography>

        {/* Alert when semantic search is selected */}
        {searchMode === "semantic" && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, mb: 2, ml: 1 }}
          >
            <strong>Semantic Search:</strong> Type a full sentence or key phrase
            and click <strong>Search</strong> to find semanticallysimilar bugs.
          </Typography>
        )}

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

            <Box display="flex" alignItems="center" flexWrap="wrap" gap={1}>
              <TextField
                sx={{ minWidth: 250 }}
                variant="outlined"
                placeholder="Search bugs by title or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                    setBugs(allBugs);
                  }}
                >
                  Reset
                </Button>
              )}
              {searchMode === "semantic" && (
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
              )}
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
                min: "2025-02-17",
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
                min: startDate || "2025-02-17",
                max: dayjs().format("YYYY-MM-DD"),
              }}
            />
          </Box>
          {searchMode !== "semantic" && (
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
          )}
        </Box>
        <Box display="flex" gap={2} mb={2}>
          <Button
            variant="outlined"
            onClick={() =>
              exportToCSV(filteredBugs, "bug_reports", headers, mapper)
            }
            disabled={filteredBugs && !filteredBugs?.length}
          >
            Export CSV
          </Button>

          <Button
            variant="outlined"
            onClick={() =>
              exportToPDF(filteredBugs, "bug_reports", headers, mapper)
            }
            disabled={filteredBugs && !filteredBugs?.length}
          >
            Export PDF
          </Button>
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
            disableSelectionOnClick
          />
        )}
      </Box>
      <ToastContainer />
    </>
  );
};

export default ReportedBugsList;
