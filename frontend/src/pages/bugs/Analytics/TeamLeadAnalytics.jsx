import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  MenuItem,
  Grid,
  Button,
  CircularProgress,
  Autocomplete,
  Chip,
  Card,
  CardContent,
  Divider,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import axios from "axios";
import { saveAs } from "file-saver";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";

const priorities = ["Critical", "High", "Medium", "Low"];
const statuses = [
  "Assigned",
  "Fix In Progress",
  "Fixed (Testing Pending)",
  "Tester Assigned",
  "Testing In Progress",
];

const TeamLeadAnalytics = () => {
  const [filters, setFilters] = useState({
    priority: [],
    developerEmail: "",
    testerEmail: "",
    status: "",
    threshold: undefined,
    startDate: "",
    endDate: "",
  });

  const [devList, setdevList] = useState([]);
  const [testerList, settesterList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("token");
  const theme = useTheme();

  const roles = JSON.parse(localStorage.getItem("roles"));
  const roleHierarchy = ["user", "developer", "tester", "teamlead", "admin"];

  //Get role application and team of the logged in teamlead
  const getRoleAppAndTEam = (roles) => {
    if (!Array.isArray(roles)) return {};
    const filtered = roles.filter((r) => r.role === "teamlead");
    filtered.sort(
      (a, b) => roleHierarchy.indexOf(b.role) - roleHierarchy.indexOf(a.role)
    );
    if (filtered.length > 0) {
      const { application, team } = filtered[0];
      return { application, team };
    }
    return {};
  };

  const { application, team } = getRoleAppAndTEam(roles);

  //Call methods to fetch developers and testers and analytics
  useEffect(() => {
    fetchDeveloperAndTesterDropdowns();
    fetchAnalytics();
  }, [application, team]);

  //Get data for developer and tester dropdowns
  const fetchDeveloperAndTesterDropdowns = async () => {
    try {
      const [devRes, testerRes] = await Promise.all([
        axios.get(
          `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/developers/${application}/${team}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
        axios.get(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/testers/${application}/${team}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      console.log("dev data", devRes.data);
      console.log("tester data", testerRes.data);

      setdevList(devRes.data || []);
      settesterList(testerRes.data || []);
    } catch (err) {
      console.error("Error", err);
    }
  };

  //Get analytics
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/teamlead/${application}/${team}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { ...filters, application: application, team: team },
        }
      );
      console.log("sjdfn klsdnfl " + res.data);
      setAnalytics(res.data);
    } catch (err) {
      console.error("Error", err);
    } finally {
      setLoading(false);
    }
  };

  //Update filter state
  const handleFilterChange = (key, value) => {
    console.log(key + "sdsdsfs" + value);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Extract dev workload hours
  const devWorkloadRows = [];
  const devWorkloadData =
    analytics && analytics.devWorkload ? analytics.devWorkload : {};

  let index = 0;
  for (const email in devWorkloadData) {
    const entry = devWorkloadData[email];
    devWorkloadRows.push({
      id: index,
      email: email,
      bugCount: entry.bugCount,
      totalHours: entry.totalHours,
      bugs: entry.bugs,
    });
    index++;
  }

  //Extract dev tester hours
  const testerWorkloadRows = [];
  const testerWorkloadData =
    analytics && analytics.testerWorkload ? analytics.testerWorkload : {};

  index = 0;
  for (const email in testerWorkloadData) {
    const testerData = testerWorkloadData[email];
    testerWorkloadRows.push({
      id: index,
      email: email,
      bugCount: testerData.bugCount,
      totalHours: testerData.totalHours,
      bugs: testerData.bugs,
    });
    index++;
  }

  //Extract fix efficiency data
  const fixEffChartData = [];

  const fixData = analytics && analytics.fixEffiecincy;
  if (fixData) {
    for (const email in fixData) {
      const devMatch = devList.find((d) => d.email === email);
      const name = devMatch ? devMatch.fullName : email;
      const avgTime = Number(analytics.fixEffiecincy[email].avgTime);
      fixEffChartData.push({
        name: name,
        email: email,
        avgTime: avgTime,
      });
    }
  }

  //Get data to export
  const devFixData = [];

  if (analytics && analytics.fixEffiecincy) {
    for (const email in analytics.fixEffiecincy) {
      const devInfo = analytics.fixEffiecincy[email];
      const fullName =
        devList.find((d) => d.email === email)?.fullName || email;

      for (let i = 0; i < devInfo.bugs.length; i++) {
        const bug = devInfo.bugs[i];
        devFixData.push({
          developer: fullName,
          bugId: bug.bugId,
          priority: bug.priority,
          timeTakenHours: bug.timeTakenHours,
        });
      }
    }
  }

  //Extract validation efficiency data
  const validationEfficiencyChartData = [];

  const validationData = analytics && analytics.validationEfficiency;
  if (validationData) {
    for (const email in validationData) {
      const testerMatch = testerList.find((t) => t.email === email);
      const name = testerMatch ? testerMatch.fullName : email;
      validationEfficiencyChartData.push({
        name: name,
        email: email,
        avgTime: Number(analytics.validationEfficiency[email].avgTime),
      });
    }
  }

  //Get data to export
  const testerValidationData = [];

  if (analytics && analytics.validationEfficiency) {
    for (const email in analytics.validationEfficiency) {
      const testerInfo = analytics.validationEfficiency[email];
      const fullName =
        testerList.find((t) => t.email === email)?.fullName || email;

      for (let i = 0; i < testerInfo.bugs.length; i++) {
        const bug = testerInfo.bugs[i];
        testerValidationData.push({
          tester: fullName,
          bugId: bug.bugId,
          priority: bug.priority,
          timeTakenHours: bug.timeTakenHours,
        });
      }
    }
  }

  //Export CSV
  const handleExportCSV = (data, filename) => {
    if (!data.length) return;
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

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Team Lead Analytics
      </Typography>

      <Grid container spacing={2} mb={2}>
        <Grid item md={2}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={priorities}
            getOptionLabel={(option) => option}
            value={filters.priority}
            onChange={(e, newVal) => handleFilterChange("priority", newVal)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Priority"
                placeholder="Select priroity"
              />
            )}
          />
        </Grid>
        <Grid item md={2}>
          <TextField
            select
            label="Developer"
            fullWidth
            value={filters.developerEmail}
            onChange={(e) =>
              handleFilterChange("developerEmail", e.target.value)
            }
          >
            <MenuItem value="">All</MenuItem>
            {devList.map((dev) => (
              <MenuItem key={dev.email} value={dev.email}>
                {dev.fullName} ({dev.email})
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item md={2}>
          <TextField
            select
            label="Tester"
            fullWidth
            value={filters.testerEmail}
            onChange={(e) => handleFilterChange("testerEmail", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {testerList.map((tester) => (
              <MenuItem key={tester.email} value={tester.email}>
                {tester.fullName} ({tester.email})
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item md={2}>
          <TextField
            select
            label="Status"
            fullWidth
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {statuses.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item md={2}>
          <TextField
            label="Stuck Threshold"
            type="number"
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: 1,
              max: 20,
              step: 1,
            }}
            value={filters.threshold || ""}
            onChange={(e) => {
              const value = e.target.value;
              const parsedInt = parseInt(value, 10);
              handleFilterChange("threshold", isNaN() ? undefined : parsedInt);
            }}
          />
        </Grid>
        <Grid item>
          <TextField
            label="Start Date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            inputProps={{
              min: "2025-02-17",
              max: filters.endDate || dayjs().format("YYYY-MM-DD"),
            }}
          />
        </Grid>
        <Grid item>
          <TextField
            label="End Date"
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            inputProps={{
              min: filters.startDate || "2025-02-17",
              max: dayjs().format("YYYY-MM-DD"),
            }}
          />
        </Grid>
        <Grid item md={2}>
          <Button variant="contained" sx={{ ml: 2 }} onClick={fetchAnalytics}>
            Apply
          </Button>
        </Grid>
      </Grid>

      {loading ? (
        <Box textAlign="center" mt={4}>
          <CircularProgress />
          <Typography mt={2}>Loading analytics...</Typography>
        </Box>
      ) : analytics ? (
        <>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">
                1. Current Workload Overview
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1">Developer Workload</Typography>
              <DataGrid
                rows={devWorkloadRows}
                columns={[
                  { field: "email", headerName: "Developer", flex: 1 },
                  { field: "bugCount", headerName: "Bug Count", flex: 1 },
                  { field: "totalHours", headerName: "Total Hours", flex: 1 },
                ]}
                autoHeight
              />
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ mt: 1 }}
                onClick={() =>
                  handleExportCSV(
                    Object.entries(analytics.devWorkload).map(
                      ([email, val]) => ({
                        email,
                        bugCount: val.bugCount,
                        totalHours: val.totalHours,
                      })
                    ),
                    "developer_workload"
                  )
                }
              >
                Export CSV
              </Button>

              <Box mt={4} />
              <Typography variant="subtitle1">Tester Workload</Typography>
              <DataGrid
                rows={testerWorkloadRows}
                columns={[
                  { field: "email", headerName: "Tester", flex: 1 },
                  { field: "bugCount", headerName: "Bug Count", flex: 1 },
                  { field: "totalHours", headerName: "Total Hours", flex: 1 },
                ]}
                autoHeight
              />
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ mt: 1 }}
                onClick={() =>
                  handleExportCSV(
                    Object.entries(analytics.testerWorkload).map(
                      ([email, val]) => ({
                        email,
                        bugCount: val.bugCount,
                        totalHours: val.totalHours,
                      })
                    ),
                    "tester_workload"
                  )
                }
              >
                Export CSV
              </Button>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">2. Bug Distribution</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1">
                Developer Bug Distribution
              </Typography>
              <DataGrid
                rows={Object.entries(analytics.bugDistribution?.developers).map(
                  ([email, counts], i) => ({
                    id: i,
                    email,
                    ...counts,
                  })
                )}
                columns={[
                  { field: "email", headerName: "Developer", flex: 1 },
                  { field: "Critical", headerName: "Critical", flex: 1 },
                  { field: "High", headerName: "High", flex: 1 },
                  { field: "Medium", headerName: "Medium", flex: 1 },
                  { field: "Low", headerName: "Low", flex: 1 },
                ]}
                autoHeight
              />
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ mt: 1 }}
                onClick={() =>
                  handleExportCSV(
                    Object.entries(analytics.bugDistribution?.developers).map(
                      ([email, val]) => ({
                        email,
                        ...val,
                      })
                    ),
                    "developer_bug_distribution"
                  )
                }
              >
                Export CSV
              </Button>

              <Box mt={4} />
              <Typography variant="subtitle1">
                Tester Bug Distribution
              </Typography>
              <DataGrid
                rows={Object.entries(analytics.bugDistribution?.testers).map(
                  ([email, counts], i) => ({
                    id: i,
                    email,
                    ...counts,
                  })
                )}
                columns={[
                  { field: "email", headerName: "Tester", flex: 1 },
                  { field: "Critical", headerName: "Critical", flex: 1 },
                  { field: "High", headerName: "High", flex: 1 },
                  { field: "Medium", headerName: "Medium", flex: 1 },
                  { field: "Low", headerName: "Low", flex: 1 },
                ]}
                autoHeight
              />
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ mt: 1 }}
                onClick={() =>
                  handleExportCSV(
                    Object.entries(analytics.bugDistribution?.testers).map(
                      ([email, val]) => ({
                        email,
                        ...val,
                      })
                    ),
                    "tester_bug_distribution"
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
                3. Fix Efficiency (Developer)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1" gutterBottom>
                Average time taken by developer (in hours)
              </Typography>

              <Box sx={{ width: "100%", height: 300 }}>
                <BarChart width={600} height={300} data={fixEffChartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgTime" fill="#1976d2" name="Avg Hours" />
                </BarChart>
              </Box>

              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ mt: 1 }}
                onClick={() =>
                  handleExportCSV(devFixData, "fix_efficiency_by_developer")
                }
              >
                Export CSV
              </Button>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">
                4. Validation Efficiency (Tester)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="subtitle1" gutterBottom>
                Average time taken by tester (in hours)
              </Typography>

              <Box sx={{ width: "100%", height: 300 }}>
                <BarChart
                  width={600}
                  height={300}
                  data={validationEfficiencyChartData}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgTime" fill="#9c27b0" name="Avg Hours" />
                </BarChart>
              </Box>

              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                sx={{ mt: 1 }}
                onClick={() =>
                  handleExportCSV(
                    testerValidationData,
                    "validation_efifiency_by_tester"
                  )
                }
              >
                Export CSV
              </Button>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">5. Bugs Stuck in Status</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {filters.threshold && (
                <Typography variant="body1" mb={2}>
                  Bugs that haven’t had any updates in the last{" "}
                  <strong>{filters.threshold || 2} days or more</strong>.
                </Typography>
              )}

              <Grid container spacing={2}>
                {(analytics?.stuck).map((bug, index) => {
                  const dev = devList.find(
                    (d) => d.email === bug.assignedDeveloper
                  );
                  const tester = testerList.find(
                    (t) => t.email === bug.assignedTester
                  );

                  const getPriorityColor = (priority) =>
                    theme.palette.priority?.[priority?.toLowerCase()];

                  return (
                    <Grid item sm={6} md={4} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight="bold">
                            Bug ID: {bug.bugId}
                          </Typography>

                          <Divider sx={{ my: 1 }} />

                          <Box display="flex" alignItems="center">
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
                            <strong>Developer:</strong>{" "}
                            {dev?.fullName || bug.assignedDeveloper}
                          </Typography>

                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Tester:</strong>{" "}
                            {tester?.fullName || bug.assignedTester}
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
                onClick={() =>
                  handleExportCSV(analytics?.stuck || [], "bug_stuck")
                }
              >
                Export CSV
              </Button>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">
                6. Resolution Trend (Fixes, Verifications, Closures Over Time)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body1" mb={2}>
                Bugs fixed, verified or closed per day
              </Typography>

              {Object.keys(analytics?.resolutionTrend).length === 0 ? (
                <Typography variant="body2">
                  No data available for the selected filters.
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={Object.entries(analytics.resolutionTrend).map(
                      ([date, values]) => ({
                        date,
                        closed: values.closed || 0,
                        fixed: values.fixed || 0,
                        verified: values.verified || 0,
                      })
                    )}
                  >
                    <CartesianGrid stroke="#e0e0e0" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="fixed"
                      stroke="#F4A261"
                      name="Fixed (Testing Pending)"
                    />
                    <Line
                      type="monotone"
                      dataKey="verified"
                      stroke="#2E7D32"
                      name="Tested & Verified"
                    />
                    <Line
                      type="monotone"
                      dataKey="closed"
                      stroke="#1976d2"
                      name="Closed"
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
                    Object.entries(analytics.resolutionTrend).map(
                      ([date, val]) => ({
                        date,
                        fixed: val.fixed || 0,
                        verified: val.verified || 0,
                        closed: val.closed || 0,
                      })
                    ),
                    "resolution_trend"
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
                7. SLA Breaches Overview
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body1" mb={3}>
                SLA breaches by priority for developers and testers.
              </Typography>

              <Grid container spacing={4}>
                <Grid item md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Developer SLA breaches
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={["Critical", "High", "Medium", "Low"].map(
                          (priority) => ({
                            name: priority,
                            value: (analytics?.devSlaBreaches || []).filter(
                              (bug) => bug.priority === priority
                            ).length,
                          })
                        )}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        label
                      >
                        {["Critical", "High", "Medium", "Low"].map((p, i) => (
                          <Cell
                            key={i}
                            fill={theme.palette.priority?.[p.toLowerCase()]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${value}breaches`,
                          `Priority - ${name}`,
                        ]}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Grid>

                <Grid item md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Tester SLA breaches
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={priorities.map((priority) => ({
                          name: priority,
                          value: (analytics?.testerSlaBreaches || []).filter(
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
                            fill={theme.palette.priority?.[p.toLowerCase()]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${value}breaches`,
                          `Priority - ${name}`,
                        ]}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Grid>
              </Grid>

              <Box mt={4}>
                <Typography variant="subtitle1" mb={2}>
                  Breach Summary by Priority
                </Typography>
                <Grid container spacing={2}>
                  {priorities.map((p, i) => {
                    const devCount = (analytics?.devSlaBreaches || []).filter(
                      (b) => b.priority === p
                    ).length;
                    const testerCount = (
                      analytics?.testerSlaBreaches || []
                    ).filter((b) => b.priority === p).length;

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
                                  theme.palette.priority?.[p.toLowerCase()],
                                color: "#fff",
                                mr: 1,
                              }}
                            />
                            <Chip
                              label={`Tester: ${testerCount}`}
                              sx={{
                                backgroundColor:
                                  theme.palette.priority?.[p.toLowerCase()],
                                color: "#fff",
                              }}
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
                      analytics?.devSlaBreaches || [],
                      "developer_sla_breaches"
                    )
                  }
                >
                  Export Developer Breaches
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  sx={{ ml: 2 }}
                  onClick={() =>
                    handleExportCSV(
                      analytics?.testerSlaBreaches || [],
                      "tester_sla_breaches"
                    )
                  }
                >
                  Export Tester Breaches
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </>
      ) : null}
    </Box>
  );
};

export default TeamLeadAnalytics;
