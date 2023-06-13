// Router planner developer guide: https://bcgov.github.io/ols-router/router-developer-guide.html
// RP Swagger: https://petstore.swagger.io/?url=https://raw.githubusercontent.com/bcgov/api-specs/master/router/router.json

require("dotenv").config();

// params = {
//   hello: "hello world!!@#"
// }
// const test = new URLSearchParams(params).toString()

// console.log(test);

const express = require("express");
var bodyParser = require("body-parser");
var path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const RP_KEY = process.env.ROUTE_PLANNER_API_KEY;
const RP_URL = "https://router.api.gov.bc.ca";
const GC_URL = "https://apps.gov.bc.ca/pub/geocoder";

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

function sendRequest(url, method = "get", params = {}, config = {}, data = {}) {
  if (params) {
    url += `?${new URLSearchParams(params).toString()}`;
  }

  if (method === "get") {
    return axios
      .get(url, config)
      .then((res) => res.data)
      .catch((err) => {
        console.error("Error fetching data: ", err);
        throw err;
      });
  } else if (method === "post") {
    return axios
      .post(url, data, config)
      .then((res) => res.data)
      .catch((err) => {
        console.error("Error posting data: ", err);
        throw err;
      });
  }
}

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "/index.html"));
});

app.post("/submit-traveler-data", function (req, res) {
  // console.log("receiving data ...");
  // console.log("body is ", req.body);

  // TODO: using geocoder, get coordinates of starting pos

  // const { startingPos, destination } = req.body;

  const startPosParams = {
    addressString: "824 Gillett Street, Prince George, BC",
    locationDescriptor: "any",
    maxResults: 1,
    interpolation: "adaptive",
    echo: true,
    brief: false,
    autoComplete: false,
    setBack: 0,
    outputSRS: 4326,
    minScore: 1,
    provinceCode: "BC",
  };

  const destinationParams = {
    ...startPosParams,
    addressString: "525 Superior Street, Victoria, BC",
  };

  axios
    .all([
      sendRequest(`${GC_URL}/addresses.json`, "get", startPosParams),
      sendRequest(`${GC_URL}/addresses.json`, "get", destinationParams),
    ])
    .then(
      axios.spread((startingPosData, destinationData) => {
        const startingPosCoords =
          startingPosData.features[0].geometry.coordinates;
        const destinationCoords =
          destinationData.features[0].geometry.coordinates;

        console.log("Starting Pos Coords:", startingPosCoords);
        console.log("Destination Coords:", destinationCoords);

        const RPConfig = {
          headers: {
            apikey: RP_KEY,
          },
        };

        const distanceParams = {
          points: startingPosCoords.concat(destinationCoords).join(","),
        };
        
        // TODO: uncomment once access request approved
        const distanceReq = sendRequest(
          `${RP_URL}/directions.json`,
          "get",
          distanceParams,
          RPConfig
        );
        distanceReq.then((rpRes) => {
          console.log("RP Response:", rpRes);
        });
      })
    )
    .catch((err) => {
      console.error("Error making request:", err);
    });

  // const startPosParams = new URLSearchParams(params).toString();
  // var startingPosCoords;

  // axios
  //   .get(`${GC_URL}/addresses.json?${startPosParams}`)
  //   .then((res) => (startingPosCoords = res))
  //   .catch((err) => console.log(err));

  // console.log(startingPosCoords);

  // axios
  //   .get(RP_URL, config)
  //   .then((res) => console.log(res))
  //   .catch((err) => console.log(err));

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
