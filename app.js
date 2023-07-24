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

const MILEAGE_COST_PER_KM = process.env.MILEAGE_COST_PER_KM || 0.61;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

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

function convertToBool(value) {
  if (typeof value === "boolean") {
    return value;
  } else if (typeof value === "string") {
    return value.toLowerCase() === "true";
  } else if (typeof value === "number") {
    return value !== 0;
  } else {
    return false;
  }
}

function getNumberOfNights(dateDeparting, dateReturning) {
  const date1 = new Date(dateDeparting);
  const date2 = new Date(dateReturning);

  const timeDifferenceInMs = Math.abs(date2 - date1);
  const daysDifference = Math.ceil(timeDifferenceInMs / (24 * 60 * 60 * 1000));

  return daysDifference;
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

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "/index.html"));
});

function processEmployee(employeeData, taConfig) {
  const { startingPos, destination, methodOfTravel, takingFerry } =
    employeeData;

  const numberOfNights = parseInt(employeeData.numberOfNights);
  // // Perhaps later we can calculate the number of nights:
  // const numberOfNights = getNumberOfNights(dateDeparting, dateReturning)

  const ferryCost = convertToBool(takingFerry)
    ? parseFloat(taConfig.ferryCost) * 2
    : 0.0;

  const outOfProvince = convertToBool(employeeData.outOfProvince);
  const outOfCanada = convertToBool(employeeData.outOfCanada);
  const inProvince = convertToBool(employeeData.inProvince);

  const parkingCost =
    methodOfTravel === "Drive"
      ? (parseInt(numberOfNights) + 1) * parseFloat(taConfig.parkingCost)
      : 0.0;

  const pdfData = {
    ...employeeData,
    outOfProvince,
    outOfCanada,
    inProvince,
    parkingCost,
    ferryCost,
    numberOfNights,
    transportationCost: 0.0,
  };

  if (methodOfTravel !== "Drive") {
    return pdf.createPdf(pdfData);
  }

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
          .all([sendRoutePlannerRequest(startingPosCoords, destinationCoords)])
          .then(
            axios.spread((rpRes) => {
              const mileageCost = rpRes.distance * MILEAGE_COST_PER_KM;
              console.log(`Mileage cost: $${mileageCost.toFixed(2)}`);

              pdfData.transportationCost = mileageCost;

              return pdf.createPdf(pdfData);
            })
          )
          .catch((err) => {
            console.error("Error making request:", err);
          });
      })
    )
    .catch((err) => {
      console.error("Error making request:", err);
    });
}

app.post("/process-data", express.json(), async (req, res) => {
  console.log("Processing data...");
  const body = req.body;

  const employeeData = body.data.employeeData;
  const taConfig = body.data.taConfig;

  // const data = "data" in body ? JSON.parse(body.data) : [body];
  const processingPromises = employeeData.map((empData) =>
    processEmployee(empData, taConfig)
  );

  try {
    const formPath = path.join(__dirname, "/public/forms");
    removeFilesFromDirectory(formPath);

    // wait for all promises to resolve
    const processedData = await Promise.all(processingPromises);

    var zip = new AdmZip();
    processedData.forEach((item) => {
      zip.addLocalFile(path.join(formPath, item.fileName));
    });

    var zipFileContents = zip.toBuffer();
    const fileName = "travelAuthForms.zip";
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
