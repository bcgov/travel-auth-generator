const pdfLib = require("pdf-lib");
const fs = require("fs");
const { promisify } = require("util");

const writeFileAsync = promisify(fs.writeFile);

// const convertPDF = document.getElementById('convertPDF');

const ID_LEN = 6;

function makeId(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

async function createPdf(pdfData) {
  console.log(pdfData);

  const {
    employeeName,
    ministryName,
    employeeID,
    position,
    unit,
    branch,
    destination,
    methodOfTravel,
    purposeOfTravel,
  } = pdfData;

  const accommodationCost = parseFloat(pdfData.accommodationCost);
  const bufferCost = parseFloat(pdfData.bufferCost);
  const ferryCost = parseFloat(pdfData.ferryCost);
  const transportationCost = parseFloat(pdfData.transportationCost);
  const numberOfNights = parseInt(pdfData.numberOfNights);

  const existingPdfBytes = fs.readFileSync("./travel-auth-form.pdf");
  const pdfDoc = await pdfLib.PDFDocument.load(existingPdfBytes);

  // Access the form containing the fields, modify text field
  const form = pdfDoc.getForm();

  const nameField = form.getTextField("topmostSubform[0].Page1[0].EmpName[0]");
  nameField.setText(employeeName);

  const daysAwayField = form.getTextField(
    "topmostSubform[0].Page1[0].DaysAway[0]"
  );
  daysAwayField.setText(numberOfNights.toString());

  const destinationField = form.getTextField(
    "topmostSubform[0].Page1[0].Destinations[0]"
  );
  destinationField.setText(destination);

  const methodOfTravelField = form.getTextField(
    "topmostSubform[0].Page1[0].MethodTravel[0]"
  );
  methodOfTravelField.setText(methodOfTravel);

  const ministryField = form.getTextField(
    "topmostSubform[0].Page1[0].Ministry[0]"
  );
  ministryField.setText(ministryName);

  const empIDField = form.getTextField("topmostSubform[0].Page1[0].EmpID[0]");
  empIDField.setText(employeeID.toString());

  const empPositionField = form.getTextField(
    "topmostSubform[0].Page1[0].Position[0]"
  );
  empPositionField.setText(position);

  const empUnitField = form.getTextField(
    "topmostSubform[0].Page1[0].BargainUnit[0]"
  );
  empUnitField.setText(unit);

  const travelPurposeField = form.getTextField(
    "topmostSubform[0].Page1[0].PurposeTravel[0]"
  );
  travelPurposeField.setText(purposeOfTravel);

  const empBranchField = form.getTextField(
    "topmostSubform[0].Page1[0].Branch[0]"
  );
  empBranchField.setText(branch);

  const accommCostField = form.getTextField(
    "topmostSubform[0].Page1[0].Amount[2]"
  );
  accommCostField.setText(accommodationCost.toFixed(2).toString());

  if (transportationCost) {
    const transportationCostField = form.getTextField(
      "topmostSubform[0].Page1[0].Amount[0]"
    );
    transportationCostField.setText(transportationCost.toFixed(2).toString());
  }

  var otherFieldIndex = 0;
  otherExpenses = {};

  function addOtherExpense(fieldName, value) {
    const keyField = form.getTextField(
      `topmostSubform[0].Page1[0].Other[${otherFieldIndex}]`
    );
    const valueField = form.getTextField(
      `topmostSubform[0].Page1[0].Amount[${5 + otherFieldIndex}]`
    ); // "Other" amount field begins at index 5

    keyField.setText(fieldName.toString());
    valueField.setText(value.toFixed(2).toString());
    otherFieldIndex++;
    otherExpenses[fieldName] = value;
  }

  if (ferryCost) {
    addOtherExpense("Ferry", ferryCost);
  }

  if (bufferCost) {
    addOtherExpense("Buffer", bufferCost);
  }

  const totalExpense =
    accommodationCost +
    transportationCost +
    Object.values(otherExpenses).reduce((a, b) => a + b, 0);

console.log(totalExpense);

  const subTotalField = form.getTextField(
    "topmostSubform[0].Page1[0].SubTotal[0]"
  );
  subTotalField.setText(totalExpense.toFixed(2).toString());

  const totalCostField = form.getTextField(
    "topmostSubform[0].Page1[0].Total[0]"
  );
  totalCostField.setText(totalExpense.toFixed(2).toString());

  const modifiedPdfBytes = await pdfDoc.save();

  const path = "public/forms/";
  const fileName = `travel-auth-${employeeName
    .split(" ")
    .join("_")
    .toLowerCase()}-${makeId(ID_LEN)}.pdf`;

  await writeFileAsync(`${path}${fileName}`, modifiedPdfBytes);

  return { path, fileName };

  // // Get all fields in the form
  // const fields = form.getFields();

  // // List name of fields
  // const textBoxNames = fields.map((textField) => textField.getName());

  // console.log("Text box names:", textBoxNames);
}

module.exports = {
  createPdf: createPdf,
};

// const pdfData = {"employeeName" : "Test1","numberOfNights":"Test2","destination":"Test3","methodOfTravel":"Test4","accommodationCost":"Test5","mileageCost":"Test6"}
// createPdf(pdfData)
// convertPDF.addEventListener('click', () => {
//   editPdfText()
// });
