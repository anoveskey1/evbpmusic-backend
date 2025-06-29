const path = require('path');
const fs = require('fs');

async function signGuestbook(req, res) {
    const { username, message } = req.body;
      const filePath = path.join(__dirname, '../data', 'guestbook_entries.json');
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
}

module.exports = signGuestbook;