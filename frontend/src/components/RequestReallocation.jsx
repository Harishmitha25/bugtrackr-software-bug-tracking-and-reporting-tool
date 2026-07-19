import React, { useState } from "react";
import axios from "axios";
import { Switch, TextField, Button } from "@mui/material";
import { toast } from "react-toastify";

const FIELD_LIMITS = {
  reallocationReason: { min: 10, max: 100 },
};

//To request reallocation of a bug
const RequestReallocation = ({
  bugId,
  isAlreadyRequseted,
  existingRequestReason,
  existingRequestStatus,
  onRequestReallocation,
}) => {
  const [isRequestingReallocation, setIsRequestingReallocation] =
    useState(isAlreadyRequseted);
  const [reallocationReason, setReallocationReason] = useState(
    existingRequestReason || ""
  );
  const [reasonError, setReasonError] = useState("");
  const token = localStorage.getItem("token");

  //Request reallocation toggle
  const handleToggleChange = (e) => {
    setIsRequestingReallocation(e.target.checked);
    if (!e.target.checked) {
      setReallocationReason("");
      setReasonError("");
    }
  };

  //Handle reason change and check limit
  const handleReasonChange = (e) => {
    const value = e.target.value;
    if (value.length <= FIELD_LIMITS.reallocationReason.max) {
      setReallocationReason(value);
      if (!value || value.length < FIELD_LIMITS.reallocationReason.min) {
        setReasonError(
          `Reason must be at least ${FIELD_LIMITS.reallocationReason.min} characters.`
        );
      } else {
        setReasonError("");
      }
    }
  };

  //Submit reallocation request
  const handleRequestReallocation = async () => {
    if (
      !reallocationReason.trim() ||
      reallocationReason.length < FIELD_LIMITS.reallocationReason.min
    ) {
      setReasonError(
        `Reason must be at least ${FIELD_LIMITS.reallocationReason.min} characters.`
      );
      return;
    }

    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/request-reallocation`,
        { bugId, reason: reallocationReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.message) {
        toast.success(response.data.message);

        if (onRequestReallocation) {
          onRequestReallocation(response.data?.bug?.reallocationRequests);
        }
        setIsRequestingReallocation(false);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to submit reallocation request"
      );
    }
  };

  return (
    <div className="mt-6">
      {!isAlreadyRequseted ? (
        <>
          <div className="flex items-center mb-2">
            <span className="font-semibold mr-2">Request Reallocation:</span>
            <Switch
              checked={isRequestingReallocation}
              onChange={handleToggleChange}
              color="primary"
            />
          </div>

          {isRequestingReallocation && (
            <div className="space-y-4">
              <TextField
                label={
                  <span>
                    Reason for Reallocation{" "}
                    <span className="text-red-500">*</span>
                  </span>
                }
                value={reallocationReason}
                onChange={handleReasonChange}
                fullWidth
                variant="outlined"
                multiline
                rows={3}
                error={!!reasonError}
                helperText={
                  reasonError ||
                  (reallocationReason.length <
                  FIELD_LIMITS.reallocationReason.min
                    ? `Reason must be at least ${FIELD_LIMITS.reallocationReason.min} characters.`
                    : reallocationReason.length >=
                      FIELD_LIMITS.reallocationReason.max - 10
                    ? `Max limit: ${
                        FIELD_LIMITS.reallocationReason.max
                      } characters (Remaining - ${
                        FIELD_LIMITS.reallocationReason.max -
                        reallocationReason.length
                      })`
                    : "")
                }
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleRequestReallocation}
                disabled={
                  reallocationReason.length <
                  FIELD_LIMITS.reallocationReason.min
                }
              >
                Submit Request
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <p>
            <strong>Reallocation Status:</strong>{" "}
            <span
              className={`${
                existingRequestStatus === "Pending"
                  ? "text-yellow-800 bg-yellow-100"
                  : existingRequestStatus === "Approved"
                  ? "text-green-800 bg-green-100"
                  : "text-red-800 bg-red-100"
              } px-3 py-1 rounded-lg`}
            >
              {existingRequestStatus}
            </span>
          </p>
          <p>
            <strong>Reason:</strong> {existingRequestReason}
          </p>
        </div>
      )}
    </div>
  );
};

export default RequestReallocation;
