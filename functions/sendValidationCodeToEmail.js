const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ErrorCodes = require('../error_codes.js');

async function sendValidationCodeToEmail(request, response) {
  const hashCode = crypto.randomBytes(Math.ceil(42 / 2)).toString('hex').slice(0, 42);
  const filePath = path.join(__dirname, '../data', 'guestbook_users.json');
  const { email, username } = request.body;
  let userData = {};

  if (!email || !username) {
    return response
    .status(400)
    .json({ 
      error: 'Missing required fields.' 
    });
  }

  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    if (rawData.trim().length > 0) {
      userData = JSON.parse(rawData);
    }
  }

  const userAlreadyExists = Object.values(userData).some(user => user.email === email || user.username === username);

  if (userAlreadyExists) {
    return response
    .status(400)
    .json({ 
      code: ErrorCodes.USER_ALREADY_EXISTS, 
      message: 'Everybody gets one. If you feel you have reached this message in error, please contact us - include your email and username - and we\'ll see what we can do to help!' 
    });
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

  response
  .json({ 
    message: 'A validation code has been sent to the email address you provided. Please enter it into the validation code input field to continue.' 
  });
}

module.exports = sendValidationCodeToEmail;