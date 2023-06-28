// Router planner developer guide: https://bcgov.github.io/ols-router/router-developer-guide.html
// RP Swagger: https://petstore.swagger.io/?url=https://raw.githubusercontent.com/bcgov/api-specs/master/router/router.json

require("dotenv").config();

const express = require("express");
var bodyParser = require("body-parser");
var path = require("path");
const axios = require("axios");
var pdf = require("./pdf");
var AdmZip = require("adm-zip");
const fs = require("fs");

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

// app.get("/submit-traveler-data", function (req, res) {
//   res.sendFile(path.join(__dirname, "/submit-travel-details.html"));
// });

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "/index.html"));
});

function processEmployee(employeeData) {
  const {
    employeeName,
    ministryName,
    employeeID,
    position,
    unit,
    branch,
    startingPos,
    destination,
    accommodationName,
    numberOfNights,
    methodOfTravel,
    purposeOfTravel,
  } = employeeData;

  console.log(employeeData);

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

  return axios
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

        return axios
          .all([
            sendHotelRequest(destinationCoords),
            sendRoutePlannerRequest(startingPosCoords, destinationCoords),
          ])
          .then(
            axios.spread((hotelRes, rpRes) => {
              const accommodationCost = getAccommodationCost(
                hotelRes,
                accommodationName,
                numberOfNights
              );
              console.log(
                `Accommodation cost: $${accommodationCost.toFixed(2)}`
              );

              const mileageCost = rpRes.distance * MILEAGE_REIMBURSEMENT_PER_KM;
              console.log(`Mileage cost: $${mileageCost.toFixed(2)}`);

              return pdf.createPdf({
                employeeName,
                ministryName,
                employeeID,
                position,
                unit,
                branch,
                startingPos,
                destination,
                accommodationName,
                numberOfNights,
                methodOfTravel,
                purposeOfTravel,
                accommodationCost,
                mileageCost,
              });
            })
          )
          .catch((hrrpErr) => console.error("Error Making Request", hrrpErr));
      })
    )
    .catch((err) => {
      console.error("Error making request:", err);
    });
}

function removeFilesFromDirectory(directoryPath) {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }

    // Iterate over the files in the directory
    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);

      // Delete the file
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting file:", filePath, err);
        } else {
          console.log("File deleted:", filePath);
        }
      });
    });
  });
}

app.post("/process-data", express.json(), async (req, res) => {
  console.log("Processing data...");
  const body = req.body;
  const data = "data" in body ? JSON.parse(body.data) : [body];
  const processingPromises = data.map(processEmployee);

  try {
    // wait for all promises to resolve
    const processedData = await Promise.all(processingPromises);

    const formPath = path.join(__dirname, "/public/forms");

    var zip = new AdmZip();
    processedData.forEach((item) => {
      zip.addLocalFile(path.join(formPath, item.fileName));
    });

    var zipFileContents = zip.toBuffer();
    const fileName = "uploads.zip";
    const fileType = "application/zip";

    res.writeHead(200, {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": fileType,
    });
    removeFilesFromDirectory(formPath);
    return res.end(zipFileContents);
  } catch (error) {
    console.error("Error processing data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, () => console.log(`Express app running on port ${PORT}!`));
