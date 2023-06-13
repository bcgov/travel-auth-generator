import { PDFDocument} from "pdf-lib";
import fs from "fs";
const convertPDF = document.getElementById('convertPDF');

async function editPdfText() {
  var webForm = document.getElementById("myForm");
  var employeeName = webForm.elements["employeeName"].value;
  // var email = webForm.elements["email"].value;
  // var message = webForm.elements["message"].value;
  // Load the existing PDF document
  const existingPdfBytes = fs.readFileSync("./travel-auth-form.pdf");
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  // Access the form containing the fields, modify text field
  const form = pdfDoc.getForm();

  const nameField = form.getTextField("topmostSubform[0].Page1[0].EmpName[0]");
  nameField.setText(employeeName);

  const modifiedPdfBytes = await pdfDoc.save();

  fs.writeFileSync('./travel-auth-modified.pdf', modifiedPdfBytes);

  // // Get all fields in the form
  // const fields = form.getFields();

  // // List name of fields
  // const textBoxNames = fields
  //   .map((textField) => textField.getName());

  // console.log('Text box names:', textBoxNames);
}

convertPDF.addEventListener('click', () => {
  editPdfText()
});
