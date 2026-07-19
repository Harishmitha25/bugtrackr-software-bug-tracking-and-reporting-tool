import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Card,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import BugTrackRLogo from "../../assets/bugtrackr-logo.png";
import BugTrackRLogoNoName from "../../assets/bugtrackr-logo-no-name.png";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

const Login = () => {
  const [user, setUser] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const roleHierarchy = ["user", "developer", "tester", "teamlead", "admin"];

  //Validate email and password fields
  const validateField = (name, value) => {
    let error = "";
    if (name === "email") {
      if (!value) error = "Email is required";
      else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value))
        error = "Invalid email format. Eg: example@gmail.com";
    } else if (name === "password") {
      if (!value) error = "Password is required";
    }
    return error;
  };

  //Set user and error if any
  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  //Handle login button
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/auth/login`,
        user
      );
      console.log("Login Successful:", response.data);

      //Store user details, roles and token
      localStorage.setItem("loggedInUserEmail", response?.data?.email);
      localStorage.setItem("loggedInUserFullName", response?.data?.fullName);
      localStorage.setItem("roles", JSON.stringify(response?.data?.roles));
      localStorage.setItem("token", response?.data?.token);
      const primaryRole = getPrimaryRole(response?.data?.roles);
      localStorage.setItem("primaryRole", primaryRole);
      setMessage("Login successful!");
      toast.success("Login successful!", {
        position: "top-center",
        autoClose: 2000,
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error(
        "Error during login:",
        error.response?.data || error.message
      );
      setMessage(error.response?.data?.message || "Login failed");
    }
  };

  //Get the primary role of the logged in user of the app
  const getPrimaryRole = (roles) => {
    roles.sort(
      (a, b) => roleHierarchy.indexOf(b.role) - roleHierarchy.indexOf(a.role)
    );

    return roles.length > 0 ? roles[0].role : "user";
  };
  const isFormValid = () => {
    return (
      validateField("email", user.email) === "" &&
      validateField("password", user.password) === "" &&
      user.email.trim() !== "" &&
      user.password.trim() !== ""
    );
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/2 flex flex-col justify-center items-center bg-primary text-white p-10">
        <div className="flex justify-center">
          <img
            src={BugTrackRLogoNoName}
            alt="BugTrackR Logo"
            className="w-50 h-40"
          />
        </div>
        <h1 className="text-4xl font-bold">BugTrackR</h1>
        <p className="text-lg mt-3">
          Track, Report, Resolve - Software Bug Tracking and Reporting Tool
        </p>
      </div>

      <div className="w-1/2 flex justify-center items-center bg-gray-100">
        <Card elevation={3} className="p-8 shadow-lg w-full max-w-md">
          <div className="flex justify-center mb-4">
            <img
              src={BugTrackRLogo}
              alt="BugTrackR Logo"
              className="w-25 h-20"
            />
          </div>

          <h2 className="text-primary text-2xl font-bold text-center mb-5">
            Login
          </h2>

          {message && (
            <p
              className={`text-center text-sm mb-4 ${
                message.includes("successful")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <TextField
              fullWidth
              label="Email"
              name="email"
              value={user.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              required
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={user.password}
              onChange={handleChange}
              error={!!errors.password}
              helperText={errors.password}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {/* To view or hide entered password */}
                      <FontAwesomeIcon
                        icon={showPassword ? faEye : faEyeSlash}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className="py-2"
              disabled={!isFormValid()}
            >
              Login
            </Button>
          </form>

          <p className="text-center mt-4">
            <Link
              to="/forgot-password"
              className="text-primary hover:underline"
            >
              Forgot Password?
            </Link>
          </p>
        </Card>
      </div>
      <ToastContainer />
    </div>
  );
};

export default Login;
