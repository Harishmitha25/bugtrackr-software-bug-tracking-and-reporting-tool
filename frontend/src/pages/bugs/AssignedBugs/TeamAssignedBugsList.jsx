import React, { useEffect, useState, useMemo } from "react";
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
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import Tooltip from "@mui/material/Tooltip";
import { exportToCSV, exportToPDF } from "../../../utils/exportUtils";
import { faStar as solidStar } from "@fortawesome/free-solid-svg-icons";
import { faStar as regularStar } from "@fortawesome/free-regular-svg-icons";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
const STATUS_UPDATE_THRESHOLD = {
  HIGH: 24,
  MEDIUM: 12,
  LOW: 6,
};

const TeamAssignedBugsList = ({ onSelectBug }) => {
  const [allBugs, setAllBugs] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("exact");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("");
  const [developerMap, setDeveloperMap] = useState({});
  const [testerMap, setTesterMap] = useState({});
  const [developerFilter, setDeveloperFilter] = useState("");
  const [testerFilter, setTesterFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applyFilters, setApplyFilters] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [semanticResults, setSemanticResults] = useState([]);

  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [favouriteBugIds, setFavouriteBugIds] = useState([]);

  const limit = 25;
  const theme = useTheme();
  const token = localStorage.getItem("token");
  const loggedInUserRoles = JSON.parse(localStorage.getItem("roles"));
  const teamLeadRole = loggedInUserRoles.find((r) => r.role === "teamlead");
  const { application, team } = teamLeadRole;

  //Get bugs (without fitlers on initial load) and with filters (indexing and batch loading applied)
  const fetchFilteredBugs = async () => {
    try {
      const params = {
        searchQuery,
        searchMode,
        priority: priorityFilter,
        status: statusFilter,
        issueType: issueTypeFilter,
        developer: developerFilter,
        tester: testerFilter,
        startDate,
        endDate,
        page,
        limit,
      };

      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/assigned/team/${application}/${team}`,
        { headers: { Authorization: `Bearer ${token}` }, params }
      );
      setAllBugs(res.data.bugs || []);

      setBugs(res.data.bugs);
      setTotal(res.data.total);
    } catch (err) {
      setError("Failed to fetch bugs");
    }
  };

  //Call fetchFilteredBugsmethod for initial load and with filters when applied
  useEffect(() => {
    if (initialLoad || applyFilters) {
      fetchFilteredBugs();
      setApplyFilters(false);
      setInitialLoad(false);
    }
  }, [applyFilters, initialLoad]);

  //Get developers and testers
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const [devRes, testerRes] = await Promise.all([
          axios.get(
            `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/developers/${application}/${team}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ),
          axios.get(
            `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/testers/${application}/${team}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ),
        ]);

        const devMap = {};
        devRes.data.forEach((d) => {
          devMap[d.email] = d.fullName || d.email;
        });

        const testerMapTemp = {};
        testerRes.data.forEach((t) => {
          testerMapTemp[t.email] = t.fullName || t.email;
        });

        setDeveloperMap(devMap);
        setTesterMap(testerMapTemp);
      } catch (err) {
        setError("Failed to fetch developers or testers");
      }
    };

    fetchTeamMembers();
  }, [application, team, token]);

  //Method to handle semantic search
  const handleSemanticSearch = async (query) => {
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/search/semantic`,
        { application, query },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const bugIds = res.data.bugs.map((b) => b.bugId);
      const matched = allBugs.filter((b) => bugIds.includes(b.bugId));
      setBugs(matched);
      setSemanticResults(matched);
    } catch (err) {
      console.log(err);
      toast.error("Semantic search failed. Service down.");
    }
  };

  const filteredBugs = useMemo(() => {
    if (searchMode !== "semantic") return [];

    return semanticResults.filter((bug) => {
      const priorityMatch = priorityFilter
        ? bug.priority === priorityFilter
        : true;
      const statusMatch = statusFilter ? bug.status === statusFilter : true;
      const issueTypeMatch = issueTypeFilter
        ? bug.issueType === issueTypeFilter
        : true;

      const developerMatch = developerFilter
        ? developerFilter === "Unassigned"
          ? !bug.assignedTo?.developer
          : bug.assignedTo?.developer === developerFilter
        : true;
      const testerMatch = testerFilter
        ? testerFilter === "Unassigned"
          ? !bug.assignedTo?.tester
          : bug.assignedTo?.tester === testerFilter
        : true;

      const bugDate = dayjs(bug.createdAt);
      const from = startDate ? dayjs(startDate) : null;
      const to = endDate ? dayjs(endDate) : null;
      const matchesDate =
        (!from || bugDate.isAfter(from.subtract(1, "day"))) &&
        (!to || bugDate.isBefore(to.add(1, "day")));

      return (
        priorityMatch &&
        statusMatch &&
        issueTypeMatch &&
        developerMatch &&
        testerMatch &&
        matchesDate
      );
    });
  }, [
    semanticResults,
    searchMode,
    priorityFilter,
    statusFilter,
    issueTypeFilter,
    developerFilter,
    testerFilter,
    startDate,
    endDate,
  ]);

  //Get all favourite bugs
  const fetchFavourites = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/favourites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const favIds = res.data.bugs.map((b) => b.bugId);
      setFavouriteBugIds(favIds);
    } catch (err) {
      console.error("Failed to fetch favourites", err);
    }
  };

  useEffect(() => {
    fetchFavourites();
  }, []);

  //Method to mark bug as favourite or remove favourite
  const toggleFavourite = async (bugId) => {
    const isFavd = favouriteBugIds.includes(bugId);
    const url = isFavd
      ? `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/favourites/remove`
      : `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/favourites/add`;

    try {
      await axios.post(
        url,
        { bugId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (isFavd) {
        //Remove the bug from favourites
        setFavouriteBugIds((prevFavourites) => {
          return prevFavourites.filter((id) => id !== bugId);
        });
      } else {
        //Add the bug to favourites
        setFavouriteBugIds((prevFavourites) => {
          return [...prevFavourites, bugId];
        });
      }
    } catch (err) {
      console.error("Failed to toggle favourite", err);
    }
  };

  const headers = [
    "Bug ID",
    "Title",
    "Status",
    "Issue Type",
    "Priority",
    "Assigned Developer",
    "Assigned Tester",
    "Reported Date",
  ];

  const mapper = (bug) => [
    bug.bugId,
    bug.title,
    bug.status,
    bug.issueType,
    bug.priority || "Not set",
    bug.assignedTo?.developer || "Unassigned",
    bug.assignedTo?.tester || "Unassigned",
    bug.createdAt ? new Date(bug.createdAt).toLocaleDateString() : "—",
  ];

  const columns = [
    {
      field: "bugId",
      headerName: "Bug ID",
      flex: 1,
      sortComparator: (a, b) => {
        const aNum = parseInt(a?.split("-")[1]);
        const bNum = parseInt(b?.split("-")[1]);
        return aNum - bNum;
      },
    },
    {
      field: "title",
      headerName: "Title",
      flex: 2,
      renderCell: (params) => (
        <span
          title={params.row.title}
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {params.row.title}
        </span>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <strong
          title={params.row.status}
          style={{
            color:
              theme.palette.status?.[params.row.status?.toLowerCase()] ||
              "#000",
          }}
        >
          {params.row.status}
        </strong>
      ),
    },
    {
      field: "issueType",
      headerName: "Issue Type",
      flex: 1.5,
      renderCell: (params) => {
        const bug = params.row;
        const desc = bug.otherIssueTypeDescription?.trim();
        const issueTypeToShow =
          desc && bug.issueType === "Other" ? desc : bug.issueType;

        return (
          <span title={issueTypeToShow || "Others"}>
            {issueTypeToShow || "Others"}
          </span>
        );
      },
    },
    {
      field: "priority",
      headerName: "Priority",
      flex: 1,
      renderCell: (params) => (
        <span
          style={{
            fontWeight: 600,
            color:
              theme.palette.priority?.[params.row.priority?.toLowerCase()] ||
              "#000",
          }}
        >
          {params.row.priority || "Not set yet"}
        </span>
      ),
    },
    {
      field: "developer",
      headerName: "Assigned Developer",
      flex: 1.5,
      renderCell: (params) => {
        const email = params.row.assignedTo?.developer;
        return (
          <span title={email ? developerMap[email] || email : "Unassigned"}>
            {email ? developerMap[email] || email : "Unassigned"}
          </span>
        );
      },
    },
    {
      field: "tester",
      headerName: "Assigned Tester",
      flex: 1.5,
      renderCell: (params) => {
        const email = params.row.assignedTo?.tester;
        return (
          <span title={email ? testerMap[email] || email : "Unassigned"}>
            {email ? testerMap[email] || email : "Unassigned"}
          </span>
        );
      },
    },
    {
      field: "statusAlert",
      headerName: "Status Alert",
      flex: 1,
      renderCell: (params) => {
        const bug = params.row;
        if (bug.statusLastUpdated) {
          const hours = getHoursSinceStatusUpdate(bug.statusLastUpdated);

          if (
            bug.status !== "Closed" &&
            bug.status !== "Duplicate" &&
            bug.statusLastUpdated
          ) {
            if (hours > STATUS_UPDATE_THRESHOLD.HIGH) {
              return (
                <Tooltip title="No status update in over 24 hours" arrow>
                  <span className="flex items-center gap-1 text-red-600 font-semibold">
                    <FontAwesomeIcon icon={faClock} />
                    <span className="text-xs">24h+</span>
                  </span>
                </Tooltip>
              );
            } else if (hours > STATUS_UPDATE_THRESHOLD.MEDIUM) {
              return (
                <Tooltip title="No status update in 12+ hours" arrow>
                  <span className="flex items-center gap-1 text-orange-500 font-medium">
                    <FontAwesomeIcon icon={faClock} />
                    <span className="text-xs">12h+</span>
                  </span>
                </Tooltip>
              );
            } else if (hours > STATUS_UPDATE_THRESHOLD.LOW) {
              return (
                <Tooltip title="No status update in 6+ hours" arrow>
                  <span className="flex items-center gap-1 text-yellow-600 font-normal">
                    <FontAwesomeIcon icon={faClock} />
                    <span className="text-xs">6h+</span>
                  </span>
                </Tooltip>
              );
            }
          }
        }

        return <span className="text-xs text-gray-500">-</span>;
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Button
          variant="contained"
          onClick={() => onSelectBug(params.row.bugId)}
        >
          View
        </Button>
      ),
    },
    {
      field: "favourite",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const bugId = params.row.bugId;
        const isFavd = favouriteBugIds.includes(bugId);

        return (
          <button
            onClick={() => toggleFavourite(bugId)}
            style={{
              cursor: "pointer",
              color: isFavd ? "#f1c40f" : "#999",
            }}
            title={isFavd ? "Unfavourite" : "Mark as Favourite"}
          >
            <FontAwesomeIcon icon={isFavd ? solidStar : regularStar} />
          </button>
        );
      },
    },
  ];

  //Get hours since last status update
  const getHoursSinceStatusUpdate = (lastUpdated) => {
    const now = new Date();
    const updated = new Date(lastUpdated);
    const diffInMs = now - updated;
    return diffInMs / (1000 * 60 * 60); //convert ms to hours
  };
  const bugsToExport = searchMode === "semantic" ? filteredBugs : bugs;

  const bugList = searchMode === "semantic" ? filteredBugs : bugs;
  const sortedRows = bugList.slice().sort((bug1, bug2) => {
    const bug1IsFav = favouriteBugIds.includes(bug1.bugId);
    const bug2IsFav = favouriteBugIds.includes(bug2.bugId);

    if (bug1IsFav && !bug2IsFav) {
      return -1;
    }

    if (!bug1IsFav && bug2IsFav) {
      return 1;
    }

    return 0;
  });

  return (
    <>
      <Box sx={{ p: 3 }}>
        <Typography
          variant="h5"
          fontWeight="bold"
          color="primary.dark"
          gutterBottom
        >
          Bugs Assigned to your Team
        </Typography>

        {searchMode === "semantic" && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Semantic Search:</strong> Type a full sentence and click{" "}
            <strong>Search</strong> to find similar bugs.
          </Typography>
        )}

        <Box display="flex" flexWrap="wrap" alignItems="center" gap={2} mb={2}>
          <RadioGroup
            row
            value={searchMode}
            onChange={(e) => {
              const mode = e.target.value;
              setSearchMode(mode);
              setError("");

              if (mode === "semantic") {
                setPriorityFilter("");
                setStatusFilter("");
                setIssueTypeFilter("");
                setDeveloperFilter("");
                setTesterFilter("");
                setStartDate("");
                setEndDate("");
                setPage(1);

                setSemanticResults(allBugs);
              }
            }}
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
          {searchMode === "exact" && (
            <>
              <TextField
                label="Search bugs by title or ID"
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={() => {
                  setPage(1);
                  setApplyFilters(true);
                }}
                disabled={
                  !searchQuery &&
                  !priorityFilter &&
                  !statusFilter &&
                  !issueTypeFilter &&
                  !developerFilter &&
                  !testerFilter &&
                  !startDate &&
                  !endDate
                }
              >
                Search
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  setSearchQuery("");
                  setApplyFilters(true);
                }}
              >
                Reset
              </Button>
            </>
          )}
          {searchMode === "semantic" && (
            <>
              <TextField
                label="Enter full sentence to search"
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={() => handleSemanticSearch(searchQuery)}
                disabled={!searchQuery}
              >
                Search
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  setSearchQuery("");
                  setSemanticResults(allBugs);
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
              setIssueTypeFilter("");
              setDeveloperFilter("");
              setTesterFilter("");
              setStartDate("");
              setEndDate("");
              setPage(1);
              setApplyFilters(true);
            }}
          >
            Reset All
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() =>
              exportToCSV(bugsToExport, "team_assigned_bugs", headers, mapper)
            }
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() =>
              exportToPDF(bugsToExport, "team_assigned_bugs", headers, mapper)
            }
          >
            Export PDF
          </Button>
        </Box>

        <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              label="Priority"
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
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

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Issue Type</InputLabel>
            <Select
              value={issueTypeFilter}
              onChange={(e) => setIssueTypeFilter(e.target.value)}
              label="Issue Type"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="UI Issue">UI Issue</MenuItem>
              <MenuItem value="Backend Issue">Backend Issue</MenuItem>
              <MenuItem value="Infrastructure Issue">
                Infrastructure Issue
              </MenuItem>
              <MenuItem value="Others">Others</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Developer</InputLabel>
            <Select
              value={developerFilter}
              onChange={(e) => setDeveloperFilter(e.target.value)}
              label="Developer"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Unassigned">Unassigned</MenuItem>
              {Object.entries(developerMap).map(([email, name]) => (
                <MenuItem key={email} value={email}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Tester</InputLabel>
            <Select
              value={testerFilter}
              onChange={(e) => setTesterFilter(e.target.value)}
              label="Tester"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Unassigned">Unassigned</MenuItem>
              {Object.entries(testerMap).map(([email, name]) => (
                <MenuItem key={email} value={email}>
                  {name}
                </MenuItem>
              ))}
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

        {error ? (
          <Typography color="error" textAlign="center">
            {error}
          </Typography>
        ) : (
          <DataGrid
            style={{ height: 380 }}
            rows={sortedRows}
            columns={columns}
            getRowId={(row) => row.bugId}
            paginationMode="server"
            paginationModel={{ page: page - 1, pageSize: limit }}
            onPaginationModelChange={({ page }) => {
              setPage(page + 1);
              setApplyFilters(true);
            }}
            rowCount={total}
            pageSizeOptions={[limit]}
            disableRowSelectionOnClick
          />
        )}
      </Box>
      <ToastContainer />
    </>
  );
};

export default TeamAssignedBugsList;
