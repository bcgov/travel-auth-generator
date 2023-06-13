// Router planner developer guide: https://bcgov.github.io/ols-router/router-developer-guide.html
// RP Swagger: https://petstore.swagger.io/?url=https://raw.githubusercontent.com/bcgov/api-specs/master/router/router.json

require("dotenv").config();

const express = require("express");
var bodyParser = require("body-parser");
var path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const RP_KEY = process.env.ROUTE_PLANNER_API_KEY;
const RP_URL = "https://router.api.gov.bc.ca";
const GC_URL = "https://apps.gov.bc.ca/pub/geocoder";

const MILEAGE_REIMBURSEMENT_PER_KM = 0.61;

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
  const {
    startingPos,
    destination,
    accommodationName,
    numberOfNights,
    firstName,
    lastName,
    methodOfTravel,
  } = req.body;

  const startPosParams = {
    addressString: startingPos,
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
    addressString: destination,
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

        const hotelRateUrl =
          "http://csa.pss.gov.bc.ca/businesstravel/GetProperties.aspx";

        hotelRateParams = {
          rad: 20,
          lat: destinationCoords[1],
          lng: destinationCoords[0],
          mr: 20,
          output: "json",
          _: Math.floor(Date.now() / 1000) // Get UNIX timestamp
        };

        const hotelRateReq = sendRequest(hotelRateUrl, "get", hotelRateParams);
        hotelRateReq.then((hrRes) => {
          
          const filteredItems = hrRes.filter(item => item.property_name === accommodationName);

          var rate = 0.0;
          if (filteredItems.length > 0) {
            rate = filteredItems[0].single_day;
          }

          // NOTE: This is not entirely accurate. The API response here isn't matching what is shown on the page,
          // Eg: http://csa.pss.gov.bc.ca/businesstravel/Search.aspx?lat=48.428315&lng=-123.364514&rad=20&mr=20&loc=Victoria
          // So this is a rough calculation. It also seems to be missing some results.
          const totalRate = rate * 2 * numberOfNights;
          const accommodationTotal = totalRate * 0.2 + totalRate;
          
          console.log("Accommodation total:", accommodationTotal)
        });

        const RPConfig = {
          headers: {
            apikey: RP_KEY,
          },
        };

        const distanceParams = {
          points: startingPosCoords.concat(destinationCoords).join(","),
          roundTrip: true,
        };

        // // TODO: uncomment once access request approved
        // const distanceReq = sendRequest(
        //   `${RP_URL}/distance.json`,
        //   "get",
        //   distanceParams,
        //   RPConfig
        // );
        // distanceReq.then((rpRes) => {
        //   console.log("RP Response:", rpRes);
        //   const cost = rpRes.distance * MILEAGE_REIMBURSEMENT_PER_KM;
        //   console.log(`Trip cost: $${cost.toFixed(2)}`)
        // });
      })
    )
    .catch((err) => {
      console.error("Error making request:", err);
    });

  res.send(req.body);
});

app.listen(PORT, () => console.log(`Express app running on port ${PORT}!`));
