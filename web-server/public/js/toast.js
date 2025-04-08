// toast.js
// Module to display toast notifications in place of alert dialogs.

/**
 * Displays a toast message.
 * @param {string} message - The message to display.
 * @param {number} duration - Duration of the toast in milliseconds (default 3000ms).
 */
export function showToast(message, duration = 3000) {
  // Get or create the toast container.
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.position = "fixed";
    container.style.bottom = "20px";
    container.style.left = "50%";
    container.style.transform = "translateX(-50%)";
    container.style.zIndex = "2000";
    document.body.appendChild(container);
  }

  // Create a new toast element.
  const toast = document.createElement("div");
  toast.textContent = message;
  // Style the toast.
  toast.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  toast.style.color = "#fff";
  toast.style.padding = "10px 20px";
  toast.style.marginTop = "10px";
  toast.style.borderRadius = "5px";
  toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  toast.style.fontSize = "14px";

  // Add the toast to the container.
  container.appendChild(toast);

  // Remove the toast after the specified duration.
  setTimeout(() => {
    toast.remove();
  }, duration);
}
