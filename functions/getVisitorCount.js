let visitorCount = 0;

function getVisitorCount(request, response) {
    visitorCount += 1;
    response.json({ count: visitorCount });
}

module.exports = getVisitorCount;