require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const https = require("https");
const http = require("http");
const app = express();
const path = require("path");
const { Server } = require("socket.io");
const { runUnassignedBugAlertJob } = require("./cron/unassignedTeamAlertJob");
const { runNoStatusAlertJob } = require("./cron/noStatusUpdateAlertJob");
const {
  runCriticalBugClosureAlertJob,
} = require("./cron/criticalBugClosureAlerJob");
const { runAutoAssignRetryJob } = require("./cron/autoAssignRetryJob");
const {
  runAutoAssignTesterRetryJob,
} = require("./cron/autoAssignTeseterRetryJob");

app.use(cors());
app.use(bodyParser.json());

const useLocalHttps = fs.existsSync(path.join(__dirname, "certs"));
const options = useLocalHttps
  ? {
      key: fs.readFileSync("certs/localhost+1-key.pem"),
      cert: fs.readFileSync("certs/localhost+1.pem"),
    }
  : null;

//MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    //MONDGO_URI in dotenv
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const bugReportsRoutes = require("./routes/bugReportRoutes");
app.use("/api/bug-reports", bugReportsRoutes);

const issueTypesRoutes = require("./routes/issueTypesRoutes");
app.use("/api/issue-types", issueTypesRoutes);

const applicationRoutes = require("./routes/applicationRoutes");
app.use("/api/applications", applicationRoutes);

const developerRoutes = require("./routes/developerRoutes");
app.use("/api/developers", developerRoutes);

const testerRoutes = require("./routes/testersRoutes");
app.use("/api/testers", testerRoutes);
const commentRoutes = require("./routes/commentRoutes");
app.use("/api/comments", commentRoutes);

app.use("/attachments", express.static(path.join(__dirname, "uploads")));
const chatRoutes = require("./routes/chatRoutes");
app.use("/api/chat", chatRoutes);

const analyticsRoutes = require("./routes/analyticsRoutes");
app.use("/api/analytics", analyticsRoutes);

const favouritesRoutes = require("./routes/favouriteRoutes");
app.use("/api/favourites", favouritesRoutes);

//Start Server
const PORT = process.env.PORT || 5000;

//Use HTTPS locally with mkcert certs, plain HTTP otherwise
const server = useLocalHttps
  ? https.createServer(options, app)
  : http.createServer(app);

//Create socket server with CORS config (only frontend is allowed)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://localhost:3000",
    methods: ["GET", "POST"],
  },
});

//Listener for connection from frontend
io.on("connection", (socket) => {
  console.log("conneted");

  //Listener when a user joins the bug chat room
  socket.on("join_bug_room", (bugId) => {
    socket.join(`bug_${bugId}`);
  });

  //Listener when a user sends a message in the bug chat room and broadcast the message to all users in thechat room
  socket.on("send_message", ({ bugId, message }) => {
    io.to(`bug_${bugId}`).emit("receive_message", message);
  });

  //Listener when a user disconnects from the bug chat room
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

//Run scheduled Cron jobs to check for unassigned bugs, bugs with no update, critical bug closure, retry auto assignment of developer and tester
runUnassignedBugAlertJob();
runNoStatusAlertJob();
runCriticalBugClosureAlertJob();
runAutoAssignRetryJob();
runAutoAssignTesterRetryJob();

server.listen(PORT, () => {
  const protocol = useLocalHttps ? "https" : "http";
  console.log(`Server running with socket on ${protocol}://localhost:${PORT}`);
});
