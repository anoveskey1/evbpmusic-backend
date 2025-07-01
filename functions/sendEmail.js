const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');

async function sendEmail(request, response) {
  const { email, message, subject } = request.body;

  if (!email || !message || !subject) {
    return response.status(400).json({ error: 'Missing required fields.' });
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

    response.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    response.status(500).json({ error: 'Failed to send email' });
  }
}

module.exports = sendEmail;