// Router planner developer guide: https://bcgov.github.io/ols-router/router-developer-guide.html
// RP Swagger: https://petstore.swagger.io/?url=https://raw.githubusercontent.com/bcgov/api-specs/master/router/router.json

require("dotenv").config();

const express = require("express");

var bodyParser = require("body-parser");
<<<<<<< HEAD
var path = require("path");
=======

var path = require("path");

>>>>>>> pdf-poc
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const RP_KEY = process.env.ROUTE_PLANNER_API_KEY;
const RP_URL = "https://router.api.gov.bc.ca";
const GC_URL = "https://apps.gov.bc.ca/pub/geocoder";
const HOTEL_URL = "http://csa.pss.gov.bc.ca/businesstravel/GetProperties.aspx";

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

function sendHotelRequest(destinationCoords) {
  const hotelRateParams = {
    rad: 20,
    lat: destinationCoords[1],
    lng: destinationCoords[0],
    mr: 20,
    output: "json",
    _: Math.floor(Date.now() / 1000), // Get UNIX timestamp
  };
  return sendRequest(HOTEL_URL, "get", hotelRateParams);
}

function sendRoutePlannerRequest(startingPosCoords, destinationCoords) {
  const RPConfig = {
    headers: {
      apikey: RP_KEY,
    },
  };

  const distanceParams = {
    points: startingPosCoords.concat(destinationCoords).join(","),
    roundTrip: true,
  };

  return sendRequest(
    `${RP_URL}/distance.json`,
    "get",
    distanceParams,
    RPConfig
  );
}

function getAccommodationCost(hotelRes, accommodationName, numberOfNights) {
  const filteredItems = hotelRes.filter(
    (item) => item.property_name === accommodationName
  );
  var rate = 0.0;
  if (filteredItems.length > 0) {
    rate = filteredItems[0].single_day;
  }
  // NOTE: This is not entirely accurate. The API response here isn't matching what is shown on the page,
  // Eg: http://csa.pss.gov.bc.ca/businesstravel/Search.aspx?lat=48.428315&lng=-123.364514&rad=20&mr=20&loc=Victoria
  // So this is a rough calculation. It also seems to be missing some results.
  const totalRate = rate * 2 * numberOfNights;
  return totalRate * 0.2 + totalRate;
}

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "/index.html"));
});

<<<<<<< HEAD
app.post("/submit-traveler-data", function (req, res) {
  const {
    startingPos,
    destination,
    accommodationName,
    numberOfNights,
    employeeName,
    methodOfTravel,
  } = req.body;

  console.log("Employee name:",employeeName);

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
=======
app.post('/submit-traveler-data', function(req, res) {
  
  const { employeeName } = req.body;
  console.log("Employee Name -->" +employeeName)
  axios.get('https://httpbin.org/anything'
  ).then (res => {
    // console.log(res);
  }).catch(err => {
    console.log(err);
  })

  console.log('receiving data ...');
  // console.log('body is ',req.body);
>>>>>>> pdf-poc

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

        axios
          .all([
            sendHotelRequest(destinationCoords),
            sendRoutePlannerRequest(startingPosCoords, destinationCoords),
          ])
          .then(
            axios.spread((hotelRes, rpRes) => {
              const accommodationTotal = getAccommodationCost(
                hotelRes,
                accommodationName,
                numberOfNights
              );
              console.log(`Accommodation cost: $${accommodationTotal.toFixed(2)}`);

              const mileageTotal =
                rpRes.distance * MILEAGE_REIMBURSEMENT_PER_KM;
              console.log(`Mileage cost: $${mileageTotal.toFixed(2)}`);
            })
          )
          .catch((hrrpErr) => console.error("Error Making Request", hrrpErr));
      })
    )
    .catch((err) => {
      console.error("Error making request:", err);
    });

  res.send({message: "processing request..."});
});

app.listen(PORT, () => console.log(`Express app running on port ${PORT}!`));
