require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const nodemailer = require('nodemailer');

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

app.post('/api/send-email', (req, res) => {
  const { email, message, subject } = req.body;

  if (!email || !message || !subject) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: !isDevelopment // Disable TLS certificate validation in development
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    replyTo: email,
    subject: subject,
    text: message,
    to: process.env.EMAIL_RECIPIENT
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    console.log('Email sent:', info.response);
    res.json({ message: 'Email sent successfully' });
  });
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