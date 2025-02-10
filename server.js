const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

let visitorCount = 0;

const allowedOrigins = ["http://localhost:5173"];

app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/visitor-count', (req, res) => {
    visitorCount += 1;
    res.json({ count: visitorCount });
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });