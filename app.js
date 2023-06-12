const express = require("express");
var bodyParser = require("body-parser");
var path = require('path');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"))

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/index.html'));
});

app.post('/submit-traveler-data', function(req, res) {
  
  const { lastName, firstName } = req.body;

  axios.get('https://httpbin.org/anything'
  ).then (res => {
    console.log(res);
  }).catch(err => {
    console.log(err);
  })

  console.log('receiving data ...');
  console.log('body is ',req.body);

  res.send(req.body);
});

app.listen(port, () => console.log(`Express app running on port ${port}!`));
