import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { useRef } from "react";
const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordMatchMessage, setPasswordMatchMessage] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [resendTimer, setResendTimer] = useState(30);
  const [isResendDisabled, setIsResendDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const resendTimerRef = useRef(null);
  const navigate = useNavigate();

  //Timer for messages to be shown only for 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  //To control the resend timer
  const startResendTimer = () => {
    setIsResendDisabled(true);
    let timeLeft = 30;
    setResendTimer(timeLeft);

    //Clear the existing timer before starting a new on (if method called multiple times)
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
    }
    //Store interval in ref

    resendTimerRef.current = setInterval(() => {
      timeLeft -= 1;
      setResendTimer(timeLeft);

      if (timeLeft === 0) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
        setIsResendDisabled(false);
      }
    }, 1000);
  };
  //Validate email to adhere to standard
  const validateEmail = (email) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  };

  //Validate password to adhere to standard
  const validatePassword = (password) => {
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  };

  //Check password validity
  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setNewPassword(password);

    if (!validatePassword(password)) {
      setPasswordMessage(
        "Password must be at least 8 characters, include one uppercase, one lowercase, one number, and one special character."
      );
    } else {
      setPasswordMessage("");
    }
    if (confirmPassword && password !== confirmPassword) {
      setPasswordMatchMessage("Passwords do not match.");
    } else {
      setPasswordMatchMessage("");
    }
  };

  //Set confirm password
  const handleConfirmPasswordChange = (e) => {
    const confirmPwd = e.target.value;
    setConfirmPassword(confirmPwd);

    if (newPassword && confirmPwd !== newPassword) {
      setPasswordMatchMessage("Passwords do not match.");
    } else {
      setPasswordMatchMessage("");
    }
  };

  //To check email standard
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    if (value === "") {
      setMessage("Email is required.");
      setMessageType("error");
    } else if (!validateEmail(value)) {
      setMessage("Invalid email format. Eg: example@gmail.com");
      setMessageType("error");
    } else {
      setMessage("");
    }
  };

  //Send OTP to the email provided
  const sendOtp = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/auth/send-otp`,
        { email }
      );

      setStep(2);
      setMessage(response.data.message || "OTP has been sent to your email.");
      setMessageType("neutral");
      startResendTimer();
    } catch (error) {
      if (
        error.response &&
        error.response.data &&
        error.response.data.message
      ) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Error sending OTP. Please try again.");
      }
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  //Verify OTP
  const verifyOtp = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/auth/verify-otp`,
        { email, otp }
      );
      if (response.data.success) {
        setStep(3);
        setMessage("OTP verified successfully! Set your new password.");
        setMessageType("success");
      } else {
        setMessage("Invalid OTP.");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Invalid OTP.");
      setMessageType("error");
    }
  };

  //Save the new password in the databases
  const resetPassword = async () => {
    if (!validatePassword(newPassword)) {
      setMessage("Invalid password. Please follow the password rules.");
      setMessageType("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/auth/reset-password`, {
        email,
        newPassword,
      });
      toast.success("Password reset successful! Redirecting to login...", {
        position: "top-center",
        autoClose: 3000,
      });

      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      if (
        error.response &&
        error.response.data &&
        error.response.data.message
      ) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Error resetting password. Please try again.");
      }
      setMessageType("error");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <h2 className="mb-6 text-2xl font-bold text-center text-gray-800">
          Forgot Password
        </h2>

        {message && (
          <p
            className={`mb-4 text-center ${
              messageType === "success"
                ? "text-green-600"
                : messageType === "error"
                ? "text-red-600"
                : "text-blue-600"
            }`}
          >
            {message}
          </p>
        )}

        {step === 1 && (
          <div>
            <label className="block mb-2 text-gray-600">Enter your email</label>
            <input
              type="email"
              className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-md"
              placeholder="Email"
              value={email}
              onChange={handleEmailChange}
            />
            <div className="flex justify-between">
              <button
                onClick={sendOtp}
                className={`px-4 py-2 text-white rounded-md ${
                  validateEmail(email) && !loading
                    ? "bg-primary"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
                disabled={!validateEmail(email) && !loading}
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <input
              type="text"
              className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />

            <div className="flex justify-between">
              <button
                onClick={verifyOtp}
                className="w-full px-4 py-2 font-bold text-white bg-green-500 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                Verify OTP
              </button>
            </div>

            <div className="flex justify-between mt-2">
              <button
                onClick={sendOtp}
                disabled={isResendDisabled || loading}
                className={`px-4 py-2 font-bold text-white rounded-md ${
                  isResendDisabled || loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gray-600 hover:bg-gray-700"
                } focus:outline-none`}
              >
                {loading
                  ? "Resending..."
                  : isResendDisabled
                  ? `Resend OTP in ${resendTimer}s`
                  : "Resend OTP"}
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <label className="block mb-2 text-gray-600">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-md"
                placeholder="Enter new password"
                value={newPassword}
                onChange={handlePasswordChange}
              />
              <FontAwesomeIcon
                icon={showNewPassword ? faEye : faEyeSlash}
                className="absolute right-3 top-3 cursor-pointer"
                onClick={() => setShowNewPassword(!showNewPassword)}
              />
              <p
                className={`mb-2 text-sm ${
                  passwordMessage.includes("match")
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {passwordMessage}
              </p>
            </div>

            <label className="block mb-2 text-gray-600">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-md"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
              />
              <FontAwesomeIcon
                icon={showConfirmPassword ? faEye : faEyeSlash}
                className="absolute right-3 top-3 cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              />
              <p
                className={`text-sm ${
                  passwordMatchMessage ? "text-red-600" : ""
                }`}
              >
                {passwordMatchMessage}
              </p>
            </div>

            <div className="flex justify-between mt-4">
              <button
                onClick={resetPassword}
                className={`px-4 py-2 text-white rounded-md ${
                  validatePassword(newPassword) &&
                  newPassword === confirmPassword
                    ? "bg-primary cursor-pointer"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
                disabled={
                  !validatePassword(newPassword) ||
                  newPassword !== confirmPassword
                }
              >
                Reset Password
              </button>

              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 font-bold text-white bg-red-500 rounded-md hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
};

export default ForgotPassword;
