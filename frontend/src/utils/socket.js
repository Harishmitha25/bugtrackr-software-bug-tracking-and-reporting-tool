//Create socket conenction with backend
import { io } from "socket.io-client";

const socket = io(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}`, {
  secure: true,
  reconnection: true,
  rejectUnauthorized: false,
});

export default socket;
