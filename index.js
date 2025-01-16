require("dotenv").config();
const nodemailer = require("nodemailer");
const axios = require("axios");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;

// Email configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// List of servers to monitor
const servers = [
  {
    name: "DMS Server",
    url: "https://dms.bzsconnect.com",
    isDown: false,
    lastNotified: null,
    consecutiveFailures: 0,
  },
  {
    name: "Moja Server",
    url: "https://moja.bzsconnect.com/",
    isDown: false,
    lastNotified: null,
    consecutiveFailures: 0,
  },
  {
    name: "Zatca Server",
    url: "https://zatca.bzsconnect.com",
    isDown: false,
    lastNotified: null,
    consecutiveFailures: 0,
  },
  {
    name: "Marriage Experts Server",
    url: "https://marriage.bzsconnect.com",
    isDown: false,
    lastNotified: null,
    consecutiveFailures: 0,
  },
  {
    name: "Quickdoc Api Server",
    url: "https://quickdoc-api.vercel.app",
    isDown: false,
    lastNotified: null,
    consecutiveFailures: 0,
  },
  {
    name: "Quickdoc Server",
    url: "https://quickdoc-server.vercel.app",
    isDown: false,
    lastNotified: null,
    consecutiveFailures: 0,
  },
];

// Enhanced notification function with HTML template
async function sendNotification(server, status, errorDetails = "") {
  const now = new Date();

  // Define status-specific styles and icons
  const statusColor = status === "DOWN" ? "#ff4444" : "#00C851";
  const statusIcon = status === "DOWN" ? "❌" : "✅";
  const statusMessage =
    status === "DOWN"
      ? "Your immediate attention is required. Please check the server."
      : "Server has recovered and is now working normally.";

  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Server Status Alert</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background-color: #2c3e50; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Server Status Alert</h1>
          <p style="margin: 10px 0 0 0;">${now.toLocaleString()}</p>
        </div>

        <!-- Status Card -->
        <div style="background-color: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <div style="background-color: ${statusColor}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">
              ${statusIcon} ${server.name} is ${status}
            </h2>
          </div>

          <!-- Server Details -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; width: 120px;"><strong>Server URL:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="${server.url
    }" style="color: #3498db;">${server.url}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: ${statusColor};">${status}</td>
            </tr>
            ${errorDetails
      ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Error Details:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #eee; color: #ff4444;">${errorDetails}</td>
            </tr>
            `
      : ""
    }
          </table>

          <!-- Message -->
          <div style="background-color: ${status === "DOWN" ? "#fff3cd" : "#d4edda"
    }; color: ${status === "DOWN" ? "#856404" : "#155724"
    }; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0;">${statusMessage}</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>This is an automated message from your Server Monitoring System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAILS, // Changed to support multiple recipients
    subject: `${status === "DOWN" ? "🚨" : "✅"} ${server.name} Status Alert`,
    html: htmlTemplate,
    // Include plain text version for email clients that don't support HTML
    text: `
ALERT: Server Status Change

Server Name: ${server.name}
Status: ${status}
Time: ${now.toLocaleString()}
URL: ${server.url}
${errorDetails ? `Error Details: ${errorDetails}` : ""}

${statusMessage}
`.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    server.lastNotified = now;
    console.log(`Alert email sent for ${server.name} - Status: ${status}`);
  } catch (error) {
    console.error(`Failed to send email for ${server.name}:`, error);
  }
}

// Simplified server checking function
async function checkServer(server) {
  try {
    const response = await axios.get(server.url, {
      timeout: 5000, // 5 second timeout
      validateStatus: false, // This means don't throw error for any status code
    });

    // Only consider status 200 as success
    if (response.status === 200) {
      console.log(`${server.name}: Response OK (200)`);
      if (server.isDown) {
        // Server was down but is now up - send recovery notification
        server.isDown = false;
        server.consecutiveFailures = 0;
        await sendNotification(server, "UP");
      }
      server.consecutiveFailures = 0;
    } else {
      throw new Error(`Server returned status ${response.status}`);
    }
  } catch (error) {
    // Handle any kind of error (timeout, connection refused, non-200 status)
    server.consecutiveFailures++;
    const errorMessage = error.response
      ? `HTTP status ${error.response.status}`
      : error.message;

    console.log(`${server.name}: Error - ${errorMessage}`);

    // If server wasn't marked as down before, mark it and send notification
    if (!server.isDown) {
      server.isDown = true;
      await sendNotification(server, "DOWN", errorMessage);
    }
  }

  // Log current status
  console.log(
    `${new Date().toLocaleString()} - ${server.name}: ${server.isDown ? "DOWN" : "UP"
    } - Failures: ${server.consecutiveFailures}`
  );
}

// Function to check all servers
async function monitorServers() {
  console.log("\nChecking all servers at:", new Date().toLocaleString());

  // Check each server independently
  for (const server of servers) {
    await checkServer(server);
  }
}

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    timestamp: new Date().toLocaleString(),
    servers: servers.map((server) => ({
      name: server.name,
      url: server.url,
      status: server.isDown ? "DOWN" : "UP",
      lastNotified: server.lastNotified?.toLocaleString(),
      consecutiveFailures: server.consecutiveFailures,
    })),
  });
});

// Start the monitoring
app.listen(PORT, () => {
  console.log(`Server monitor running on port ${PORT}`);

  // Do initial check immediately
  monitorServers();

  // Set the interval to 2 hours
  setInterval(monitorServers, 2 * 60 * 60 * 1000);
});
