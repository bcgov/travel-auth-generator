const pdfLib = require("pdf-lib");
const fs = require("fs");
const { promisify } = require("util");

const writeFileAsync = promisify(fs.writeFile);

// const convertPDF = document.getElementById('convertPDF');

async function createPdf(pdfData) {

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
    outOfProvince,
    outOfCanada,
    inProvince,
    vote,
    dateDeparting,
    dateReturning,
    orgPaying,
    taxiUberCost,
  } = pdfData;

  const accommodationCost = parseFloat(pdfData.accommodationCost);
  const parkingCost = parseFloat(pdfData.parkingCost);
  const transportationCost = parseFloat(pdfData.transportationCost);
  const numberOfNights = parseInt(pdfData.numberOfNights);

  const existingPdfBytes = fs.readFileSync("./travel-auth-form.pdf");
  const pdfDoc = await pdfLib.PDFDocument.load(existingPdfBytes);

  // Access the form containing the fields, modify text field
  const form = pdfDoc.getForm();

  // // Get all fields in the form
  // const fields = form.getFields();

  // // List name of fields
  // const textBoxNames = fields.map((textField) => textField.getName());

  // console.log("Text box names:", textBoxNames);

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

  var otherExpenseFieldIndex = 1;
  otherExpenses = {};

  function addOtherExpense(fieldName, value) {
    const keyField = form.getTextField(
      `topmostSubform[0].Page1[0].Other[${otherExpenseFieldIndex}]`
    );
    const valueField = form.getTextField(
      `topmostSubform[0].Page1[0].Amount[${5 + otherExpenseFieldIndex}]`
    ); // "Other" amount field begins at index 5

    keyField.setText(fieldName.toString());
    valueField.setText(value.toFixed(2).toString());
    otherExpenseFieldIndex++;
    otherExpenses[fieldName] = value;
  }

  if (parkingCost) {
    addOtherExpense("Parking", parkingCost);
  }

  if (taxiUberCost) {
    addOtherExpense("Taxi/Uber", taxiUberCost);
  }

  const outProvinceCheckbox = form.getCheckBox(
    "topmostSubform[0].Page1[0].OutProvince[0]"
  );
  outOfProvince ? outProvinceCheckbox.check() : outProvinceCheckbox.uncheck();

  const outCanadaCheckbox = form.getCheckBox(
    "topmostSubform[0].Page1[0].OutCanada[0]"
  );
  outOfCanada ? outCanadaCheckbox.check() : outCanadaCheckbox.uncheck();

  const inProvinceCheckbox = form.getCheckBox(
    "topmostSubform[0].Page1[0].InProvince[0]"
  );
  inProvince ? inProvinceCheckbox.check() : inProvinceCheckbox.uncheck();

  if (vote) {
    const voteField = form.getTextField("topmostSubform[0].Page1[0].Vote[0]");
    voteField.setText(vote.toString());
  }
  if (dateDeparting) {
    const dateDepartingField = form.getTextField(
      "topmostSubform[0].Page1[0].DateDepart[0]"
    );
    dateDepartingField.setText(dateDeparting.toString());
  }

  if (dateReturning) {
    const dateReturningField = form.getTextField(
      "topmostSubform[0].Page1[0].DateReturn[0]"
    );
    dateReturningField.setText(dateReturning.toString());
  }

  const orgPayingNACheckbox = form.getCheckBox(
    "topmostSubform[0].Page1[0].IdentNA[0]"
  );

  const orgPayingTextbox = form.getTextField(
    "topmostSubform[0].Page1[0].IdentOrg[0]"
  );

  if (orgPaying && orgPaying.toLowerCase() !== "n/a") {
    orgPayingTextbox.setText(orgPaying.toString());
  }

  !orgPaying || orgPaying.toLowerCase() === "n/a"
    ? orgPayingNACheckbox.check()
    : orgPayingNACheckbox.uncheck();

  const totalExpense =
    accommodationCost +
    transportationCost +
    Object.values(otherExpenses).reduce((a, b) => a + b, 0);

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
  const fileName = `TA IP Victoria October 2023 Divisional All Staff - ${employeeName}.pdf`;

  await writeFileAsync(`${path}${fileName}`, modifiedPdfBytes);

  return { path, fileName };
}

module.exports = {
  createPdf: createPdf,
};

// const pdfData = {"employeeName" : "Test1","numberOfNights":"Test2","destination":"Test3","methodOfTravel":"Test4","accommodationCost":"Test5","mileageCost":"Test6"}
// createPdf(pdfData)
// convertPDF.addEventListener('click', () => {
//   editPdfText()
// });
