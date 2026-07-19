import React, { useState, useEffect } from "react";
import axios from "axios";
import { Switch, TextField, Button } from "@mui/material";
import { toast } from "react-toastify";
import { isValidBugIdFormat } from "../utils/Validation";
const FIELD_LIMITS = {
  explanation: { min: 10, max: 100 },
};

//To mark a bug report as duplicate
const MarkAsDuplicate = ({
  bugId,
  isAlreadyDuplicate,
  existingoriginalBugId,
  existingExplanation,
  onMarkedDuplicate,
}) => {
  console.log(isAlreadyDuplicate);
  const [isDuplicate, setIsDuplicate] = useState(isAlreadyDuplicate);
  const [isDuplicateConfirmed, setIsDuplicateConfirmed] =
    useState(isAlreadyDuplicate);
  const [originalBugId, setOriginalBugId] = useState(
    existingoriginalBugId || ""
  );
  const [duplicateExplanation, setDuplicateExplanation] = useState(
    existingExplanation || ""
  );
  const [originalBugIdError, setOriginalBugIdError] = useState("");
  const [explanationError, setExplanationError] = useState("");
  const token = localStorage.getItem("token");

  //Mark or undo duplciate toggle
  const handleToggleChange = (event) => {
    setIsDuplicate(event.target.checked);
    if (!event.target.checked) {
      setOriginalBugId("");
      setDuplicateExplanation("");
      setOriginalBugIdError("");
      setExplanationError("");
    }
  };

  //Check for valdiity of bug id entered
  const handleTextChange = (e) => {
    const value = e.target.value.trim();
    if (value === "" || isValidBugIdFormat(value)) {
      setOriginalBugId(value);
      setOriginalBugIdError("");
    } else {
      setOriginalBugId(value);
      setOriginalBugIdError(
        "Original bug ud must be in the format 'BUG-number' (eg: BUG-1)"
      );
    }
  };

  //Check for explanation availability
  const handleExplanationChange = (e) => {
    const value = e.target.value;
    if (value.length <= FIELD_LIMITS.explanation.max) {
      setDuplicateExplanation(value);
      if (!value || value.length < FIELD_LIMITS.explanation.min) {
        setExplanationError(
          `Explanation must be at least ${FIELD_LIMITS.explanation.min} characters.`
        );
      } else {
        setExplanationError("");
      }
    }
  };

  //Mark bug report as duplicate after checking of availability of bug if and explanation
  const handleMarkDuplicate = async () => {
    if (
      !originalBugId.trim() ||
      !duplicateExplanation.trim() ||
      duplicateExplanation.trim().length < FIELD_LIMITS.explanation.min
    ) {
      if (!originalBugId.trim())
        setOriginalBugIdError("Original bug id is required.");
      if (
        !duplicateExplanation.trim() ||
        duplicateExplanation.trim().length < FIELD_LIMITS.explanation.min
      )
        setExplanationError(
          `Explanation must be at least ${FIELD_LIMITS.explanation.min} characters.`
        );
      return;
    }

    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/mark-duplicate`,
        { bugId, originalBugId, duplicateExplanation },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.bug) {
        toast.success(response.data.message);
        setIsDuplicateConfirmed(true);
        setIsDuplicate(false);
        if (onMarkedDuplicate) {
          onMarkedDuplicate(
            response.data.bug.status,
            response.data.bug.originalBugId,
            response.data.bug.duplicateExplanation
          );
        }
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to mark as duplicate."
      );
    }
  };

  //Undo duplicate on bug report
  const handleUndoDuplicate = async () => {
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/api/bug-reports/undo-duplicate`,
        { bugId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.message) {
        toast.success(response.data.message);
        setIsDuplicateConfirmed(false);
        setIsDuplicate(false);
        setOriginalBugId("");
        setDuplicateExplanation("");
        if (onMarkedDuplicate) {
          onMarkedDuplicate(
            response.data.bug.status,
            response.data.bug.originalBugId,
            response.data.bug.duplicateExplanation
          );
        }
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to undo duplicate status."
      );
    }
  };

  return (
    <div className="mt-6">
      {!isDuplicateConfirmed ? (
        <>
          <div className="flex items-center mb-2">
            <span className="font-semibold mr-2">Mark as Duplicate:</span>
            <Switch
              checked={isDuplicate}
              onChange={handleToggleChange}
              color="primary"
            />
          </div>

          {isDuplicate && (
            <div className="space-y-4">
              <TextField
                label={
                  <span>
                    Original Bug ID <span className="text-red-500">*</span>
                  </span>
                }
                value={originalBugId}
                onChange={handleTextChange}
                fullWidth
                variant="outlined"
                error={!!originalBugIdError}
                helperText={
                  originalBugIdError && (
                    <span className="text-red-500">{originalBugIdError}</span>
                  )
                }
              />
              <TextField
                label={
                  <span>
                    Explanation <span className="text-red-500">*</span>
                  </span>
                }
                value={duplicateExplanation}
                onChange={handleExplanationChange}
                fullWidth
                variant="outlined"
                multiline
                rows={3}
                error={!!explanationError}
                helperText={
                  explanationError ||
                  (duplicateExplanation.length < FIELD_LIMITS.explanation.min
                    ? `Explanation must be at least ${FIELD_LIMITS.explanation.min} characters.`
                    : duplicateExplanation.length >=
                      FIELD_LIMITS.explanation.max - 10
                    ? `Max limit: ${
                        FIELD_LIMITS.explanation.max
                      } characters (Remaining - ${
                        FIELD_LIMITS.explanation.max -
                        duplicateExplanation.length
                      })`
                    : "")
                }
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleMarkDuplicate}
              >
                Mark as Duplicate
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <p>
            <strong>Marked as Duplicate of:</strong>{" "}
            {existingoriginalBugId || originalBugId}
          </p>
          <p>
            <strong>Explanation:</strong>{" "}
            {existingExplanation || duplicateExplanation}
          </p>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleUndoDuplicate}
          >
            Undo Duplicate
          </Button>
        </div>
      )}
    </div>
  );
};

export default MarkAsDuplicate;
