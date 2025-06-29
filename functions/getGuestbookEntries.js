const path = require('path');
const fs = require('fs');
const ErrorCodes = require('../error_codes.js');

async function getGuestbookEntries(req, res) {
    const filePath = path.join(__dirname, '../data', 'guestbook_entries.json');
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
};

module.exports = getGuestbookEntries;