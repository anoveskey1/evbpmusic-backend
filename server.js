require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const app = express();
const port = 3000;

const isDevelopment = process.env.NODE_ENV === 'development';

let visitorCount = 0;

const allowedOrigins = ["http://localhost:5173", "http://evbpmusic.com", "https://evbpmusic.com"];

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

    const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");

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

app.get('/api/visitor-count', (req, res) => {
    visitorCount += 1;
    res.json({ count: visitorCount });
})

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;