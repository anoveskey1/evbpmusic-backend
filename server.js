require('dotenv').config();
require('isomorphic-fetch');

const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');
const ErrorCodes = require('./error_codes.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');

const app = express();
const port = 3000;

const isDevelopment = process.env.NODE_ENV === 'development';

let visitorCount = 0;

const allowedOrigins = [process.env.ALLOWED_ORIGIN];

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

app.get('/', (req, res) => {
  res.send('There is nothing to see here. Perhaps you meant to visit the frontend?');
});

app.get('/api/guestbook-entries', (req, res) => {
  const filePath = path.join(__dirname, 'guestbook_entries.json');
  let entries = [];

  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    if (rawData.trim().length > 0) {
      entries = JSON.parse(rawData);
    }
  }

  if (entries.length === 0) {
    return res.status(404).json({ code: ErrorCodes.DATA_UNAVAILABLE, message: 'No guestbook entries found.' });
  } else {
    res.status(200).json(entries);
  }
});

app.get('/api/visitor-count', (req, res) => {
    visitorCount += 1;
    res.json({ count: visitorCount });
})

app.post('/api/send-email', async (req, res) => {
  const { email, message, subject } = req.body;

  if (!email || !message || !subject) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const credential = new ClientSecretCredential(
      process.env.OAUTH_TENANT_ID,
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET
    );

    const tokenResponse = await credential.getToken(process.env.GRAPH_TOKEN_URL);

    const graphClient = Client.init({
      authProvider: (done) => {
        done(null, tokenResponse.token);
      }
    });

    await graphClient.api('/users/' + process.env.EMAIL_SENDER + '/sendMail')
    .post({
      message: {
        body: {
          contentType: 'Text',
          content: message
        },
        replyTo: [
          {
            emailAddress: {
              address: email
            }
          }
        ],
        subject: subject,
        toRecipients: [
          {
            emailAddress: {
              address: process.env.EMAIL_RECIPIENT
            }
          }
        ]
      }
    });

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/send-validation-code-to-email', async (req, res) => {
  const hashCode = crypto.randomBytes(Math.ceil(42 / 2)).toString('hex').slice(0, 42);
  const filePath = path.join(__dirname, 'guestbook_users.json');
  const { email, username } = req.body;
  let userData = {};
  
  if (!email || !username) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    if (rawData.trim().length > 0) {
      userData = JSON.parse(rawData);
    }
  }

  const userAlreadyExists = Object.values(userData).some(user => user.email === email || user.username === username);

  if (userAlreadyExists) {
    return res.status(400).json({ code: ErrorCodes.USER_ALREADY_EXISTS, message: 'Everybody gets one. If you feel you have reached this message in error, please contact us - include your email and username - and we\'ll see what we can do to help!' });
  } else {
    userData[hashCode] = { username, email };
    fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
  }
  
  // send email with validation code
  const messageContent = `Hello ${username},\n\nYour validation code is: ${hashCode}\n\nPlease copy and paste it into the validation code field on the guestbook page to continue signing the guestbook!`;
  const messageSubject = 'Validation Code for ' + username;
  const credential = new ClientSecretCredential(
      process.env.OAUTH_TENANT_ID,
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET
  );
  const tokenResponse = await credential.getToken(process.env.GRAPH_TOKEN_URL);
  const graphClient = Client.init({
    authProvider: (done) => {
      done(null, tokenResponse.token);
    }
  });

  await graphClient.api('/users/' + process.env.EMAIL_SENDER + '/sendMail')
  .post({
    message: {
      body: {
        contentType: 'Text',
        content: messageContent
      },
      subject: messageSubject,
      toRecipients: [
        {
          emailAddress: {
            address: email
          }
        }
      ],
    }
  })

  res.json({ message: 'A validation code has been sent to the email address you provided. Please enter it into the validation code input field to continue.' });
});

app.post('/api/sign-guestbook', async (req, res) => {
  const { username, message } = req.body;
  const filePath = path.join(__dirname, 'guestbook_entries.json');
  let guestbookEntries = [];
  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    if (rawData.trim().length > 0) {
      guestbookEntries = JSON.parse(rawData);
    }
  }

  guestbookEntries.push({ username, message });

  fs.writeFileSync(filePath, JSON.stringify(guestbookEntries, null, 2));

  res.status(201).json({ message: 'Thanks for signing my guestbook. You rock!' });
});

app.post('/api/validate-user', async (req, res) => {
  const { validationCode } = req.body;

  const filePath = path.join(__dirname, 'guestbook_users.json');
  let userData = {};

  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    if (rawData.trim().length > 0) {
      userData = JSON.parse(rawData);
    }
  }

  if (userData[validationCode]) {
    res.status(200).json({ message: 'User validation successful. You can now sign the guestbook!', user: userData[validationCode] });
  } else {
    res.status(401).json({ code: ErrorCodes.USER_ENTRY_NOT_FOUND, message: 'User entry not found. Please contact the site admin.' });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;