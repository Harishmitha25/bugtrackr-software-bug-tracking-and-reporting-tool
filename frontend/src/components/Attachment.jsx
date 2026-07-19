import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilePdf,
  faFileWord,
  faFileExcel,
  faFileImage,
  faFileAlt,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";

const Attachment = ({ fileName }) => {
  const attachmentUrl = `${process.env.REACT_APP_API_URL || "https://localhost:5000"}/attachments/${fileName}`; // Statically served attachments in backend
  const fileExt = fileName.split(".").pop().toLowerCase();

  // Get actual file name (remove the number added in the front)
  const actualFileNAme = fileName.includes("-")
    ? fileName.substring(fileName.indexOf("-") + 1)
    : fileName;

  //get the correct icon based on file type
  const getFileIcon = () => {
    if (["jpg", "jpeg", "png", "gif"].includes(fileExt))
      return (
        <FontAwesomeIcon icon={faFileImage} className="text-blue-500 w-6 h-6" />
      );
    if (fileExt === "pdf")
      return (
        <FontAwesomeIcon icon={faFilePdf} className="text-red-500 w-6 h-6" />
      );
    if (["doc", "docx"].includes(fileExt))
      return (
        <FontAwesomeIcon icon={faFileWord} className="text-blue-700 w-6 h-6" />
      );
    if (["xls", "xlsx"].includes(fileExt))
      return (
        <FontAwesomeIcon
          icon={faFileExcel}
          className="text-green-600 w-6 h-6"
        />
      );
    return (
      <FontAwesomeIcon icon={faFileAlt} className="text-gray-500 w-6 h-6" />
    );
  };

  //Open the file in a new tab when download button is clicked
  const handleOpenInNewTab = (event) => {
    event.preventDefault();
    window.open(attachmentUrl, "_blank");
  };

  return (
    <div className="flex items-center justify-between border rounded-md p-3 mb-2 bg-gray-50 shadow-sm w-full">
      <div className="flex items-center space-x-3">
        {/* If its an image show preview else show an icon */}
        {["jpg", "jpeg", "png", "gif"].includes(fileExt) ? (
          <img
            src={attachmentUrl}
            alt="Preview"
            className="w-10 h-10 object-cover rounded-md shadow"
          />
        ) : (
          getFileIcon()
        )}
        <span className="text-gray-800 font-medium truncate w-40">
          {actualFileNAme}
        </span>
      </div>

      <button
        onClick={handleOpenInNewTab}
        className="text-primary hover:text-blue-800"
      >
        <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Attachment;
