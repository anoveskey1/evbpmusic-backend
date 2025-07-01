require('dotenv').config();
require('isomorphic-fetch');

const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');

const getGuestbookEntries = require('./functions/getGuestbookEntries.js');
const getVisitorCount = require('./functions/getVisitorCount.js');
const rootHandler = require('./functions/rootHandler.js');
const sendValidationCodeToEmail = require('./functions/sendValidationCodeToEmail.js');
const sendEmail = require('./functions/sendEmail.js');
const signGuestbook = require('./functions/signGuestbook.js');
const validateUser = require('./functions/validateUser.js');

const app = express();
const port = process.env.LISTENING_PORT;
const allowedOrigins = [process.env.ALLOWED_ORIGINS];

app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', rootHandler);
app.get('/api/guestbook-entries', getGuestbookEntries);
app.get('/api/visitor-count', getVisitorCount);
app.post('/api/send-email', sendEmail);
app.post('/api/send-validation-code-to-email', sendValidationCodeToEmail);
app.post('/api/sign-guestbook', signGuestbook);
app.post('/api/validate-user', validateUser);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;