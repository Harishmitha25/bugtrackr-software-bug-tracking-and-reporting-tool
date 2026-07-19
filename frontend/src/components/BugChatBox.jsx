//Chat UI implemented using ChatScope chat UI kit react
//https://github.com/chatscope/chat-ui-kit-react?tab=readme-ov-file

//Reason for issue - ChatScope chat UI kit react uses contenteditable on div (which lets div act as input box - to allow emojis, links, font styling)
//in MessageInput component. The browser converst the characters like < > & space etc., as HTML entities like &nbsp;

//Fix for HTML entities showing in chat message - https://stackoverflow.com/questions/5796718/html-entity-decode
import { useState, useEffect } from "react";
import axios from "axios";
import socket from "../utils/socket";
import {
  ChatContainer,
  ConversationHeader,
  MessageList,
  Message,
  MessageInput,
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { Avatar } from "@mui/material";
import { Fab } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

//Bug Chat box
const BugChatBox = ({ bugId, currentUser }) => {
  const [messages, setMEssages] = useState([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  //Join bug specific chat room and load previous messages
  useEffect(() => {
    socket.emit("join_bug_room", bugId);

    axios
      .get(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/chat/${bugId}/messages`)
      .then((res) => setMEssages(res.data))
      .catch((err) => console.error("Chat fetch failed", err));
  }, [bugId]);

  //Listen for incoming messages
  useEffect(() => {
    socket.on("receive_message", (msg) => {
      setMEssages((prev) => [...prev, msg]);
    });

    return () => socket.off("receive_message");
  }, []);

  //Send a new message
  const sendMessage = async () => {
    const newMessage = {
      sender: {
        email: currentUser.email,
        name: currentUser.fullName,
        role: currentUser.role,
      },
      message: input,
    };

    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/chat/${bugId}/send`,
        newMessage
      );
      socket.emit("send_message", {
        bugId,
        message: { ...newMessage, timestamp: new Date() },
      });
      setInput("");
    } catch (err) {
      console.error("Message send failed", err);
    }
  };

  //Get initials of the user
  const getInitials = (name) => {
    if (!name) return "NA";
    const parts = name.trim().split(" ");
    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }
    return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
  };

  //To format time shown in the message
  const formatTime = (timestamp) => {
    const now = dayjs();
    const time = dayjs(timestamp);

    if (now.diff(time, "day") >= 1) {
      return time.format("DD MMM, hh:mm A");
    } else {
      return time.fromNow();
    }
  };

  //To convert the HTML entities
  function convertHTMLEntities(str) {
    //Create an input element and pass the value to the innerHTML which the browser converts back to characters
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  }

  return (
    <>
      <Fab
        onClick={() => setOpen((prev) => !prev)}
        color="primary"
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 3000,
          "&:hover": {
            bgcolor: "#0c223d",
          },
        }}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </Fab>

      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            right: 24,
            width: 350,
            height: 500,
            borderRadius: 8,
            overflow: "hidden",
            zIndex: 1400,
            backgroundColor: "#fff",
          }}
        >
          <ChatContainer>
            <ConversationHeader>
              <ConversationHeader.Content
                userName="Bug Chat"
                info={`Bug ID: ${bugId}`}
              />
            </ConversationHeader>

            <MessageList>
              {messages.map((msg, i) => (
                <Message
                  key={i}
                  model={{
                    direction:
                      msg.sender?.email === currentUser.email
                        ? "outgoing"
                        : "incoming",
                  }}
                >
                  <Message.CustomContent>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: 4,
                      }}
                    >
                      <Avatar
                        sx={{ width: 28, height: 28, fontSize: "0.8rem" }}
                      >
                        {getInitials(msg.sender?.name)}
                      </Avatar>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.8rem",
                            marginBottom: "2px",
                          }}
                        >
                          <span style={{ fontWeight: "bold" }}>
                            {msg.sender?.email === currentUser.email
                              ? "You"
                              : msg.sender?.name || msg.sender?.email}
                          </span>
                          <span style={{ color: "#666" }}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.9rem" }}>
                          {convertHTMLEntities(msg.message)}
                        </div>
                      </div>
                    </div>
                  </Message.CustomContent>
                </Message>
              ))}
            </MessageList>

            <MessageInput
              placeholder="Type your message..."
              value={input}
              onChange={(val) => setInput(val.trim())}
              onSend={sendMessage}
              attachButton={false}
              sendButton={true}
            />
          </ChatContainer>
        </div>
      )}
    </>
  );
};

export default BugChatBox;
