import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Button,
  LinearProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import axios from "axios";
import { saveAs } from "file-saver";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
const TesterAnalytics = () => {
  const roles = JSON.parse(localStorage.getItem("roles"));
  const roleHierarchy = ["user", "tester", "developer", "teamlead", "admin"];

  //Get role application and team of the logged in tester
  const getRoleAppAndTEam = (roles) => {
    if (!Array.isArray(roles)) return {};
    const filtered = roles.filter((r) => r.role === "tester");
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
  console.log(application, team);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [testTrendData, setTestTrendData] = useState([]);
  const [testTrendLoading, setTestTrendLoading] = useState(false);
  const [testTrendFilters, setTestTrendFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const [avgtestTimeData, setavgtestTimeData] = useState([]);
  const [avgtestTimeLoading, setavgtestTimeLoading] = useState(false);
  const [avgtestTimeFilters, setavgtestTimeFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const [slaFilters, setSlaFilters] = useState({
    startDate: "",
    endDate: "",
    priority: "",
  });
  const [slaBreaschesData, setslaBreaschesData] = useState([]);
  const [slaLoading, setSlaLoading] = useState(false);

  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusFilters, setStatusFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const token = localStorage.getItem("token");
  const testerEmail = localStorage.getItem("loggedInUserEmail");
  const theme = useTheme();

  //Get summary data (total tested, assigned, bug test rate, workload etc.,)
  const fetchSummaryData = async () => {
    setSummaryLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/tester/summary/${testerEmail}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            application: application,
            team: team,
          },
        }
      );
      setSummaryData(res.data);
    } catch (err) {
      console.error("Error", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  //Call summary data fetching method
  useEffect(() => {
    if (testerEmail) {
      fetchSummaryData();
    }
  }, [testerEmail]);

  //Update filter state for test trend
  const handleTestTerendFilterChange = (key, value) => {
    setTestTrendFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get test trend data
  const fetchTestTrendData = async () => {
    setTestTrendLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/tester/test-trend/${testerEmail}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            startDate: testTrendFilters.startDate,
            endDate: testTrendFilters.endDate,
            application: application,
            team: team,
          },
        }
      );
      setTestTrendData(res.data || []);
    } catch (err) {
      console.error("Error", err);
    } finally {
      setTestTrendLoading(false);
    }
  };

  //Call test trend data fetching method
  useEffect(() => {
    if (testerEmail) {
      fetchTestTrendData();
    }
  }, [testerEmail, testTrendFilters.startDate, testTrendFilters.endDate]);

  //Update filter state for avg test time
  const handleAvgTestTimeFilterChange = (key, value) => {
    setavgtestTimeFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get avg test time data
  const fetchavgtestTimeData = async () => {
    setavgtestTimeLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/tester/avg-test-time/${testerEmail}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            startDate: avgtestTimeFilters.startDate,
            endDate: avgtestTimeFilters.endDate,
            application: application,
            team: team,
          },
        }
      );

      const transformed = ["Critical", "High", "Medium", "Low"].map(
        (priority) => ({
          priority,
          avgHours: res.data?.[priority]?.avgHours || 0,
          count: res.data?.[priority]?.count || 0,
        })
      );

      console.log(transformed);

      setavgtestTimeData(transformed);
    } catch (err) {
      console.error("Error", err);
    } finally {
      setavgtestTimeLoading(false);
    }
  };

  //Call avg test time data fetching method
  useEffect(() => {
    if (testerEmail) {
      console.log("insdide useffect of test avg time");
      fetchavgtestTimeData();
    }
  }, [testerEmail, avgtestTimeFilters.startDate, avgtestTimeFilters.endDate]);

  //Update filter state for sla
  const handleSlaFilterChange = (key, value) => {
    setSlaFilters((prev) => ({ ...prev, [key]: value }));
  };

  //Get sla breaches data
  const fetchSlaBreaches = async () => {
    setSlaLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/tester/sla-breaches/${testerEmail}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            ...slaFilters,
            application: application,
            team: team,
          },
        }
      );
      setslaBreaschesData(res.data || []);
    } catch (err) {
      console.error("Error", err);
    } finally {
      setSlaLoading(false);
    }
  };

  //Call sla breaches data fetching method
  useEffect(() => {
    if (testerEmail) {
      fetchSlaBreaches();
    }
  }, [testerEmail, slaFilters]);

  //Get status data
  const fetchStatusData = async () => {
    setStatusLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/analytics/tester/bug-status-overview/${testerEmail}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            ...statusFilters,
            application,
            team,
          },
        }
      );
      setStatusData(res.data);
    } catch (err) {
      console.error("Error", err);
    } finally {
      setStatusLoading(false);
    }
  };

  //Using separate useEffects for each metric to avoid fetching other data multiple times for unrelated change. (Eg. adding status filters need not fecth sla breaches data)
  useEffect(() => {
    if (testerEmail) {
      fetchStatusData();
    }
  }, [testerEmail, statusFilters]);

  //Export CSV emthod
  const exportToCSV = (dataArray, headersMap, fileName) => {
    console.log(dataArray);
    if (!dataArray || dataArray.length === 0) return;

    const headers = Object.keys(headersMap).join(",");
    const rows = dataArray.map((item) =>
      Object.keys(headersMap)
        .map((key) => {
          const value = item[key];
          return `"${value !== undefined && value !== null ? value : ""}"`;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `${fileName}.csv`);
  };

  const pieChartData = [];
  statusData &&
    Object.entries(statusData).forEach(([status, info]) => {
      if (status !== "total") {
        pieChartData.push({
          name: status,
          value: info.count,
        });
      }
    });
  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Tester Analytics
      </Typography>

      <Box>
        <Typography variant="h6" gutterBottom>
          1. Grouped Summary Overview
        </Typography>

        {summaryLoading ? (
          <Box textAlign="center" mt={2}>
            <CircularProgress />
            <Typography mt={2}>loading summary data</Typography>
          </Box>
        ) : summaryData ? (
          <>
            <Grid container spacing={2}>
              <Grid item md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1">Total Tested</Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {summaryData.totalTetsed}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1">Total Assigned</Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {summaryData.totalAssigned}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography variant="subtitle1">
                        Bug test rate %
                      </Typography>
                      <Tooltip title="Bug Test Rate =(Total tested bugs/ Total assigned) x 100">
                        <InfoOutlinedIcon fontSize="small" color="action" />
                      </Tooltip>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {summaryData.bugTestRate !== undefined
                        ? summaryData.bugTestRate
                        : "-"}
                      %
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography variant="subtitle1">
                        Timely test rate %
                      </Typography>
                      <Tooltip title="Timely Test Rate =(Timely tested bugs/ Total tested bugs) x 100">
                        <InfoOutlinedIcon fontSize="small" color="action" />
                      </Tooltip>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {summaryData.timelyTestRate !== undefined
                        ? summaryData.timelyTestRate
                        : "-"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Workload (Hours Used / 40 Hours)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  summaryData.workload?.current
                    ? (summaryData.workload.current / 40) * 100
                    : 0
                }
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: theme.palette.grey[300],
                }}
              />
              <Typography variant="body2" mt={1}>
                {summaryData.workload?.current !== undefined
                  ? summaryData.workload?.current
                  : "-"}
                / 40 hours
              </Typography>
            </Box>

            <Box>
              <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                <Typography variant="subtitle1">
                  Test Rate by Priority (%)
                </Typography>
                <Tooltip title="Test Rate =(Tested priority bugs /Assigned priority bugs) x 100">
                  <InfoOutlinedIcon fontSize="small" color="action" />
                </Tooltip>
              </Box>
              <DataGrid
                rows={["Critical", "High", "Medium", "Low"].map(
                  (priority, i) => ({
                    id: i,
                    priority,
                    testRate:
                      summaryData.testRateByPriority?.[priority] !== undefined
                        ? summaryData.testRateByPriority?.[priority]
                        : "-",
                  })
                )}
                columns={[
                  { field: "priority", headerName: "Priority", flex: 1 },
                  { field: "testRate", headerName: "Test Rate (%)", flex: 1 },
                ]}
                autoHeight
              />
            </Box>

            <Button
              variant="outlined"
              onClick={() =>
                exportToCSV(
                  [
                    {
                      totalTested: summaryData.totalTetsed,
                      totalAssigned: summaryData.totalAssigned,
                      bugTestRate: summaryData.bugTestRate,
                      timelyTestRate: summaryData.timelyTestRate,
                      workload: summaryData.workload?.current,
                    },
                  ],
                  {
                    totalTested: "Total Tested",
                    totalAssigned: "Total Assigned",
                    bugTestRate: "Bug Test Rate (%)",
                    timelyTestRate: "Timely Test Rate (%)",
                    workload: "Workload (hrs)",
                  },
                  "summary"
                )
              }
              sx={{ mt: 2 }}
            >
              Export CSV
            </Button>
          </>
        ) : (
          <Typography>No data found.</Typography>
        )}
      </Box>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h6">2. Test Efficiency Over Time</Typography>
          <Tooltip title="Number of bugs tested (reached 'Tested (Testing Pending)' status) everyday.">
            <InfoOutlinedIcon fontSize="small" color="action" />
          </Tooltip>
        </Box>

        <Box mb={2}>
          <Grid container spacing={2}>
            <Grid item md={3}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={testTrendFilters.startDate}
                onChange={(e) =>
                  handleTestTerendFilterChange("startDate", e.target.value)
                }
                inputProps={{
                  min: "2025-02-17",

                  max: testTrendFilters.endDate || dayjs().format("YYYY-MM-DD"),
                }}
              />
            </Grid>
            <Grid item md={3}>
              <TextField
                label="End Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={testTrendFilters.endDate}
                onChange={(e) =>
                  handleTestTerendFilterChange("endDate", e.target.value)
                }
                inputProps={{
                  min: testTrendFilters.startDate || "2025-02-17",
                  max: dayjs().format("YYYY-MM-DD"),
                }}
              />
            </Grid>
            <Grid item md={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  setTestTrendFilters({ startDate: "", endDate: "" })
                }
              >
                Reset
              </Button>
            </Grid>
            <Grid item md={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  exportToCSV(
                    testTrendData,
                    { date: "Date", count: "Tested Count" },
                    "test+trend"
                  )
                }
              >
                Export CSV
              </Button>
            </Grid>
          </Grid>
        </Box>

        {testTrendLoading ? (
          <Box textAlign="center" mt={2}>
            <CircularProgress />
            <Typography mt={2}>loading test trend</Typography>
          </Box>
        ) : testTrendData.length === 0 ? (
          <Typography>No test data available for selected period.</Typography>
        ) : testTrendData.length > 0 ? (
          <div style={{ width: "100%", height: "350px" }}>
            <LineChart width={720} height={300} data={testTrendData}>
              <CartesianGrid />
              <XAxis dataKey="date" />
              <YAxis />
              <RechartTooltip />
              <Line type="monotone" dataKey="count" stroke="#2196f3" />
            </LineChart>
          </div>
        ) : (
          <Typography>No data found</Typography>
        )}
      </Box>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h6">3. Average Test Time by Priority</Typography>
          <Tooltip title="Average Test Time by Priority =(Total hours spent testing bugs of each priority/Number of bugs tested in that priority). Only bugs reaching 'Tested (Testing Pending)' status are considered. (as itstester metric)">
            <InfoOutlinedIcon fontSize="small" color="action" />
          </Tooltip>
        </Box>

        <Box mb={2}>
          <Grid container spacing={2}>
            <Grid item md={3}>
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={avgtestTimeFilters.startDate}
                onChange={(e) =>
                  handleAvgTestTimeFilterChange("startDate", e.target.value)
                }
                inputProps={{
                  max:
                    avgtestTimeFilters.endDate || dayjs().format("YYYY-MM-DD"),
                }}
              />
            </Grid>
            <Grid item md={3}>
              <TextField
                label="End Date"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={avgtestTimeFilters.endDate}
                onChange={(e) =>
                  handleAvgTestTimeFilterChange("endDate", e.target.value)
                }
                inputProps={{
                  min: avgtestTimeFilters.startDate || "2025-02-17",
                  max: dayjs().format("YYYY-MM-DD"),
                }}
              />
            </Grid>
            <Grid item md={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  setavgtestTimeFilters({ startDate: "", endDate: "" })
                }
              >
                Reset
              </Button>
            </Grid>
            <Grid item md={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  exportToCSV(
                    avgtestTimeData,
                    { priority: "Priority", avgHours: "Avg test time" },
                    "avg_test_time"
                  )
                }
              >
                Export CSV
              </Button>
            </Grid>
          </Grid>
        </Box>

        {avgtestTimeLoading ? (
          <Box textAlign="center" mt={2}>
            <CircularProgress />
            <Typography mt={2}>loading avg test time data</Typography>
          </Box>
        ) : avgtestTimeData.length === 0 ? (
          <Typography>No data found</Typography>
        ) : avgtestTimeData.length ? (
          <BarChart width={800} height={380} data={avgtestTimeData}>
            <CartesianGrid />
            <XAxis dataKey="priority" />
            <YAxis />
            <RechartTooltip />
            <Bar dataKey="avgHours" fill="#1565c0" />
          </BarChart>
        ) : (
          <Typography variant="body2">No data found</Typography>
        )}
      </Box>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5} mb={1}>
          <Typography variant="subtitle1">
            Average Test Time by Priority (Hours)
          </Typography>
          <Tooltip title="Average =(Totalhours for priority /Bugs teste of priority)">
            <InfoOutlinedIcon fontSize="small" color="action" />
          </Tooltip>
        </Box>
        <DataGrid
          rows={avgtestTimeData.map((item, i) => ({
            id: i,
            priority: item.priority,
            avgHours: Number(item.avgHours).toFixed(2),
            count: item.count,
          }))}
          columns={[
            { field: "priority", headerName: "Priority", flex: 1 },
            { field: "avgHours", headerName: "Avg Hours", flex: 1 },
            { field: "count", headerName: "Tested Count", flex: 1 },
          ]}
          autoHeight
        />
      </Box>
      <Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h6">4. SLA Breaches</Typography>
          <Tooltip title="Bugs tested beyond the allowed time (Critical: 6h, High: 9h, Medium: 3h, Low: 1h). Based on assignment to tested hours.">
            <InfoOutlinedIcon fontSize="small" color="action" />
          </Tooltip>
        </Box>

        <Grid container spacing={2} mb={2} mt={1}>
          <Grid item md={3}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={slaFilters.startDate}
              onChange={(e) =>
                handleSlaFilterChange("startDate", e.target.value)
              }
              inputProps={{
                max: slaFilters.endDate || dayjs().format("YYYY-MM-DD"),
              }}
            />
          </Grid>
          <Grid item md={3}>
            <TextField
              label="End Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={slaFilters.endDate}
              onChange={(e) => handleSlaFilterChange("endDate", e.target.value)}
              inputProps={{
                min: slaFilters.startDate || "2025-02-17",
                max: dayjs().format("YYYY-MM-DD"),
              }}
            />
          </Grid>
          <Grid item md={3}>
            <TextField
              label="Priority"
              select
              fullWidth
              SelectProps={{ native: true }}
              value={slaFilters.priority}
              onChange={(e) =>
                handleSlaFilterChange("priority", e.target.value)
              }
            >
              <option value="">All</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </TextField>
          </Grid>

          <Grid item md={1}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() =>
                setSlaFilters({ startDate: "", endDate: "", priority: "" })
              }
            >
              Reset
            </Button>
          </Grid>
          <Grid item md={2}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() =>
                exportToCSV(
                  slaBreaschesData,
                  {
                    bugId: "Bug ID",
                    title: "Title",
                    priority: "Priority",
                    startedAt: "Assigned at",
                    testedAt: "Tested at",
                    hoursTaken: "Hours taken",
                    allowedHours: "Allowed sla",
                  },
                  "sla_breaches"
                )
              }
            >
              Export CSV
            </Button>
          </Grid>
        </Grid>

        {slaLoading ? (
          <Box textAlign="center" mt={2}>
            <CircularProgress />
            <Typography mt={2}>loading SLA breaches</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={(slaBreaschesData || []).map((breach, index) => ({
              id: index,
              ...breach,
            }))}
            columns={[
              { field: "bugId", headerName: "Bug ID", flex: 1 },
              { field: "title", headerName: "Title", flex: 2 },
              { field: "priority", headerName: "Priority", flex: 1 },
              { field: "startedAt", headerName: "Assigned At", flex: 1 },
              { field: "testedAt", headerName: "Tested At", flex: 1 },
              { field: "hoursTaken", headerName: "Hours Taken", flex: 1 },
              {
                field: "allowedHours",
                headerName: "Allowed SLA (hrs)",
                flex: 1,
              },
            ]}
            autoHeight
          />
        )}
      </Box>
      <Box>
        <Typography variant="h6">5. Bug Status Overview</Typography>

        {statusLoading ? (
          <Box textAlign="center" mt={2}>
            <CircularProgress />
            <Typography mt={2}>loading bug status overview</Typography>
          </Box>
        ) : statusData && Object.keys(statusData).length > 0 ? (
          <>
            {statusData && Object.keys(statusData).length > 0 ? (
              <div style={{ width: "100%", height: "300px" }}>
                <PieChart width={500} height={380}>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    label={({ name }) => name}
                  >
                    {Object.entries(statusData).map((_, index) => (
                      <Cell
                        key={index}
                        fill={
                          [
                            "#8884d8",
                            "#82ca9d",
                            "#ffc658",
                            "#ff8042",
                            "#8dd1e1",
                            "#a4de6c",
                          ][index]
                        }
                      />
                    ))}
                  </Pie>
                </PieChart>
              </div>
            ) : (
              <Typography variant="body2">No data found</Typography>
            )}
            <Box mt={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1">Total Bugs</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {statusData?.total !== undefined ? statusData?.total : "-"}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box mt={4}>
              <Typography variant="subtitle1" gutterBottom>
                Bug Status Distribution Table
              </Typography>
              <DataGrid
                rows={Object.entries(statusData)
                  .filter(([status]) => status !== "total")
                  .map(([status, { count }], i) => ({
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
            </Box>

            <Box mt={2}>
              <Button
                variant="outlined"
                onClick={() =>
                  exportToCSV(
                    Object.entries(statusData || {})
                      .filter(([status]) => status !== "total")
                      .map(([status, { count }]) => ({
                        status,
                        count,
                      })),
                    {
                      status: "Status",
                      count: "Bug Count",
                    },
                    "bug_status_overview"
                  )
                }
              >
                Export CSV
              </Button>
            </Box>
          </>
        ) : (
          <Typography>No data found</Typography>
        )}
      </Box>
    </Box>
  );
};

export default TesterAnalytics;
