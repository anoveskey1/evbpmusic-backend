let visitorCount = 0;

function getVisitorCount(req, res) {
    visitorCount += 1;
    res.json({ count: visitorCount });
}

module.exports = getVisitorCount;