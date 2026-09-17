require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const apiRouter = require('./routes/api');

const app = express();

/* ========================================================
   CORS
   ======================================================== */

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://wf-followup-dashboard.onrender.com'
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin
      // (Postman, server-to-server, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error('Not allowed by CORS')
      );
    },
    credentials: true
  })
);

/* ========================================================
   JSON
   ======================================================== */

app.use(express.json());

/* ========================================================
   API ROUTES
   ======================================================== */

app.use('/api', apiRouter);

/* ========================================================
   MONGODB + SERVER
   ======================================================== */

const PORT = process.env.PORT || 5000;

mongoose
  .connect(
    process.env.MONGODB_URI ||
      'mongodb://127.0.0.1:27017/wfFollowupDB'
  )
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `API running on port ${PORT}`
      );

      /* ====================================================
         FOLLOW-UP REMINDER SCHEDULER
         ==================================================== */

      const checkDueFollowUpReminders =
        apiRouter.checkDueFollowUpReminders;

      if (
        typeof checkDueFollowUpReminders ===
        'function'
      ) {
        // Check immediately when server starts
        checkDueFollowUpReminders();

        // Check every 30 seconds
        setInterval(
          checkDueFollowUpReminders,
          30000
        );

        console.log(
          'Follow-up reminder scheduler started.'
        );
      } else {
        console.error(
          'Follow-up reminder scheduler could not start.'
        );
      }
    });
  })
  .catch((error) => {
    console.error(
      'MongoDB connection error:',
      error
    );

    process.exit(1);
  });
