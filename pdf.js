const pdfLib = require("pdf-lib");
const fs = require("fs");

// const convertPDF = document.getElementById('convertPDF');

async function createPdf(pdfData) {
  console.log("Hello from pdf.js!");
  console.log(pdfData);

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
    accommodationCost,
    mileageCost
  } = pdfData;

  // var webForm = document.getElementById("myForm");
  // var employeeName = webForm.elements["employeeName"].value;
  // var email = webForm.elements["email"].value;
  // var message = webForm.elements["message"].value;
  // Load the existing PDF document
  const existingPdfBytes = fs.readFileSync("./travel-auth-form.pdf");
  const pdfDoc = await pdfLib.PDFDocument.load(existingPdfBytes);

  // Access the form containing the fields, modify text field
  const form = pdfDoc.getForm();

  const nameField = form.getTextField("topmostSubform[0].Page1[0].EmpName[0]");
  nameField.setText(employeeName);

  const daysAway = form.getTextField("topmostSubform[0].Page1[0].DaysAway[0]");
  daysAway.setText(numberOfNights.toString());

  const cityName = form.getTextField(
    "topmostSubform[0].Page1[0].Destinations[0]"
  );
  cityName.setText(destination);

  const methodTravel = form.getTextField(
    "topmostSubform[0].Page1[0].MethodTravel[0]"
  );
  methodTravel.setText(methodOfTravel);

  const ministry = form.getTextField("topmostSubform[0].Page1[0].Ministry[0]");
  ministry.setText(ministryName);

  const empID = form.getTextField("topmostSubform[0].Page1[0].EmpID[0]");
  empID.setText(employeeID.toString());

  const empPosition = form.getTextField("topmostSubform[0].Page1[0].Position[0]");
  empPosition.setText(position);

  const empUnit = form.getTextField("topmostSubform[0].Page1[0].BargainUnit[0]");
  empUnit.setText(unit);

  const travelPurpose = form.getTextField("topmostSubform[0].Page1[0].PurposeTravel[0]");
  travelPurpose.setText(purposeOfTravel);

  const empBranch = form.getTextField("topmostSubform[0].Page1[0].Branch[0]");
  empBranch.setText(branch);

  const accommCost = form.getTextField("topmostSubform[0].Page1[0].Amount[2]");
  accommCost.setText(accommodationCost.toFixed(2).toString());

  const milageCost = form.getTextField("topmostSubform[0].Page1[0].Amount[0]");
  milageCost.setText(mileageCost.toFixed(2).toString());

  const totalExpense = accommodationCost + mileageCost;
  const subTotal = form.getTextField("topmostSubform[0].Page1[0].SubTotal[0]");

  subTotal.setText(totalExpense.toFixed(2).toString());
  const totalCost = form.getTextField("topmostSubform[0].Page1[0].Total[0]");
  totalCost.setText(totalExpense.toFixed(2).toString());

  const modifiedPdfBytes = await pdfDoc.save();

  fs.writeFileSync(`./public/forms/travel-auth-${employeeName.split(' ').join('_').toLowerCase()}.pdf`, modifiedPdfBytes);

  // Get all fields in the form
  const fields = form.getFields();

  // List name of fields
  const textBoxNames = fields.map((textField) => textField.getName());

  console.log("Text box names:", textBoxNames);
}

module.exports = {
  createPdf: createPdf,
};

// const pdfData = {"employeeName" : "Test1","numberOfNights":"Test2","destination":"Test3","methodOfTravel":"Test4","accommodationCost":"Test5","mileageCost":"Test6"}
// createPdf(pdfData)
// convertPDF.addEventListener('click', () => {
//   editPdfText()
// });
