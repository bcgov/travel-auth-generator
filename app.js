const express = require("express");
var bodyParser = require("body-parser");
var path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"))

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/index.html'));
});

app.post('/sample/put/data', function(req, res) {
  console.log('receiving data ...');
  console.log('body is ',req.body);
  res.send(req.body);
});

app.listen(port, () => console.log(`Express app running on port ${port}!`));
