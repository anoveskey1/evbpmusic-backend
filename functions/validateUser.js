const fs = require('fs');
const path = require('path');
const ErrorCodes = require('../error_codes.js');

async function validateUser(request, response) {
  const { validationCode } = request.body;
  const filePath = path.join(__dirname, '../data', 'guestbook_users.json');
  let userData = {};

  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath, 'utf8');
    
    if (rawData.trim().length > 0) {
      userData = JSON.parse(rawData);
    }
  }

  if (userData[validationCode]) {
    response
    .status(200)
    .json({ 
      message: 'User validation successful. You can now sign the guestbook!', 
      user: userData[validationCode] 
    });
  } else {
    response
    .status(401)
    .json({ 
      code: ErrorCodes.USER_ENTRY_NOT_FOUND, 
      message: 'User entry not found. Please contact the site admin.' 
    });
  }
}

module.exports = validateUser;