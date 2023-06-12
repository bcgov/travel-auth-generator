// Router developer guide: https://bcgov.github.io/ols-router/router-developer-guide.html

require("dotenv").config();

const express = require("express");
var bodyParser = require("body-parser");
var path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const RP_KEY = process.env.ROUTE_PLANNER_API_KEY;
const RP_URL = process.env.ROUTE_PLANNER_BASE_URL;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "/index.html"));
});

app.post("/submit-traveler-data", function (req, res) {
  // const { lastName, firstName } = req.body;
  // console.log("receiving data ...");
  // console.log("body is ", req.body);

  const config = {
    headers: {
      apikey: RP_KEY,
    },
  };

  axios
    .get(RP_URL, config)
    .then((res) => console.log(res))
    .catch((err) => console.log(err));

  // axios
  //   .get("https://httpbin.org/anything")
  //   .then((res) => {
  //     console.log(res);
  //   })
  //   .catch((err) => {
  //     console.log(err);
  //   });

  res.send(req.body);
});

app.listen(PORT, () => console.log(`Express app running on port ${PORT}!`));
