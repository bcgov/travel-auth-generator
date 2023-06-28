// Router planner developer guide: https://bcgov.github.io/ols-router/router-developer-guide.html
// RP Swagger: https://petstore.swagger.io/?url=https://raw.githubusercontent.com/bcgov/api-specs/master/router/router.json

require("dotenv").config();

const express = require("express");
var bodyParser = require("body-parser");
var path = require("path");
const axios = require("axios");
var pdf = require("./pdf");
const archiver = require("archiver");
const fs = require("fs");
// var zip = require('express-easy-zip');
const { Console } = require("console");
var AdmZip = require('adm-zip');

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
// app.use(zip())

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

app.get("/download", (req, res) => {
  const output = fs.createWriteStream("archive.zip");
  const archive = archiver("zip");

  output.on("close", () => {
    console.log("Archive created successfully");
    res.download(path.join(__dirname, "archive.zip"));
  });

  archive.on("error", (err) => {
    console.error("Error creating archive:", err);
    res.status(500).send({ error: "Failed to create archive" });
  });

  // Directory containing the files to be zipped
  const directoryPath = path.join(__dirname, "public/forms");

  // Get the list of files in the directory
  const files = fs.readdirSync(directoryPath);

  // Add each file to the archive
  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    archive.file(filePath, { name: file });
  });

  archive.pipe(output);
  archive.finalize();

  // const file = path.join(__dirname, "public", "travel-auth-modified.pdf");
  // res.download(file, "travel-auth-modified.pdf", (err) => {
  //   if (err) {
  //     console.error("Error downloading file:", err);
  //     res.status(500).send("Internal Server Error");
  //   }
  // });
});

app.get("/submit-traveler-data", function (req, res) {
  res.sendFile(path.join(__dirname, "/submit-travel-details.html"));
});

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
              
              // const path = './public/forms/'
              // const fileName = `travel-auth-${employeeName.split(' ').join('_').toLowerCase()}.pdf`

              // const d = {path, fileName}
              // console.log("datad:", d)
              // return d
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


app.post("/process-csv", express.json(), async (req, res) => {
  console.log("Processing csv...");
  const jsonData = JSON.parse(req.body.data);
  const processingPromises = jsonData.map(processEmployee);

  console.log("processingPromises:", processingPromises)

  try {
    // wait for all promises to resolve
    console.log("before processed data")
    const processedData = await Promise.all(processingPromises);
    console.log("after processed data")

    var zip = new AdmZip();
    processedData.forEach((item) => {
      zip.addLocalFile(path.join(__dirname, '/public/forms',item.fileName));
    })
    
    // console.log(path.join(__dirname, '/public/forms/travel-auth-mikael_akerfeldt.pdf'))
    var zipFileContents = zip.toBuffer();
    const fileName = 'uploads.zip';
    const fileType = 'application/zip';

    // console.log(zipFileContents)
    // const file = path.join(__dirname, "public", "forms", "travel-auth-mikael_akerfeldt.pdf");
    // res.download(file, "travel-auth-mikael_akerfeldt.pdf", (err) => {
    //   if (err) {
    //     console.error("Error downloading file:", err);
    //     res.status(500).send("Internal Server Error");
    //   }
    // });
    res.writeHead(200, {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': fileType,
    })
    return res.end(zipFileContents);

    // res.redirect('/download-forms')

    

  //   await res.zip({
  //     files: [{
  //         path: path.join(__dirname, './public/forms/'),
  //         name: 'travel-auth-mikael_akerfeldt.pdf'
  //     }],
  //     filename: 'Package.zip'
  // });

    // // once done processing all items, zip the files and send to the user
    // const zip = archiver('zip');
    // zip.on('end', () => res.send());
    // zip.pipe(res);

    // console.log("processedData:", processedData)
    // processedData.forEach((item) => {
    //   console.log("item:", item)
    //   console.log(path.join(__dirname, item.path, item.fileName))
    //   zip.file(path.join(__dirname, item.path, item.fileName), { name: item.fileName });
    // });
    // zip.finalize();
  } 
  catch (error) {
    console.error('Error processing data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/download-forms', function (req, res) {
  var zip = new AdmZip();
    zip.addLocalFile(path.join(__dirname, '/public/forms/travel-auth-mikael_akerfeldt.pdf'));
    console.log(path.join(__dirname, '/public/forms/travel-auth-mikael_akerfeldt.pdf'))
    var zipFileContents = zip.toBuffer();
    const fileName = 'uploads.zip';
    const fileType = 'application/zip';

    // console.log(zipFileContents)
    // const file = path.join(__dirname, "public", "forms", "travel-auth-mikael_akerfeldt.pdf");
    // res.download(file, "travel-auth-mikael_akerfeldt.pdf", (err) => {
    //   if (err) {
    //     console.error("Error downloading file:", err);
    //     res.status(500).send("Internal Server Error");
    //   }
    // });
    res.writeHead(200, {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': fileType,
    })
    return res.end(zipFileContents);
});

app.post("/submit-traveler-data", function (req, res) {
  processEmployee(req.body);
  // res.send({ message: "processing request..." });
  res.send('<script>window.location.href = "/download";</script>');
  // res.sendFile(path.join(__dirname, "/submit-travel-details.html"));
  // res.download('/Users/nirajpatel/Projects/travel-auth-generator/travel-auth-modified.pdf', 'travel-auth-modified.pdf', (err) => {
  //   if (err) {
  //     // Handle error
  //     console.error('Error downloading file:', err);
  //   }
  // });
});

app.listen(PORT, () => console.log(`Express app running on port ${PORT}!`));

