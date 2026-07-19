import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Grid,
  Button,
  CircularProgress,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
} from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DataGrid } from "@mui/x-data-grid";
import axios from "axios";
import dayjs from "dayjs";
import { useTheme } from "@mui/material/styles";
import { saveAs } from "file-saver";
import DownloadIcon from "@mui/icons-material/Download";

const AdminAnalytics = () => {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [totalData, setTotalData] = useState(null);

  const [priorityData, setPriorityData] = useState(null);
  const [priorityFilters, setPriorityFilters] = useState({
    app: "",
    startDate: "",
    endDate: "",
  });
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [appLoading, setAppLoading] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusFilters, setStatusFilters] = useState({
    app: "",
    startDate: "",
    endDate: "",
  });
  const [unassignedData, setUnassignedData] = useState(null);
  const [unassignedFilters, setUnassignedFilters] = useState({
    app: "",
    team: "",
    priority: "",
    startDate: "",
    endDate: "",
  });
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [pageModel1, setPageModel1] = useState({ page: 0, pageSize: 5 });
  const [pageModel2, setPageModel2] = useState({ page: 0, pageSize: 5 });

  const [highPriorityPageModel, sethighPriorityDataPageModel] = useState({
    page: 0,
    pageSize: 5,
  });

  const [slaBreaches, setSlaBreaches] = useState({ dev: [], tester: [] });
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaData, setSlaData] = useState({
    devBreaches: [],
    testerBreaches: [],
  });

  const [slaFilters, setSlaFilters] = useState({
    app: "",
    team: "",
    priority: "",
    threshold: 2,
    startDate: "",
    endDate: "",
  });

  const [resolutionTrend, setResolutionTrend] = useState({});
  const [resolutionFilters, setResolutionFilters] = useState({
    app: "",
    startDate: "",
    endDate: "",
  });
  const [resolutionLoading, setResolutionLoading] = useState(false);

  const [workloadFilters, setworkloadFilters] = useState({
    app: "",
    team: "",
    role: "",
  });
  const [workloaddata, setworkloaddata] = useState([]);
  const [workloadLoading, setworkloadLoading] = useState(false);
  const [currentWorkloadRows, setCurrentWorkloadRows] = useState([]);

  const [highPriorityFilters, sethighPriorityDataFilters] = useState({
    app: "",
    team: "",
  });
  const [highPriorityData, sethighPriorityDataData] = useState([]);
  const [highPrioritySummary, sethighPriorityDataSummary] = useState({});
  const [highPriorityLoading, sethighPriorityDataLoading] = useState(false);

  const [stuckBugs, setstuckBugs] = useState([]);
  const [stuckLoading, setstuckLoading] = useState(false);
  const [stuckFilters, setstuckFilters] = useState({
    app: "",
    team: "",
    priority: "",
    threshold: 2,
  });

  const [error, setError] = useState(null);
  const token = localStorage.getItem("token");

  const priorities = ["Critical", "High", "Medium", "Low"];
  const theme = useTheme();

  //Get applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/applications`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log(response.data);
        setApplications(response.data);
      } catch (err) {
        setError("Failed to fetch applications.");
      }
    };

    fetchApplications();
  }, []);

  //Get all bugs count in every app and team
  const fetchTotalBugs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/total-bugs`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            startDate: filters.startDate,
            endDate: filters.endDate,
          },
        }
      );
      setTotalData(res.data);
    } catch (err) {
      console.error("Error fetching total bug data", err);
    } finally {
      setLoading(false);
    }
  };

  //Call method to get bugs count in every app and team
  useEffect(() => {
    fetchTotalBugs();
  }, [filters.startDate, filters.endDate]);

  //Update filter state for bugs count in every app and team
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const appRows = totalData?.bugsbyApplication
    ? Object.entries(totalData.bugsbyApplication).map(
        ([app, count], index) => ({
          id: index,
          application: app,
          count,
        })
      )
    : [];

  const teamAppRows = totalData?.bugsbyTeamPerApp
    ? Object.entries(totalData.bugsbyTeamPerApp).map(([app, teams], index) => ({
        id: index,
        application: app,
        frontend: teams.frontend,
        backend: teams.backend,
        devops: teams.devops,
      }))
    : [];

  //Get all bugs by priority
  const fetchBugsByPriority = async () => {
    setPriorityLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/bugs-by-priority`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: priorityFilters,
        }
      );
      setPriorityData(res.data);
    } catch (err) {
      console.error("Error fetching bugs by priority", err);
    } finally {
      setPriorityLoading(false);
    }
  };

  //Call method to get bugs by priority
  useEffect(() => {
    fetchBugsByPriority();
  }, [priorityFilters]);

  //Update filter state for bugs by priority
  const handlePriorityFilterChange = (key, value) => {
    setPriorityFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get bugs by status distribution
  const fetchstatusDistribution = async () => {
    setStatusLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/bugs-by-status`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: statusFilters,
        }
      );
      setStatusData(res.data);
    } catch (err) {
      console.error("Error fetching bug status distribution", err);
    } finally {
      setStatusLoading(false);
    }
  };

  //Call method to get bugs by status distribution
  useEffect(() => {
    fetchstatusDistribution();
  }, [statusFilters]);

  //Update filter state for bugs by status distribution
  const handleStatusFilterChange = (key, value) => {
    setStatusFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get all unassigned bugs (team and developer)
  const fetchUnassignedBugs = async () => {
    setUnassignedLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/unassigned-bugs`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: unassignedFilters,
        }
      );
      setUnassignedData(res.data);
    } catch (err) {
      console.error("Error fetching unassigned bugs", err);
    } finally {
      setUnassignedLoading(false);
    }
  };

  //Call method to get unassigned bugs (team and developer)
  useEffect(() => {
    fetchUnassignedBugs();
  }, [unassignedFilters]);
  //Update filter state for unassigned bugs (team and developer)
  const handleUnassignedFilterChange = (key, value) => {
    setUnassignedFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get all SLA breaches
  const fetchSlaBreaches = async () => {
    setSlaLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/sla-breaches`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: slaFilters,
        }
      );

      const dev = [];
      const tester = [];

      (res.data?.delayedBugs || []).forEach((bug) => {
        if (
          bug.currentStatus === "Fixed (Testing Pending)" ||
          bug.currentStatus === "Tester Assigned" ||
          bug.currentStatus === "Testing In Progress" ||
          bug.currentStatus === "Tested & Verified"
        ) {
          tester.push(bug);
        } else {
          dev.push(bug);
        }
      });

      setSlaBreaches({ dev, tester });
      setSlaData({
        devBreaches: dev,
        testerBreaches: tester,
      });
    } catch (err) {
      console.error("Error fetching SLA breaches:", err);
    } finally {
      setSlaLoading(false);
    }
  };

  //Call method to get SLA breaches
  useEffect(() => {
    fetchSlaBreaches();
  }, [slaFilters]);

  //Get resolution trend data (fixed vs reported)
  const fetchResolutionTrend = async () => {
    setResolutionLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/fix-vs-report-trend`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: resolutionFilters,
        }
      );
      setResolutionTrend(res.data || {});
    } catch (err) {
      console.error("Error fetching resolution trend", err);
    } finally {
      setResolutionLoading(false);
    }
  };

  //Call method to get resolution trend data (fixed vs reported)
  useEffect(() => {
    fetchResolutionTrend();
  }, [resolutionFilters]);

  //Update filter state for resolution trend data (fixed vs reported)
  const handleResolutionFilterChange = (key, value) => {
    setResolutionFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get current workload of developers, testers across applications and teams
  const fetchWorkload = async () => {
    setworkloadLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/current-workload`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: workloadFilters,
        }
      );
      setworkloaddata(res?.data || []);
      const rows = [];

      Object.entries(res.data?.workload).forEach(([app, teams]) => {
        Object.entries(teams).forEach(([team, roles]) => {
          ["developers", "testers"].forEach((roleKey) => {
            const role = roleKey === "developers" ? "developer" : "tester";
            Object.entries(roles?.[roleKey] || {}).forEach(
              ([email, metrics]) => {
                const bugDist = res.data?.bugDistribution?.[app]?.[team]?.[
                  roleKey
                ]?.[email] || {
                  Critical: 0,
                  High: 0,
                  Medium: 0,
                  Low: 0,
                };

                rows.push({
                  id: `${app}-${team}-${email}-${role}`,
                  application: app,
                  team,
                  userEmail: email,
                  role,
                  Critical: bugDist.Critical || 0,
                  High: bugDist.High || 0,
                  Medium: bugDist.Medium || 0,
                  Low: bugDist.Low || 0,
                  bugCount: metrics.bugCount || 0,
                  totalHours: metrics.totalHours || 0,
                });
              }
            );
          });
        });
      });
      console.log("SDFSDFSDF " + rows);
      setCurrentWorkloadRows(rows);
    } catch (err) {
      console.error("Error fetching workload:", err);
    } finally {
      setworkloadLoading(false);
    }
  };

  //Call method to get current workload of developers, testers across applications and teams
  useEffect(() => {
    fetchWorkload();
  }, [workloadFilters]);

  //Update filter state for current workload of developers, testers across applications and teams
  const handlWorkloadFilterChange = (key, value) => {
    setworkloadFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get high priority bugs
  const fetchHighProityBugs = async () => {
    sethighPriorityDataLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/high-priority-bugs`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: highPriorityFilters,
        }
      );
      sethighPriorityDataData(res.data?.bugs || []);
      sethighPriorityDataSummary(res.data?.summary || {});
    } catch (err) {
      console.error("Error fetching high priority open bugs:", err);
    } finally {
      sethighPriorityDataLoading(false);
    }
  };

  //Call method to get high priority bugs
  useEffect(() => {
    fetchHighProityBugs();
  }, [highPriorityFilters]);

  //Update filter state for high priority bugs
  const handlehighPriorityDataFilterChange = (key, value) => {
    sethighPriorityDataFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get bugs stuck in status
  const fetchstuckBugs = async () => {
    setstuckLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/admin/stuck-bugs`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: stuckFilters,
        }
      );
      setstuckBugs(res.data?.bugs || []);
    } catch (err) {
      console.error("Error fetching stuck bugs:", err);
    } finally {
      setstuckLoading(false);
    }
  };

  //Call method to get bugs stuck in status
  useEffect(() => {
    fetchstuckBugs();
  }, [stuckFilters]);

  //Update filter state for stuck in status
  const handlestuckFilterChange = (key, value) => {
    setstuckFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Export CSV
  const handleExportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const header = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => `"${val}"`)
        .join(",")
    );
    console.log("rows dddddddddddd" + rows);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `${filename}.csv`);
  };

  //Show error message
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <Box p={3}>
      <Typography variant="h5">Admin analytics</Typography>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            1. Bug Overview (App and team)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={filters.startDate}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value)
                  }
                  inputProps={{
                    min: "2025-02-17",
                    max: filters.endDate || dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={filters.endDate}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
                  inputProps={{
                    min: filters.startDate || "2025-02-17",
                    max: dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() =>
                    setFilters({
                      startDate: "",
                      endDate: "",
                    })
                  }
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>

          {loading ? (
            <Box textAlign="center" mt={2}>
              <CircularProgress />
              <Typography mt={2}>Loading bug overview</Typography>
            </Box>
          ) : (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6">Total Bugs Reported</Typography>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {totalData?.totalCount ? totalData?.totalCount : "-"}
                  </Typography>
                </CardContent>
              </Card>

              <Typography variant="subtitle1">Bugs by Application</Typography>
              <DataGrid
                rows={appRows}
                columns={[
                  { field: "application", headerName: "Application", flex: 1 },
                  { field: "count", headerName: "Bug Count", flex: 1 },
                ]}
                autoHeight
              />
              <Button
                variant="outlined"
                sx={{ mt: 1 }}
                onClick={() => handleExportCSV(appRows, "bugs_by_application")}
              >
                Export CSV
              </Button>
              <Box mt={4} />
              <Typography variant="subtitle1">
                Bugs by Team (within Each App)
              </Typography>
              {totalData?.bugsbyTeamPerApp &&
              Object.keys(totalData.bugsbyTeamPerApp).length > 0 ? (
                <DataGrid
                  rows={teamAppRows}
                  columns={[
                    {
                      field: "application",
                      headerName: "Application",
                      flex: 1,
                    },
                    { field: "frontend", headerName: "Frontend", flex: 1 },
                    { field: "backend", headerName: "Backend", flex: 1 },
                    { field: "devops", headerName: "DevOps", flex: 1 },
                  ]}
                  autoHeight
                />
              ) : (
                <Typography variant="body2" mt={2}>
                  No team data found for the selected filters.
                </Typography>
              )}
            </>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">2. Bugs by priority</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="app-select-label">
                    Select Application
                  </InputLabel>
                  <Select
                    labelId="app-select-label"
                    value={selectedApp}
                    label="Select Application"
                    onChange={(e) => {
                      const selected = e.target.value;
                      setSelectedApp(selected);
                      handlePriorityFilterChange("app", selected);
                    }}
                  >
                    {appLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={20} />
                      </MenuItem>
                    ) : (
                      applications.map((app) => (
                        <MenuItem value={app.name}>{app.name}</MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={priorityFilters.startDate}
                  onChange={(e) =>
                    handlePriorityFilterChange("startDate", e.target.value)
                  }
                  inputProps={{
                    min: "2025-02-17",
                    max: filters.endDate || dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={priorityFilters.endDate}
                  onChange={(e) =>
                    handlePriorityFilterChange("endDate", e.target.value)
                  }
                  inputProps={{
                    min: filters.startDate || "2025-02-17",
                    max: dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setSelectedApp("");
                    setPriorityFilters((prev) => ({
                      ...prev,
                      app: "",
                      startDate: "",
                      endDate: "",
                    }));
                  }}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>

          {priorityLoading ? (
            <Box textAlign="center" mt={2}>
              <CircularProgress />
              <Typography mt={2}>Loading priority data</Typography>
            </Box>
          ) : priorityData ? (
            <DataGrid
              rows={["Critical", "High", "Medium", "Low"].map((p, i) => ({
                id: i,
                priority: p,
                count: priorityData[p] || 0,
              }))}
              columns={[
                { field: "priority", headerName: "Priority", flex: 1 },
                { field: "count", headerName: "Bug Count", flex: 1 },
              ]}
              autoHeight
            />
          ) : (
            <Typography variant="body2" mt={2}>
              No data found for the selected filters.
            </Typography>
          )}
          <Button
            variant="outlined"
            sx={{ mt: 1 }}
            onClick={() =>
              handleExportCSV(
                ["Critical", "High", "Medium", "Low"].map((p, i) => ({
                  id: i,
                  priority: p,
                  count: priorityData[p] || 0,
                })),
                "bugs_by_priority"
              )
            }
          >
            Export CSV
          </Button>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">3. Bug Status Distribution</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="status-app-label">
                    Select Application
                  </InputLabel>
                  <Select
                    labelId="status-app-label"
                    value={statusFilters.app}
                    label="Select Application"
                    onChange={(e) =>
                      handleStatusFilterChange("app", e.target.value)
                    }
                  >
                    {appLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={20} />
                      </MenuItem>
                    ) : (
                      applications.map((app) => (
                        <MenuItem value={app.name}>{app.name}</MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={statusFilters.startDate}
                  onChange={(e) =>
                    handleStatusFilterChange("startDate", e.target.value)
                  }
                  inputProps={{
                    min: "2025-02-17",
                    max: filters.endDate || dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={statusFilters.endDate}
                  onChange={(e) =>
                    handleStatusFilterChange("endDate", e.target.value)
                  }
                  inputProps={{
                    min: filters.startDate || "2025-02-17",
                    max: dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>

              <Grid item md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setStatusFilters((prev) => ({
                      ...prev,
                      app: "",
                      startDate: "",
                      endDate: "",
                    }));
                  }}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>

          {statusLoading ? (
            <Box textAlign="center" mt={2}>
              <CircularProgress />
              <Typography mt={2}>Loading bug status breakdown</Typography>
            </Box>
          ) : statusData && Object.keys(statusData).length > 0 ? (
            <DataGrid
              rows={Object.entries(statusData).map(([status, count], i) => ({
                id: i,
                status,
                count,
              }))}
              columns={[
                { field: "status", headerName: "Status", flex: 1 },
                { field: "count", headerName: "Bug Count", flex: 1 },
              ]}
              autoHeight
            />
          ) : (
            <Typography variant="body2" mt={2}>
              No status data found for the selected filters.
            </Typography>
          )}
          <Button
            variant="outlined"
            sx={{ mt: 1 }}
            onClick={() =>
              handleExportCSV(
                Object.entries(statusData).map(([status, count], i) => ({
                  id: i,
                  status,
                  count,
                })),
                "bug_status_dsitriubution"
              )
            }
          >
            Export CSV
          </Button>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">4.Unassigned bugs</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="unassigned-app-label">
                    Select Application
                  </InputLabel>
                  <Select
                    labelId="unassigned-app-label"
                    value={unassignedFilters.app}
                    label="Select Application"
                    onChange={(e) =>
                      handleUnassignedFilterChange("app", e.target.value)
                    }
                  >
                    {appLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={20} />
                      </MenuItem>
                    ) : (
                      applications.map((app) => (
                        <MenuItem value={app.name}>{app.name}</MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="team-select-label">Select Team</InputLabel>
                  <Select
                    labelId="team-select-label"
                    value={unassignedFilters.team}
                    label="Select Team"
                    onChange={(e) =>
                      handleUnassignedFilterChange("team", e.target.value)
                    }
                  >
                    {["frontend", "backend", "devops", "unassigned"].map(
                      (team) => (
                        <MenuItem value={team}>{team}</MenuItem>
                      )
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="priority-select-label">
                    Select Priority
                  </InputLabel>
                  <Select
                    labelId="priority-select-label"
                    value={unassignedFilters.priority}
                    label="Select Priority"
                    onChange={(e) =>
                      handleUnassignedFilterChange("priority", e.target.value)
                    }
                  >
                    {["Critical", "High", "Medium", "Low"].map((priority) => (
                      <MenuItem key={priority} value={priority}>
                        {priority}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={unassignedFilters.startDate}
                  onChange={(e) =>
                    handleUnassignedFilterChange("startDate", e.target.value)
                  }
                  inputProps={{
                    min: "2025-02-17",
                    max: filters.endDate || dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={unassignedFilters.endDate}
                  onChange={(e) =>
                    handleUnassignedFilterChange("endDate", e.target.value)
                  }
                  inputProps={{
                    min: filters.startDate || "2025-02-17",
                    max: dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>

              <Grid item md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setUnassignedFilters((prev) => ({
                      ...prev,
                      app: "",
                      team: "",
                      priority: "",
                      startDate: "",
                      endDate: "",
                    }));
                  }}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>

          {unassignedLoading ? (
            <Box textAlign="center" mt={2}>
              <CircularProgress />
              <Typography mt={2}>Loading unasisgned bugs</Typography>
            </Box>
          ) : unassignedData ? (
            <>
              <Typography variant="subtitle1">Unassigned to Team</Typography>
              <DataGrid
                rows={(unassignedData.unasisgnedToTeam || []).map((bug) => ({
                  id: bug.bugId,
                  ...bug,
                }))}
                columns={[
                  { field: "bugId", headerName: "Bug ID", flex: 1 },
                  { field: "application", headerName: "App", flex: 1 },
                  { field: "createdAt", headerName: "Reported On", flex: 1 },
                ]}
                paginationModel={pageModel1}
                onPaginationModelChange={setPageModel1}
                pageSizeOptions={[5]}
                pagination
                autoHeight
              />

              <Box mt={4} />
              <Typography variant="subtitle1">
                Unassigned to Developer (Team assigned)
              </Typography>
              <DataGrid
                rows={(unassignedData.unassignedToDeveloper || []).map(
                  (bug) => ({
                    id: bug.bugId,
                    ...bug,
                  })
                )}
                columns={[
                  { field: "bugId", headerName: "Bug ID", flex: 1 },
                  { field: "application", headerName: "App", flex: 1 },
                  { field: "team", headerName: "Team", flex: 1 },
                  { field: "createdAt", headerName: "Reported On", flex: 1 },
                ]}
                autoHeight
                paginationModel={pageModel2}
                onPaginationModelChange={setPageModel2}
                pageSizeOptions={[5]}
                pagination
              />
            </>
          ) : (
            <Typography variant="body2" mt={2}>
              No unassigned data available.
            </Typography>
          )}
          <Button
            variant="outlined"
            sx={{ mt: 1 }}
            onClick={() =>
              handleExportCSV(
                unassignedData.unassignedToDeveloper || [],
                "unassigned_to_developer"
              )
            }
          >
            Export CSV
          </Button>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">5. SLA summary overview</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container>
            <Grid item md={6}>
              <Typography variant="subtitle1">
                Developer SLA breaches
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={priorities.map((priority) => ({
                      name: priority,
                      value: (slaData.devBreaches || []).filter(
                        (bug) => bug.priority === priority
                      ).length,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    {priorities.map((p, i) => (
                      <Cell
                        key={i}
                        fill={
                          theme.palette.priority?.[p.toLowerCase()] || "#ccc"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Grid>

            <Grid item md={6}>
              <Typography variant="subtitle1">Tester SLA breaches</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={priorities.map((priority) => ({
                      name: priority,
                      value: (slaData.testerBreaches || []).filter(
                        (bug) => bug.priority === priority
                      ).length,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    {priorities.map((p, i) => (
                      <Cell
                        key={i}
                        fill={
                          theme.palette.priority?.[p.toLowerCase()] || "#ccc"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>

          <Box mt={4}>
            <Typography variant="subtitle1" mb={2}>
              Breach Summary
            </Typography>
            <Grid container>
              {priorities.map((p, i) => {
                const devCount = (slaData.devBreaches || []).filter(
                  (b) => b.priority === p
                ).length;
                const testerCount = (slaData.testerBreaches || []).filter(
                  (b) => b.priority === p
                ).length;

                return (
                  <Grid item md={3} key={i}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography fontWeight="bold" sx={{ mb: 1 }}>
                          {p} Priority
                        </Typography>
                        <Chip
                          label={`Dev: ${devCount}`}
                          sx={{
                            backgroundColor:
                              theme.palette.priority?.[p.toLowerCase()] ||
                              "#ccc",
                            color: "#fff",
                          }}
                        />
                        <Chip
                          label={`Tester: ${testerCount}`}
                          sx={{ backgroundColor: "#9C27B0", color: "#fff" }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          <Box mt={4}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() =>
                handleExportCSV(
                  slaData.devBreaches || [],
                  "developer_sla_breaches"
                )
              }
            >
              Export CSV
            </Button>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              sx={{ ml: 2 }}
              onClick={() =>
                handleExportCSV(
                  slaData.testerBreaches || [],
                  "tester_sla_breaches"
                )
              }
            >
              Export CSV
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">6. Fix vs report bugs trend</Typography>
        </AccordionSummary>

        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="app-select-label">
                    Select Application
                  </InputLabel>
                  <Select
                    labelId="app-select-label"
                    value={selectedApp}
                    label="Select Application"
                    onChange={(e) => {
                      const selected = e.target.value;
                      setSelectedApp(selected);
                      handleResolutionFilterChange("app", selected);
                    }}
                  >
                    {appLoading ? (
                      <MenuItem disabled>
                        <CircularProgress size={20} />
                      </MenuItem>
                    ) : (
                      applications.map((app) => (
                        <MenuItem value={app.name}>{app.name}</MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={resolutionFilters.startDate}
                  onChange={(e) =>
                    handleResolutionFilterChange("startDate", e.target.value)
                  }
                  inputProps={{
                    min: "2025-02-17",
                    max: filters.endDate || dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={resolutionFilters.endDate}
                  onChange={(e) =>
                    handleResolutionFilterChange("endDate", e.target.value)
                  }
                  inputProps={{
                    min: filters.startDate || "2025-02-17",
                    max: dayjs().format("YYYY-MM-DD"),
                  }}
                />
              </Grid>
              <Grid item md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setSelectedApp("");
                    setResolutionFilters((prev) => ({
                      ...prev,
                      app: "",
                      startDate: "",
                      endDate: "",
                    }));
                  }}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>
          <Typography variant="body1" mb={2}>
            Number of bugs reported vs. fixed over time for the selected
            filters.
          </Typography>

          {Object.keys(resolutionTrend).length === 0 ? (
            <Typography variant="body2">
              No data available for the selected period.
            </Typography>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={Object.entries(resolutionTrend || {}).map(
                  ([date, counts]) => ({
                    date,
                    reported: counts.reported || 0,
                    fixed: counts.fixed || 0,
                  })
                )}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid stroke="#ccc" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="reported"
                  stroke="#F44336"
                  name="Reported"
                />
                <Line
                  type="monotone"
                  dataKey="fixed"
                  stroke="#F4A261"
                  name="Fixed"
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ mt: 2 }}
            onClick={() =>
              handleExportCSV(
                Object.entries(resolutionTrend).map(([date, counts]) => ({
                  date,
                  reported: counts.reported || 0,
                  fixed: counts.fixed || 0,
                })),
                "fix_vs_report"
              )
            }
          >
            Export CSV
          </Button>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            7. Current Workload and bug distribution
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="workload-app-label">Application</InputLabel>
                  <Select
                    labelId="workload-app-label"
                    value={workloadFilters.app}
                    onChange={(e) =>
                      handlWorkloadFilterChange("app", e.target.value)
                    }
                  >
                    {applications.map((app) => (
                      <MenuItem value={app.name}>{app.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="workload-team-label">Team</InputLabel>
                  <Select
                    labelId="workload-team-label"
                    value={workloadFilters.team}
                    onChange={(e) =>
                      handlWorkloadFilterChange("team", e.target.value)
                    }
                  >
                    {["frontend", "backend", "devops"].map((team) => (
                      <MenuItem key={team} value={team}>
                        {team}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="workload-role-label">Role</InputLabel>
                  <Select
                    labelId="workload-role-label"
                    value={workloadFilters.role}
                    onChange={(e) =>
                      handlWorkloadFilterChange("role", e.target.value)
                    }
                  >
                    <MenuItem value="developer">Developer</MenuItem>
                    <MenuItem value="tester">Tester</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() =>
                    setworkloadFilters({ app: "", team: "", role: "" })
                  }
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>

          {workloadLoading ? (
            <Box textAlign="center" mt={2}>
              <CircularProgress />
              <Typography mt={2}>Loading workload overview</Typography>
            </Box>
          ) : (
            <>
              <DataGrid
                rows={currentWorkloadRows}
                columns={[
                  { field: "application", headerName: "Application", flex: 1 },
                  { field: "team", headerName: "Team", flex: 1 },
                  { field: "userEmail", headerName: "User", flex: 1 },
                  { field: "role", headerName: "Role", flex: 1 },
                  { field: "Critical", headerName: "Critical", flex: 1 },
                  { field: "High", headerName: "High", flex: 1 },
                  { field: "Medium", headerName: "Medium", flex: 1 },
                  { field: "Low", headerName: "Low", flex: 1 },
                  { field: "bugCount", headerName: "Total Bugs", flex: 1 },
                  { field: "totalHours", headerName: "Total Hours", flex: 1 },
                ]}
                autoHeight
              />

              <Button
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() =>
                  handleExportCSV(workloaddata, "workload_overview")
                }
              >
                Export CSV
              </Button>
            </>
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            8. High Priority bugs still Open
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="high-app-label">Application</InputLabel>
                  <Select
                    labelId="high-app-label"
                    value={highPriorityFilters.app}
                    onChange={(e) =>
                      handlehighPriorityDataFilterChange("app", e.target.value)
                    }
                  >
                    {applications.map((app) => (
                      <MenuItem value={app.name}>{app.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={3}>
                <FormControl fullWidth>
                  <InputLabel id="high-team-label">Team</InputLabel>
                  <Select
                    labelId="high-team-label"
                    value={highPriorityFilters.team}
                    onChange={(e) =>
                      handlehighPriorityDataFilterChange("team", e.target.value)
                    }
                  >
                    {["frontend", "backend", "devops"].map((team) => (
                      <MenuItem key={team} value={team}>
                        {team}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() =>
                    sethighPriorityDataFilters({ app: "", team: "" })
                  }
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>

          {highPriorityLoading ? (
            <Box textAlign="center" mt={2}>
              <CircularProgress />
              <Typography mt={2}>Loading high priority bugs</Typography>
            </Box>
          ) : highPriorityData.length === 0 ? (
            <Typography>No critical or high priority bugs open.</Typography>
          ) : (
            <>
              <Box mb={2}>
                <Grid container>
                  {Object.entries(highPrioritySummary).map(([p, count]) => (
                    <Grid item key={p}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography fontWeight="bold">{p} Bugs</Typography>
                          <Typography
                            color="primary"
                            variant="h5"
                            fontWeight="bold"
                          >
                            {count}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <DataGrid
                rows={highPriorityData.map((bug, i) => ({
                  id: i,
                  bugId: bug.bugId,
                  title: bug.title,
                  application: bug.application,
                  assignedTeam: bug.assignedTeam,
                  priority: bug.priority,
                  status: bug.status,
                }))}
                columns={[
                  { field: "bugId", headerName: "Bug ID", flex: 1 },
                  { field: "title", headerName: "Title", flex: 2 },
                  { field: "application", headerName: "App", flex: 1 },
                  { field: "assignedTeam", headerName: "Team", flex: 1 },
                  { field: "priority", headerName: "Priority", flex: 1 },
                  { field: "status", headerName: "Status", flex: 1 },
                ]}
                autoHeight
                pagination
                paginationModel={highPriorityPageModel}
                onPaginationModelChange={sethighPriorityDataPageModel}
                pageSizeOptions={[5]}
              />

              <Button
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() =>
                  handleExportCSV(
                    highPriorityData,
                    "high_priority_bugs_still_open"
                  )
                }
              >
                Export CSV
              </Button>
            </>
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">
            9. Stuck Bugs (No status update)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box mb={2}>
            <Grid container>
              <Grid item md={4}>
                <FormControl fullWidth>
                  <InputLabel id="stuck-app-label">Application</InputLabel>
                  <Select
                    labelId="stuck-app-label"
                    value={stuckFilters.app}
                    onChange={(e) =>
                      handlestuckFilterChange("app", e.target.value)
                    }
                  >
                    {applications.map((app) => (
                      <MenuItem value={app.name}>{app.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={4}>
                <FormControl fullWidth>
                  <InputLabel id="stuck-team-label">Team</InputLabel>
                  <Select
                    labelId="stuck-team-label"
                    value={stuckFilters.team}
                    onChange={(e) =>
                      handlestuckFilterChange("team", e.target.value)
                    }
                  >
                    {["frontend", "backend", "devops"].map((team) => (
                      <MenuItem key={team} value={team}>
                        {team}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item md={3}>
                <TextField
                  label="Threshold (Days)"
                  type="number"
                  fullWidth
                  inputProps={{ min: 1 }}
                  value={stuckFilters.threshold}
                  onChange={(e) =>
                    handlestuckFilterChange("threshold", e.target.value)
                  }
                />
              </Grid>
              <Grid item md={1}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() =>
                    setstuckFilters({ app: "", team: "", threshold: 2 })
                  }
                >
                  Reset
                </Button>
              </Grid>
            </Grid>
          </Box>

          {stuckLoading ? (
            <Box textAlign="center" mt={2}>
              <CircularProgress />
              <Typography mt={2}>Loading stuck bugs</Typography>
            </Box>
          ) : stuckBugs.length === 0 ? (
            <Typography>No stuck bugs found for selected criteria.</Typography>
          ) : (
            <>
              <Typography variant="body1" mb={2}>
                Bugs that haven’t had any updates in the last{" "}
                <strong>{stuckFilters.threshold || 2} days</strong>.
              </Typography>

              <Grid container>
                {stuckBugs.map((bug, index) => {
                  const getPriorityColor = (priority) =>
                    theme.palette.priority?.[priority?.toLowerCase()] ||
                    "#9e9e9e";

                  return (
                    <Grid item md={4} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight="bold">
                            Bug ID: {bug.bugId}
                          </Typography>

                          <Divider sx={{ my: 1 }} />

                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mb={1}
                          >
                            <Chip
                              label={bug.priority}
                              size="small"
                              sx={{
                                backgroundColor: getPriorityColor(bug.priority),
                                color: "#fff",
                                fontWeight: 500,
                              }}
                            />
                            <Chip
                              label={bug.currentStatus}
                              variant="outlined"
                              size="small"
                              color="primary"
                            />
                          </Box>

                          <Typography variant="body2">
                            <strong>Application:</strong>{" "}
                            {bug.application || "-"}
                          </Typography>

                          <Typography variant="body2">
                            <strong>Team:</strong> {bug.team || "-"}
                          </Typography>

                          <Typography variant="body2">
                            <strong>Developer:</strong>{" "}
                            {bug.assignedDeveloper || "-"}
                          </Typography>

                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Tester:</strong> {bug.assignedTester || "-"}
                          </Typography>

                          <Chip
                            label={`Stuck for ${bug.daysStuck} day${
                              bug.daysStuck === 1 ? "" : "s"
                            }`}
                            color="secondary"
                            variant="filled"
                            size="small"
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>

              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ mt: 2 }}
                onClick={() => handleExportCSV(stuckBugs, "stuck_bugss")}
              >
                Export CSV
              </Button>
            </>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default AdminAnalytics;
