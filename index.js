const express = require("express");
const PdfPrinter = require("pdfmake");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { PDFDocument } = require("pdf-lib");
const {
  getImagePath,
  noLineLayout,
  createThreeZoneBar,
  createTwoZoneBar,
  createFourZoneBar,
  createHealthCard,
  createSimpleCard,
  createLipidCard,
  createBodyIndicator,
  fillColors,
} = require("./pdfHelpers");

/**
 * Fetches a PDF from a URL and returns it as a buffer
 * @param {string} url - URL of the PDF to fetch
 * @returns {Promise<Buffer>} PDF as buffer
 */
async function fetchPdfFromUrl(url) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 second timeout
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error fetching PDF from ${url}:`, error.message);
    throw new Error(`Failed to fetch PDF from URL: ${error.message}`);
  }
}

/**
 * Merges multiple PDF buffers into a single PDF
 * @param {Buffer} mainPdfBuffer - The main generated PDF buffer
 * @param {Buffer[]} additionalPdfBuffers - Array of additional PDF buffers to append
 * @returns {Promise<Buffer>} Merged PDF as buffer
 */
async function mergePdfs(mainPdfBuffer, additionalPdfBuffers) {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Load the main PDF
    const mainPdf = await PDFDocument.load(mainPdfBuffer);
    const mainPages = await mergedPdf.copyPages(mainPdf, mainPdf.getPageIndices());
    mainPages.forEach((page) => mergedPdf.addPage(page));
    
    // Load and append each additional PDF
    for (const pdfBuffer of additionalPdfBuffers) {
      if (pdfBuffer) {
        const additionalPdf = await PDFDocument.load(pdfBuffer);
        const additionalPages = await mergedPdf.copyPages(additionalPdf, additionalPdf.getPageIndices());
        additionalPages.forEach((page) => mergedPdf.addPage(page));
      }
    }
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.error("Error merging PDFs:", error.message);
    throw new Error(`Failed to merge PDFs: ${error.message}`);
  }
}

/**
 * Transforms the array-based test category payload into the flat object format
 * expected by createPdfDocDefinition
 * @param {Array} testCategories - Array of test categories with data
 * @param {Object} patientInfo - Patient information (name, age, dob, gender, reportDate)
 * @returns {Object} Transformed data object
 */
function transformPayload(testCategories, patientInfo = {}) {
  const result = {
    patientName: patientInfo.patientName || "",
    age: patientInfo.age || "",
    dob: patientInfo.dob || "",
    gender: patientInfo.gender || "",
    reportDate: patientInfo.reportDate || "",
  };
  
  // Helper function to find a test by name within a category
  function findTest(categoryCode, testName) {
    const category = testCategories.find(c => c.test_category_code === categoryCode);
    if (!category || !category.data) return null;
    return category.data.find(t => t.name.toLowerCase() === testName.toLowerCase());
  }
  
  // Helper function to find a test by name across all categories
  function findTestAny(testName) {
    for (const category of testCategories) {
      if (!category.data) continue;
      const test = category.data.find(t => t.name.toLowerCase() === testName.toLowerCase());
      if (test) return test;
    }
    return null;
  }
  
  // General Health Checkup (HC)
  const heightTest = findTest("HC", "Height");
  if (heightTest) result.height = `${heightTest.value} ${heightTest.unit || ""}`.trim();
  
  const weightTest = findTest("HC", "Weight");
  if (weightTest) result.weight = `${weightTest.value} ${weightTest.unit || ""}`.trim();
  
  const bmiTest = findTest("HC", "BMI");
  if (bmiTest) result.bmi = bmiTest.value;
  
  const healthScoreTest = findTest("HC", "Health Score");
  if (healthScoreTest) result.healthScore = healthScoreTest.value;
  
  const bmrTest = findTest("HC", "BMR");
  if (bmrTest) result.bmr = { value: `${bmrTest.value} ${bmrTest.unit || ""}`.trim(), status: bmrTest.result || "" };
  
  const pulseTest = findTest("HC", "BP Pulse");
  if (pulseTest) result.pulse = { value: `${pulseTest.value} ${pulseTest.unit || ""}`.trim(), status: pulseTest.result || "" };
  
  const proteinTest = findTest("HC", "Protein");
  if (proteinTest) result.protein = { value: `${proteinTest.value} ${proteinTest.unit || ""}`.trim(), status: proteinTest.result || "" };
  
  const bodyFatTest = findTest("HC", "Body Fat");
  if (bodyFatTest) result.bodyFat = { value: `${bodyFatTest.value} ${bodyFatTest.unit || ""}`.trim(), status: bodyFatTest.result || "" };
  
  const metaAgeTest = findTest("HC", "Meta Age");
  if (metaAgeTest) result.metabolicAge = { value: `${metaAgeTest.value} ${metaAgeTest.unit || ""}`.trim(), status: metaAgeTest.result || "" };
  
  const boneMassTest = findTest("HC", "Bone Mass");
  if (boneMassTest) result.boneMass = { value: `${boneMassTest.value} ${boneMassTest.unit || ""}`.trim(), status: boneMassTest.result || "" };
  
  const bodyWaterTest = findTest("HC", "Body Water");
  if (bodyWaterTest) result.bodyWater = { value: `${bodyWaterTest.value} ${bodyWaterTest.unit || ""}`.trim(), status: bodyWaterTest.result || "" };
  
  const muscleMassTest = findTest("HC", "Muscle Mass");
  if (muscleMassTest) result.muscleMass = { value: `${muscleMassTest.value} ${muscleMassTest.unit || ""}`.trim(), status: muscleMassTest.result || "" };
  
  const visceralFatTest = findTest("HC", "Visceral Fat");
  if (visceralFatTest) result.visceralFat = { value: `${visceralFatTest.value} ${visceralFatTest.unit || ""}`.trim(), status: visceralFatTest.result || "" };
  
  const skeletalMuscleTest = findTest("HC", "Skeletal Muscle");
  if (skeletalMuscleTest) result.skeletalMuscle = { value: `${skeletalMuscleTest.value} ${skeletalMuscleTest.unit || ""}`.trim(), status: skeletalMuscleTest.result || "" };
  
  const subcutaneousFatTest = findTest("HC", "Subcutaneous Fat");
  if (subcutaneousFatTest) result.subcutaneousFat = { value: `${subcutaneousFatTest.value} ${subcutaneousFatTest.unit || ""}`.trim(), status: subcutaneousFatTest.result || "" };
  
  const bloodOxygenTest = findTest("HC", "Blood Oxygen");
  if (bloodOxygenTest) result.oxygenSaturation = { value: `${bloodOxygenTest.value} ${bloodOxygenTest.unit || ""}`.trim(), status: bloodOxygenTest.result || "" };
  
  const bodyTempTest = findTest("HC", "Body Temp");
  if (bodyTempTest) result.bodyTemperature = { value: `${bodyTempTest.value} ${bodyTempTest.unit || ""}`.trim(), status: bodyTempTest.result || "" };
  
  const systolicTest = findTest("HC", "Systolic");
  if (systolicTest) result.bpSystolic = { value: `${systolicTest.value} ${systolicTest.unit || ""}`.trim(), status: systolicTest.result || "" };
  
  const diastolicTest = findTest("HC", "Diastolic");
  if (diastolicTest) result.bpDiastolic = { value: `${diastolicTest.value} ${diastolicTest.unit || ""}`.trim(), status: diastolicTest.result || "" };
  
  // Vision (VI)
  const leftEyeTest = findTest("VI", "Left Eye");
  if (leftEyeTest) result.leftEye = { value: leftEyeTest.value || "", status: leftEyeTest.result || "" };
  
  const rightEyeTest = findTest("VI", "Right Eye");
  if (rightEyeTest) result.rightEye = { value: rightEyeTest.value || "", status: rightEyeTest.result || "" };
  
  const colorVisionTest = findTest("VI", "Color Vision");
  if (colorVisionTest) result.colorVision = { value: colorVisionTest.value || "", status: colorVisionTest.result || "" };
  
  // Anemia (AN)
  const hemoglobinTest = findTest("AN", "hemoglobin");
  if (hemoglobinTest) result.hemoglobin = { value: `${hemoglobinTest.value} ${hemoglobinTest.unit || ""}`.trim(), status: hemoglobinTest.result || "" };
  
  // Diabetic Care (DC)
  const glucoseTest = findTest("DC", "Blood Sugar ( Post Prandial )") || findTest("DC", "Blood Sugar");
  if (glucoseTest) result.glucose = { value: `${glucoseTest.value} ${glucoseTest.unit || ""}`.trim(), status: glucoseTest.result || "" };
  
  const hba1cTest = findTest("DC", "HbA1c");
  if (hba1cTest) result.hba1c = { value: `${hba1cTest.value} ${hba1cTest.unit || ""}`.trim(), status: hba1cTest.result || "" };
  
  // Cardiac Care (CC) - ECG PDF
  const ecgCategory = testCategories.find(c => c.test_category_code === "CC");
  if (ecgCategory && ecgCategory.data) {
    const ecgTest = ecgCategory.data.find(t => t.media && t.media.type === "pdf");
    if (ecgTest && ecgTest.media && ecgTest.media.link) {
      result.ecgPdfUrl = ecgTest.media.link.startsWith("http") 
        ? ecgTest.media.link 
        : `https://prod.clinicsoncloud.co/api/v3/${ecgTest.media.link}`;
    }
  }
  
  // Lung Examination (LE) - Spirometer
  const lungCategory = testCategories.find(c => c.test_category_code === "LE");
  if (lungCategory && lungCategory.data && lungCategory.data.length > 0) {
    const fvcTest = findTest("LE", "FVC");
    const pefTest = findTest("LE", "PEF");
    const fev1Test = findTest("LE", "FEV1");
    const fevFvcTest = findTest("LE", "FEV/FVC");
    
    if (fvcTest || pefTest || fev1Test || fevFvcTest) {
      result.spirometerTest = {
        diagnosis: "", // Will need to be determined based on values
        fvc: fvcTest ? { predictivePercent: fvcTest.range || "", predictiveValue: fvcTest.result || "", measuredValue: fvcTest.value || "" } : {},
        pef: pefTest ? { predictivePercent: pefTest.range || "", predictiveValue: pefTest.result || "", measuredValue: pefTest.value || "" } : {},
        fev1: fev1Test ? { predictivePercent: fev1Test.range || "", predictiveValue: fev1Test.result || "", measuredValue: fev1Test.value || "" } : {},
        fev1Fvc: fevFvcTest ? { predictivePercent: fevFvcTest.range || "", predictiveValue: fevFvcTest.result || "", measuredValue: fevFvcTest.value || "" } : {},
      };
    }
    
    // Check for spirometer report PDF
    const spiroReportTest = lungCategory.data.find(t => t.media && t.media.type === "pdf");
    if (spiroReportTest && spiroReportTest.media && spiroReportTest.media.link) {
      result.labReportPdfUrl = spiroReportTest.media.link.startsWith("http")
        ? spiroReportTest.media.link
        : `https://prod.clinicsoncloud.co/api/v3${spiroReportTest.media.link}`;
    }
  }
  
  // Uric Acid (UA)
  const uricAcidTest = findTest("UA", "Uric Acid Test");
  if (uricAcidTest) result.uricAcid = { value: `${uricAcidTest.value} ${uricAcidTest.unit || ""}`.trim(), status: uricAcidTest.result || "" };
  
  // Stress and Fatigue (SF)
  const pssTest = findTest("SF", "PSS") || findTest("SF", "Perceived Stress");
  if (pssTest) result.perceivedStress = { value: pssTest.value || "", status: pssTest.result || "" };
  
  const fasTest = findTest("SF", "FAS") || findTest("SF", "Fatigue");
  if (fasTest) result.fatigueAssessment = { value: fasTest.value || "", status: fasTest.result || "" };
  
  // Mental Health (MH)
  const depressionTest = findTest("MH", "Depression") || findTest("MH", "PHQ-9");
  const anxietyTest = findTest("MH", "Anxiety") || findTest("MH", "GAD-7");
  if (depressionTest || anxietyTest) {
    result.mentalHealth = {
      depression: depressionTest ? depressionTest.result || "" : "",
      anxiety: anxietyTest ? anxietyTest.result || "" : "",
    };
  }
  
  // Ayurvedic (AY)
  const ayurvedicTest = findTest("AY", "Prakriti") || findTestAny("Prakriti");
  if (ayurvedicTest) result.ayurvedicTest = { result: ayurvedicTest.value || "" };
  
  // Ear Examination (EE) - Audiometry
  const earCategory = testCategories.find(c => c.test_category_code === "EE");
  if (earCategory && earCategory.data) {
    const leftEarGraphTest = earCategory.data.find(t => t.name.toLowerCase().includes("left") && t.media);
    const rightEarGraphTest = earCategory.data.find(t => t.name.toLowerCase().includes("right") && t.media);
    
    if (leftEarGraphTest || rightEarGraphTest) {
      result.audiometry = {
        leftEarGraph: leftEarGraphTest?.media?.link || "",
        rightEarGraph: rightEarGraphTest?.media?.link || "",
      };
    }
  }
  
  // Tuberculosis test
  const tbTest = findTestAny("Tuberculosis") || findTestAny("TB");
  if (tbTest) result.tuberculosisTest = { value: tbTest.result || "", recommendation: "" };
  
  // Lipid Profile / Cholesterol tests
  const totalCholTest = findTestAny("Total Cholesterol");
  if (totalCholTest) result.totalCholesterol = { value: `${totalCholTest.value} ${totalCholTest.unit || ""}`.trim(), status: totalCholTest.result || "" };
  
  const triglyceridesTest = findTestAny("Triglycerides");
  if (triglyceridesTest) result.triglycerides = { value: `${triglyceridesTest.value} ${triglyceridesTest.unit || ""}`.trim(), status: triglyceridesTest.result || "" };
  
  const hdlTest = findTestAny("HDL") || findTestAny("HDL Cholesterol");
  if (hdlTest) result.hdlCholesterol = { value: `${hdlTest.value} ${hdlTest.unit || ""}`.trim(), status: hdlTest.result || "" };
  
  const ldlTest = findTestAny("LDL") || findTestAny("LDL Cholesterol");
  if (ldlTest) result.ldlCholesterol = { value: `${ldlTest.value} ${ldlTest.unit || ""}`.trim(), status: ldlTest.result || "" };
  
  return result;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (allows requests from React Native, browsers, etc.)
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Load the virtual file system fonts that come with pdfmake
// The fonts are exported directly as base64 strings
const vfsFonts = require("pdfmake/build/vfs_fonts");

// Convert base64 fonts to buffers for the printer
const fonts = {
  Roboto: {
    normal: Buffer.from(vfsFonts["Roboto-Regular.ttf"], "base64"),
    bold: Buffer.from(vfsFonts["Roboto-Medium.ttf"], "base64"),
    italics: Buffer.from(vfsFonts["Roboto-Italic.ttf"], "base64"),
    bolditalics: Buffer.from(vfsFonts["Roboto-MediumItalic.ttf"], "base64"),
  },
};

// Create the printer instance
const printer = new PdfPrinter(fonts);

/**
 * Creates a PDF document definition for Health Analysis Report
 * @param {Object} data - Health report data (required)
 * @returns {Object} PDF document definition
 */
function createPdfDocDefinition(data) {
  // Extract data from request with fallbacks to prevent NaN errors
  const patientName = data.patientName || "";
  const age = data.age || "";
  const dob = data.dob || "";
  const gender = data.gender || "";
  const reportDate = data.reportDate || "";
  const height = data.height || "N/A";
  const weight = data.weight || "N/A";
  const bmi = data.bmi || "N/A";
  const healthScore = data.healthScore || "N/A";
  const healthScoreTotal = data.healthScoreTotal || "100";
  const oxygenSaturation = data.oxygenSaturation || {
    value: "",
    status: "",
  };
  const oxygenSaturationDescription = "Oxygen saturation is a measure of how much oxygen the blood is carrying as a percentage of the maximum it could carry.";
  
  const bodyFat = data.bodyFat || {
    value: "",
    status: "",
  };
  const bodyFatDescription = "Body Fat Percentage is the proportion of body fat weight to the total body weight. Higher body fat % can damage your long-term health.";
  
  const subcutaneousFat = data.subcutaneousFat || {
    value: "",
    status: "",
  };
  const subcutaneousFatDescription = "It is the proportional weight of fat below the skin to the total body weight. Higher subcutaneous fat value is an indicator of bad physical health.";
  
  const visceralFat = data.visceralFat || {
    value: "",
    status: "",
  };
  const visceralFatDescription = "Visceral fat is located deep in the core abdominal area, surrounding and protecting the vital organs. Healthy level of visceral fat directly reduces the risk of certain diseases.";
  
  const bodyWater = data.bodyWater || {
    value: "",
    status: "",
  };
  const bodyWaterDescription = "It is the total amount of fluid in the body expressed as a percentage of total body weight. Lower body water % can affect the essential body processes like metabolism and thermoregulation.";
  
  const skeletalMuscle = data.skeletalMuscle || {
    value: "",
    status: "",
  };
  const skeletalMuscleDescription = "Skeletal muscles are attached to bones by tendons, and they produce all the movements of body parts in relation to each other.";
  
  const muscleMass = data.muscleMass || {
    value: "",
    status: "",
  };
  const muscleMassDescription = "Muscle mass is weight of all muscles tissue in your body including skeletal, cardiac & smooth muscles. Higher muscle mass indicates the good muscle health.";
  
  const boneMass = data.boneMass || {
    value: "",
    status: "",
  };
  const boneMassDescription = "This is the weight of total bone tissue (Bone minerals + Bone Matrix) in your body. Higher bone mass indicates better bone health.";
  
  const protein = data.protein || {
    value: "",
    status: "",
  };
  const proteinDescription = "It is the proportional weight of body protein components to the total body weight. Adequate protein levels are essential for normal body function.";
  
  const bmr = data.bmr || {
    value: "",
    status: "",
  };
  const bmrDescription = "The BMR or Basal Metabolic Rate is daily minimum level of energy or calories your body requires when at rest (including sleeping) in order to function effectively.";
  
  const metabolicAge = data.metabolicAge || {
    value: "",
    status: "",
  };
  const metabolicAgeDescription = "It is a predicted age of the metabolism of your body. If your metabolic age is higher than your actual age, it's an indication that you need to improve your metabolic rate.";
  
  const bodyTemperature = data.bodyTemperature || {
    value: "",
    status: "",
  };
  const bodyTemperatureDescription = "Body temperature is a measure of your body's ability to generate and get rid of heat. Normal body temperature is typically around 36.5°C to 37.5°C.";
  
  const bpSystolic = data.bpSystolic || {
    value: "",
    status: "",
  };
  const bpSystolicDescription = "Blood pressure is determined both by the amount of blood your heart pumps and the amount of resistance to blood flow in your arteries. The more blood your heart pumps and the narrower your arteries, the higher your blood pressure. Uncontrolled high blood pressure increases your risk of serious health problems, including heart attack and stroke.";
  
  const bpDiastolic = data.bpDiastolic || {
    value: "",
    status: "",
  };
  const bpDiastolicDescription = "Blood pressure is determined both by the amount of blood your heart pumps and the amount of resistance to blood flow in your arteries. The more blood your heart pumps and the narrower your arteries, the higher your blood pressure. Uncontrolled high blood pressure increases your risk of serious health problems, including heart attack and stroke.";
  
  const pulse = data.pulse || {
    value: "",
    status: "",
  };
  const pulseDescription = "In the context of a heartbeat or other physiological measurement, a pulse is a rhythmic beating or throbbing sensation felt in arteries due to the contraction and expansion of the heart as it pumps blood. It is a vital sign used to assess heart rate and overall cardiovascular health.";
  
  const hemoglobin = data.hemoglobin || {
    value: "",
    status: "",
  };
  const hemoglobinDescription = "Hemoglobin is a protein found in red blood cells. It gives blood its red color, and its job is to carry oxygen throughout your body. Low hemoglobin levels usually indicate that a person has anemia.";
  
  const glucose = data.glucose || {
    value: "",
    status: "",
  };
  const glucoseDescription = "Conditions that can result in an elevated blood glucose level include: Acromegaly, Acute stress, Chronic kidney disease, Cushing syndrome, Excessive consumption of food, Hyperthyroidism, Pancreatitis. A low level of glucose may indicate hypoglycemia.";
  const leftEye = data.leftEye || {
    value: "",
    status: "",
  };
  const leftEyeDescription = "The visual acuity test is used to determine the smallest letters you can read on a standardized chart (Snellen chart) or a card held 7 feet away. Visual acuity refers to your ability to discern the shapes and details of the things you see. It's just one factor in your overall vision.";
  
  const rightEye = data.rightEye || {
    value: "",
    status: "",
  };
  const rightEyeDescription = "The visual acuity test is used to determine the smallest letters you can read on a standardized chart (Snellen chart) or a card held 7 feet away. Visual acuity refers to your ability to discern the shapes and details of the things you see. It's just one factor in your overall vision.";
  
  const totalCholesterol = data.totalCholesterol || {
    value: "",
    status: "",
  };
  const totalCholesterolDescription = "This is the total amount of cholesterol in your blood.";
  
  const triglycerides = data.triglycerides || {
    value: "",
    status: "",
  };
  const triglyceridesDescription = "When you eat, your body converts the calories it doesn't need into triglycerides, which are stored in your fat cells. People who are overweight, diabetic, eat too many sweets, or drink too much alcohol can have high triglyceride levels.";
  
  const hdlCholesterol = data.hdlCholesterol || {
    value: "",
    status: "",
  };
  const hdlCholesterolDescription = "This is referred to as \"good\" cholesterol because it helps remove LDL cholesterol from your blood.";
  
  const nonHdlCholesterol = data.nonHdlCholesterol || {
    value: "",
    status: "",
  };
  const nonHdlCholesterolDescription = "Non-HDL cholesterol is all the \"bad\" cholesterol that can clog your arteries and raise the risk of heart problems. It's your total cholesterol minus the \"good\" HDL cholesterol.";
  
  const ldlCholesterol = data.ldlCholesterol || {
    value: "",
    status: "",
  };
  const ldlCholesterolDescription = "This is referred to as \"bad\" cholesterol. Too much of it raises your risk of heart attack, stroke, and atherosclerosis.";
  
  const cholesterolRatio = data.cholesterolRatio || {
    value: "",
    status: "",
  };
  const cholesterolRatioDescription = "Calculated ratio of total cholesterol to HDL.";
  
  const hba1c = data.hba1c || {
    value: "",
    status: "",
  };
  const hba1cDescription = "The hemoglobin A1c test tells you your average level of blood sugar over the past 2 to 3 months. It's also called HbA1c, glycated hemoglobin test, and glycohemoglobin. People who have diabetes need this test regularly to see if their levels are staying within range. It can tell if you need to adjust your diabetes medicines. The A1c test is also used to diagnose diabetes.";
  
  const uricAcid = data.uricAcid || {
    value: "",
    status: "",
  };
  const uricAcidDescription = "A uric acid test measures the levels of uric acid in the blood. High levels can indicate conditions such as gout, kidney disease, or kidney stones.";
  
  const colorVision = data.colorVision || {
    value: "",
    status: "",
  };
  
  const perceivedStress = data.perceivedStress || {
    value: "",
    status: "",
  };
  const perceivedStressDescription = "The objective of this project is to develop an interactive application that allows users to measure their perceived stress levels using the Perceived Stress Scale (PSS). The application will provide users with their PSS score and categorize their stress levels as low, moderate, or high based on their responses to the scale.";
  
  const fatigueAssessment = data.fatigueAssessment || {
    value: "",
    status: "",
  };
  const fatigueAssessmentDescription = "The Fatigue Assessment Scale (FAS) is a 10-item questionnaire designed to evaluate symptoms of chronic fatigue. This document outlines the business requirements for implementing the FAS in a digital format.";
  
  const tuberculosisTest = data.tuberculosisTest || {
    value: "",
    recommendation: "",
  };
  
  const mentalHealth = data.mentalHealth || {
    depression: "",
    anxiety: "",
  };
  
  const ayurvedicTest = data.ayurvedicTest || {
    result: "",
  };
  
  const spirometerTest = data.spirometerTest || {
    diagnosis: "",
    fvc: { predictivePercent: "", predictiveValue: "", measuredValue: "" },
    pef: { predictivePercent: "", predictiveValue: "", measuredValue: "" },
    fev1: { predictivePercent: "", predictiveValue: "", measuredValue: "" },
    fev1Fvc: { predictivePercent: "", predictiveValue: "", measuredValue: "" },
  };
  
  const audiometry = data.audiometry || {
    leftEarGraph: "",
    rightEarGraph: "",
  };
  
  const disclaimer = `• This report is not intended to replace but to lead by providing comprehensive information. It is recommended that you consult your doctor/physician for interpretation of results.\n
• All reports might not be applicable for individuals less than 18, pregnant women or individuals suffering from diseases for which health test has not been performed or symptoms not diagnosed.\n
• This report is based on preventive health test screening and is meant for a healthy lifestyle. It does not provide any recommendation for life threatening situations.\n
• It is strongly recommended to take required precautions for allergic reactions or sensitivities.\n
• Online screening tools are not diagnostic instruments. You are encouraged to share your results with a physician or healthcare provider.\n
• The content is provided for information purposes only in believed to be serving as a preventive health screening and is not intended as and should not be considered to a legal or financial advice.\n
• References and links to third parties do not constitute any endorsements or warranty by this report generated at the Health Kiosk. The health ATM hereby disclaims all express and implied warranties of any kind.\n
`;

  // Health indicators data (icons will be added manually, these are placeholders)
  const healthIndicators = data.healthIndicators || [];

  return {
    pageSize: "A4",
    pageMargins: [0, 60, 0, 40], // Top margin for header, bottom margin for footer

    // Header that appears at top of every page
    header: function (currentPage, pageCount) {
      return {
        stack: [
          // Header Background
          {
            canvas: [
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 595,
                h: 55,
                color: "white",
              },
            ],
          },
          // Header Content
          {
            columns: [
              // Logo
              {
                text: [
                  { text: "ciana", color: "#CB003F", bold: true },
                  { text: "health", color: "#3C678C", bold: true },
                ],
                fontSize: 14,
                margin: [20, -42, 0, 0],
              },
              // Smart Report Title
              {
                stack: [
                  {
                    text: "Smart Report",
                    color: "#3C678C",
                    bold: true,
                    fontSize: 12,
                    alignment: "right",
                  },
                  {
                    text: "HEALTH ANALYSIS",
                    color: "#3C678C",
                    fontSize: 8,
                    alignment: "right",
                    margin: [0, 2, 0, 0],
                  },
                ],
                margin: [0, -48, 25, 0],
              },
            ],
          },
          // Separator line
          {
            canvas: [
              {
                type: "line",
                x1: 25,
                y1: 0,
                x2: 570,
                y2: 0,
                lineWidth: 0.5,
                lineColor: "#E0E0E0",
              },
            ],
            margin: [0, 0, 0, 0],
          },
        ],
      };
    },

    // Footer that appears at bottom of every page
    footer: function (currentPage, pageCount) {
      return {
        stack: [
          {
            canvas: [
              // White background
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 595,
                h: 40,
                color: "#fff",
              },
              // Top border
              {
                type: "line",
                x1: 0,
                y1: 0,
                x2: 595,
                y2: 0,
                lineWidth: 2,
                lineColor: "#CB003F",
              },
            ],
          },
          {
            text: "Powered by",
            color: "black",
            fontSize: 8,
            alignment: "center",
            margin: [0, -32, 0, 0],
          },
          {
            text: "aciana",
            color: "#CB003F",
            fontSize: 15,
            bold: true,
            alignment: "center",
            margin: [0, 0, 0, 0],
          },
        ],
      };
    },

    // Background for the page
    background: function (currentPage) {
      return [];
    },

    content: [
      // ============ PAGE 1: OVERVIEW ============

      // Main content with two columns
      {
        columns: [
          // Left column - Report info and Vital Parameters
          {
            stack: [
              {
                text: "HEALTH ANALYSIS",
                fontSize: 7,
                color: "#888",
                margin: [0, 15, 0, 3],
              },
              {
                text: "Personalized Summary & Vital Parameters",
                fontSize: 12,
                bold: true,
                margin: [0, 0, 0, 15],
              },
              {
                text: [
                  { text: "Congratulations, ", bold: true, color: "black" },
                  {
                    text: "We have successfully completed your health diagnosis. This is a big step towards staying on top of your health and identify potential to improve!",
                  },
                ],
                fontSize: 8,
                lineHeight: 1.4,
                margin: [0, 0, 10, 10],
              },
              {
                text: "Below are the health parameters which require routine checkups for primary healthcare.",
                fontSize: 8,
                lineHeight: 1.4,
                margin: [0, 0, 10, 20],
              },

              // Vital Parameters Row
              {
                columns: [
                  // Height
                  {
                    stack: [
                      // Background box
                      {
                        canvas: [
                          {
                            type: "rect",
                            x: 0,
                            y: 0,
                            w: 110,
                            h: 50,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      // Icon and text in columns
                      {
                        columns: [
                          // Icon
                          {
                            image: getImagePath("height.png"),
                            width: 35,
                            height: 35,
                          },
                          // Label and value
                          {
                            stack: [
                              {
                                text: "Height",
                                fontSize: 8,
                                color: "#666",
                                margin: [0, 5, 0, 0],
                              },
                              {
                                text: height,
                                fontSize: 14,
                                bold: true,
                                margin: [0, 2, 0, 0],
                              },
                            ],
                            width: "*",
                          },
                        ],
                        margin: [5, -45, 5, 0],
                      },
                    ],
                    width: 120,
                  },
                  // Weight
                  {
                    stack: [
                      // Background box
                      {
                        canvas: [
                          {
                            type: "rect",
                            x: 0,
                            y: 0,
                            w: 110,
                            h: 50,
                            color: "#E3F2FD",
                          },
                        ],
                      },
                      // Icon and text in columns
                      {
                        columns: [
                          // Icon box
                          {
                            image: getImagePath("weight.png"),
                            width: 35,
                            height: 35,
                          },
                          // Label and value
                          {
                            stack: [
                              {
                                text: "Weight",
                                fontSize: 8,
                                color: "#666",
                                margin: [5, 5, 0, 0],
                              },
                              {
                                text: weight,
                                fontSize: 14,
                                bold: true,
                                margin: [5, 2, 0, 0],
                              },
                            ],
                            width: "*",
                          },
                        ],
                        margin: [5, -45, 5, 0],
                      },
                    ],
                    width: 120,
                  },
                  // BMI
                  {
                    stack: [
                      // Background box
                      {
                        canvas: [
                          {
                            type: "rect",
                            x: 0,
                            y: 0,
                            w: 110,
                            h: 50,
                            color: "#FFF8E1",
                          },
                        ],
                      },
                      // Icon and text in columns
                      {
                        columns: [
                          // Icon box
                          {
                            image: getImagePath("bmi.png"),
                            width: 35,
                            height: 35,
                          },
                          // Label and value
                          {
                            stack: [
                              {
                                text: "BMI",
                                fontSize: 8,
                                color: "#666",
                                margin: [5, 5, 0, 0],
                              },
                              {
                                text: bmi,
                                fontSize: 14,
                                bold: true,
                                margin: [5, 2, 0, 0],
                              },
                            ],
                            width: "*",
                          },
                        ],
                        margin: [5, -45, 5, 0],
                      },
                    ],
                    width: 120,
                  },
                ],
                margin: [0, 0, 0, 0],
              },
            ],
            width: "55%",
            margin: [25, 0, 0, 0],
          },

          // Right column - Patient info and Health Score
          {
            stack: [
              // Patient Name
              {
                text: patientName,
                fontSize: 11,
                bold: true,
                alignment: "right",
                margin: [0, 15, 0, 3],
              },
              // Patient Details
              {
                text: `${age} | ${dob} | ${gender} | ${reportDate}`,
                fontSize: 7,
                color: "#666",
                alignment: "right",
                margin: [0, 0, 0, 15],
              },

              // Health Score Box
              {
                stack: [
                  // Orange background box
                  {
                    canvas: [
                      {
                        type: "rect",
                        x: 0,
                        y: 0,
                        w: 140,
                        h: 140,
                        color: "#FF6D00",
                      },
                    ],
                  },
                  // Health Score Title
                  {
                    text: "Your Health Score",
                    color: "white",
                    fontSize: 10,
                    bold: true,
                    alignment: "center",
                    margin: [100, -130, 0, 0],
                  },
                  // Score circle
                  {
                    canvas: [
                      {
                        type: "ellipse",
                        x: 70,
                        y: 35,
                        r1: 35,
                        r2: 35,
                        lineColor: "white",
                        lineWidth: 2,
                      },
                    ],
                    margin: [0, 10, 18, 0],
                  },
                  // Score value (N/A) - positioned inside ellipse
                  {
                    text: healthScore,
                    color: "white",
                    fontSize: 16,
                    bold: true,
                    alignment: "center",
                    margin: [100, -50, 0, 0],
                  },
                  // Out of total - positioned inside ellipse below score
                  {
                    text: `Out of ${healthScoreTotal}`,
                    color: "white",
                    fontSize: 9,
                    alignment: "center",
                    margin: [100, 0, 0, 0],
                  },
                  // Note at bottom
                  {
                    text: "*Calculated from test reports",
                    color: "white",
                    fontSize: 10,
                    alignment: "center",
                    bold: true,
                    margin: [100, 40, 0, 0],
                  },
                ],
                alignment: "right",
                margin: [0, 0, 0, 0],
              },
            ],
            width: "45%",
            margin: [0, 0, 25, 0],
          },
        ],
      },

      // Body Diagram Section with Health Indicators
      {
        columns: [
          // Left indicators
          {
            stack: [
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("eye.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Right Eye | Left Eye",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("bone.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Bone Mineral Density",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("blood-cells.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Hemoglobin",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("glucose.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Glucose (Random)",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("diabetes.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "HBA1C",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
            ],
            width: "25%",
            margin: [25, 30, 0, 0],
          },
          // Center - Body Diagram Placeholder
          {
            stack: [
              {
                image:
                  gender === "Male"
                    ? getImagePath("human.png")
                    : getImagePath("woman.png"),
                width: 300,
                height: 450,
              },
            ],
            width: "50%",
            alignment: "center",
            margin: [0, 20, 0, 0],
          },
          // Right indicators
          {
            stack: [
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("blood-pressure.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Blood Pressure",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("cholesterol.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Total Cholesterol",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("heart-rate.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Heart Rate",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("fat.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Lean body weight",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
              {
                columns: [
                  {
                    stack: [
                      {
                        canvas: [
                          {
                            type: "ellipse",
                            x: 20,
                            y: 20,
                            r1: 20,
                            r2: 20,
                            color: "#FFF3E0",
                          },
                        ],
                      },
                      {
                        image: getImagePath("muscles.png"),
                        width: 25,
                        height: 25,
                        margin: [8, -32, 0, 0],
                      },
                    ],
                    width: 45,
                  },
                  {
                    stack: [
                      {
                        text: "Physique",
                        fontSize: 8,
                        color: "#333",
                      },
                      {
                        text: "Test not taken",
                        fontSize: 7,
                        color: "#999",
                        margin: [0, 2, 0, 0],
                      },
                    ],
                    margin: [5, 10, 0, 0],
                  },
                ],
                margin: [0, 20, 0, 50],
              },
            ],
            width: "25%",
            margin: [10, 30, 0, 0],
          },
        ],
      },

      // Page break to page 2
      {
        text: "",
        pageBreak: "after",
      },

      // ============ PAGE 2: TEST RESULTS ============

      // Oxygen Saturation
      ...createHealthCard({
        icon: "o2.png",
        label: "Oxygen saturation",
        dataObj: oxygenSaturation,
        description: oxygenSaturationDescription,
        fillColorFn: fillColors.normalOrRed,
        statusBarFn: () => createTwoZoneBar({
          value: oxygenSaturation.value, defaultValue: 94, threshold: 95,
          minRange: 85, maxRange: 100,
          zones: [
            { label: "Low", color: "#EF5350", labelMargin: [90, 6, 0, 0] },
            { label: "Normal", color: "#4CAF50", labelMargin: [0, 6, 90, 0] },
          ],
        }),
      }),

      // Body Fat
      ...createHealthCard({
        icon: "fat.png",
        label: "Body Fat",
        dataObj: bodyFat,
        description: bodyFatDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: bodyFat.value, defaultValue: 25,
          lowThreshold: 21, highThreshold: 30, maxRange: 50,
        }),
      }),

      // Subcutaneous Fat
      ...createHealthCard({
        icon: "fat.png",
        label: "Subcutaneous fat",
        dataObj: subcutaneousFat,
        description: subcutaneousFatDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: subcutaneousFat.value, defaultValue: 15,
          lowThreshold: 10, highThreshold: 20, maxRange: 40,
        }),
      }),

      // Visceral Fat
      ...createHealthCard({
        icon: "fat.png",
        label: "Visceral fat",
        dataObj: visceralFat,
        description: visceralFatDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: visceralFat.value, defaultValue: 8,
          lowThreshold: 1, highThreshold: 12, maxRange: 30,
        }),
      }),

      // Body Water
      ...createHealthCard({
        icon: "fat.png",
        label: "Body Water",
        dataObj: bodyWater,
        description: bodyWaterDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: bodyWater.value, defaultValue: 55,
          lowThreshold: 50, highThreshold: 65, maxRange: 80,
          zones: [
            { label: "Low", color: "#2196F3" },
            { label: "Normal", color: "#4CAF50" },
            { label: "High", color: "#1B5E20" },
          ],
        }),
      }),

      // Skeletal Muscle
      ...createHealthCard({
        icon: "fat.png",
        label: "Skeletal Muscle",
        dataObj: skeletalMuscle,
        description: skeletalMuscleDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: skeletalMuscle.value, defaultValue: 30,
          lowThreshold: 25, highThreshold: 35, maxRange: 50,
          zones: [
            { label: "Low", color: "#2196F3" },
            { label: "Normal", color: "#4CAF50" },
            { label: "High", color: "#1B5E20" },
          ],
        }),
      }),

      // Muscle Mass
      ...createHealthCard({
        icon: "fat.png",
        label: "Muscle Mass",
        dataObj: muscleMass,
        description: muscleMassDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: muscleMass.value, defaultValue: 30,
          lowThreshold: 25, highThreshold: 35, maxRange: 50,
          zones: [
            { label: "Low", color: "#2196F3" },
            { label: "Normal", color: "#4CAF50" },
            { label: "High", color: "#1B5E20" },
          ],
        }),
      }),

      // Bone Mass
      ...createHealthCard({
        icon: "fat.png",
        label: "Bone Mass",
        dataObj: boneMass,
        description: boneMassDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: boneMass.value, defaultValue: 3,
          lowThreshold: 2, highThreshold: 4, maxRange: 6,
          zones: [
            { label: "Low", color: "#2196F3" },
            { label: "Normal", color: "#4CAF50" },
            { label: "High", color: "#1B5E20" },
          ],
        }),
      }),

      // Protein
      ...createHealthCard({
        icon: "fat.png",
        label: "Protein",
        dataObj: protein,
        description: proteinDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: protein.value, defaultValue: 7,
          lowThreshold: 6.4, highThreshold: 8.3, maxRange: 12,
          zones: [
            { label: "Low", color: "#2196F3" },
            { label: "Normal", color: "#4CAF50" },
            { label: "High", color: "#1B5E20" },
          ],
        }),
      }),

      // BMR
      ...createHealthCard({
        icon: "fat.png",
        label: "Basal Metabolic rate (BMR)",
        dataObj: bmr,
        description: bmrDescription,
        fillColorFn: fillColors.normalOrRed,
        statusBarFn: () => createTwoZoneBar({
          value: bmr.value, defaultValue: 1400, threshold: 1200,
          minRange: 800, maxRange: 2500,
          zones: [
            { label: "Low", color: "#EF5350", labelMargin: [90, 6, 0, 0] },
            { label: "Normal", color: "#4CAF50", labelMargin: [0, 6, 90, 0] },
          ],
        }),
      }),

      // Metabolic Age
      ...createHealthCard({
        icon: "fat.png",
        label: "Metabolic Age",
        dataObj: metabolicAge,
        description: metabolicAgeDescription,
        fillColorFn: fillColors.normalOrRed,
        statusBarFn: () => createTwoZoneBar({
          value: metabolicAge.value, defaultValue: 25, threshold: parseFloat(age) || 30,
          minRange: 15, maxRange: 80,
          zones: [
            { label: "Normal", color: "#4CAF50", labelMargin: [90, 6, 0, 0] },
            { label: "Not upto normal", color: "#EF5350", labelMargin: [0, 6, 90, 0] },
          ],
        }),
      }),

      // Body Temperature
      ...createHealthCard({
        icon: "fat.png",
        label: "Body temperature",
        dataObj: bodyTemperature,
        description: bodyTemperatureDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: bodyTemperature.value, defaultValue: 25,
          lowThreshold: 35.5, highThreshold: 37.2, maxRange: 42,
        }),
      }),

      // BP Systolic
      ...createHealthCard({
        icon: "fat.png",
        label: "Blood pressure (Systolic)",
        dataObj: bpSystolic,
        description: bpSystolicDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: bpSystolic.value, defaultValue: 120,
          lowThreshold: 90, highThreshold: 139, maxRange: 200,
        }),
      }),

      // BP Diastolic
      ...createHealthCard({
        icon: "fat.png",
        label: "Blood pressure (Diastolic)",
        dataObj: bpDiastolic,
        description: bpDiastolicDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: bpDiastolic.value, defaultValue: 25,
          lowThreshold: 60, highThreshold: 89, maxRange: 200,
        }),
      }),

      // Pulse
      ...createHealthCard({
        icon: "fat.png",
        label: "Pulse",
        dataObj: pulse,
        description: pulseDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: pulse.value, defaultValue: 72,
          lowThreshold: 60, highThreshold: 100, maxRange: 200,
        }),
      }),

      // Hemoglobin
      ...createHealthCard({
        icon: "fat.png",
        label: "Hemoglobin",
        dataObj: hemoglobin,
        description: hemoglobinDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: hemoglobin.value, defaultValue: 14,
          lowThreshold: 11, highThreshold: 16, maxRange: 20,
        }),
      }),

      // Glucose (4-zone)
      ...createHealthCard({
        icon: "glucose.png",
        label: "Blood sugar (Post Prandial)",
        dataObj: glucose,
        description: glucoseDescription,
        fillColorFn: (status) =>
          status === "Normal" ? "#C8E6C9"
          : status === "Pre-Diabetic" ? "#FFF9C4"
          : "#FFCDD2",
        statusBarFn: () => createFourZoneBar({
          value: glucose.value, defaultValue: 100,
          thresholds: [80, 140, 200], maxRange: 400,
          zones: [
            { label: "Low", color: "#2196F3" },
            { label: "Normal", color: "#4CAF50" },
            { label: "Pre-Diabetic", color: "#FFC107" },
            { label: "Diabetic", color: "#EF5350" },
          ],
        }),
      }),

      // Uric Acid
      ...createHealthCard({
        icon: "fat.png",
        label: "Uric Acid",
        dataObj: uricAcid,
        description: uricAcidDescription,
        fillColorFn: fillColors.lowNormalHigh,
        statusBarFn: () => createThreeZoneBar({
          value: uricAcid.value, defaultValue: 5,
          lowThreshold: 2.4, highThreshold: 7, maxRange: 12,
        }),
      }),

      // Left Eye
      ...createSimpleCard({
        icon: "eye.png",
        label: "Left Eye",
        dataObj: leftEye,
        description: leftEyeDescription,
        fillColorFn: fillColors.normalOrRedSimple,
        margin: [25, 20, 25, 10],
      }),

      // Right Eye
      ...createSimpleCard({
        icon: "eye.png",
        label: "Right Eye",
        dataObj: rightEye,
        description: rightEyeDescription,
        fillColorFn: fillColors.normalOrRedSimple,
        margin: [25, 10, 25, 20],
      }),

      // Lipid and HbA1c Test Title
      ...((totalCholesterol.value || triglycerides.value || hdlCholesterol.value || nonHdlCholesterol.value || ldlCholesterol.value || cholesterolRatio.value || hba1c.value)
        ? [{ text: "Lipid and HbA1c Test", fontSize: 14, bold: true, color: "#3C678C", alignment: "center", margin: [25, 20, 25, 15] }]
        : []),

      // Total Cholesterol
      ...createLipidCard({
        icon: "cholesterol.png",
        label: "Total Cholesterol",
        dataObj: totalCholesterol,
        description: totalCholesterolDescription,
        fillColorFn: (status) =>
          status === "Desirable" ? "#C8E6C9"
          : status === "Borderline High" ? "#FFC107"
          : "#FFCDD2",
        statusBarFn: () => {
          const bar = createThreeZoneBar({
            value: totalCholesterol.value, defaultValue: 200,
            lowThreshold: 200, highThreshold: 239, maxRange: 300,
            zones: [
              { label: "Desirable", color: "#4CAF50" },
              { label: "Borderline High", color: "#FFC107" },
              { label: "High", color: "#EF5350" },
            ],
            labelFontSize: 9,
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // Triglycerides
      ...createLipidCard({
        icon: "cholesterol.png",
        label: "Triglycerides",
        dataObj: triglycerides,
        description: triglyceridesDescription,
        fillColorFn: (status) =>
          status === "Desirable" ? "#C8E6C9"
          : status === "Border Line" ? "#FFC107"
          : "#FFCDD2",
        statusBarFn: () => {
          const bar = createThreeZoneBar({
            value: triglycerides.value, defaultValue: 100,
            lowThreshold: 150, highThreshold: 199, maxRange: 300,
            zones: [
              { label: "Desirable", color: "#4CAF50" },
              { label: "Border Line", color: "#FFC107" },
              { label: "High", color: "#EF5350" },
            ],
            labelFontSize: 9,
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // HDL Cholesterol
      ...createLipidCard({
        icon: "cholesterol.png",
        label: "High-density lipo-protein (HDL) cholesterol",
        dataObj: hdlCholesterol,
        description: hdlCholesterolDescription,
        fillColorFn: (status) =>
          status === "Desirable" ? "#09922e"
          : status === "Normal" ? "#C8E6C9"
          : "#E3F2FD",
        margin: [25, 10, 25, 20],
        labelFontSize: 10,
        iconWidth: "50%",
        valueWidth: "20%",
        statusWidth: "25%",
        statusBarFn: () => {
          const bar = createThreeZoneBar({
            value: hdlCholesterol.value, defaultValue: 50,
            lowThreshold: 40, highThreshold: 60, maxRange: 100,
            zones: [
              { label: "Low", color: "#2196F3" },
              { label: "Normal", color: "#4CAF50" },
              { label: "Desirable", color: "#09922e" },
            ],
            labelFontSize: 9,
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // Non-HDL Cholesterol
      ...createLipidCard({
        icon: "cholesterol.png",
        label: "Non-high-density lipo-protein (NON-HDL) cholesterol",
        dataObj: nonHdlCholesterol,
        description: nonHdlCholesterolDescription,
        fillColorFn: (status) =>
          (status === "Desirable" || status === "desirable") ? "#C8E6C9"
          : status === "Border Line" ? "#FFC107"
          : "#FFCDD2",
        labelFontSize: 9,
        iconWidth: "50%",
        valueWidth: "20%",
        statusWidth: "25%",
        statusBarFn: () => {
          const bar = createThreeZoneBar({
            value: nonHdlCholesterol.value, defaultValue: 130,
            lowThreshold: 159, highThreshold: 179, maxRange: 250,
            zones: [
              { label: "Desirable", color: "#4CAF50" },
              { label: "Border Line", color: "#FFC107" },
              { label: "High", color: "#EF5350" },
            ],
            labelFontSize: 9,
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // LDL Cholesterol (4-zone)
      ...createLipidCard({
        icon: "cholesterol.png",
        label: "Low-density lipo-protein (LDL) cholesterol",
        dataObj: ldlCholesterol,
        description: ldlCholesterolDescription,
        fillColorFn: (status) =>
          status === "Optimal" ? "#C8E6C9"
          : status === "Near Optimal" ? "#FFC107"
          : status === "Slightly High" ? "#FFCC80"
          : "#FFCDD2",
        labelFontSize: 10,
        iconWidth: "50%",
        valueWidth: "20%",
        statusWidth: "25%",
        statusBarFn: () => {
          const bar = createFourZoneBar({
            value: ldlCholesterol.value, defaultValue: 100,
            thresholds: [100, 129, 159], maxRange: 200,
            zones: [
              { label: "Optimal", color: "#4CAF50" },
              { label: "Near Optimal", color: "#FFC107" },
              { label: "Slightly High", color: "#FF9800" },
              { label: "High", color: "#EF5350" },
            ],
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // Cholesterol Ratio
      ...createLipidCard({
        icon: "cholesterol.png",
        label: "Total CHOL/HDL Cholesterol ratio",
        dataObj: cholesterolRatio,
        description: cholesterolRatioDescription,
        fillColorFn: fillColors.lowNormalHigh,
        iconWidth: "50%",
        valueWidth: "20%",
        statusWidth: "25%",
        statusBarFn: () => {
          const bar = createThreeZoneBar({
            value: cholesterolRatio.value, defaultValue: 4,
            lowThreshold: 3.5, highThreshold: 5, maxRange: 8,
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // HBA1C (4-zone)
      ...createLipidCard({
        icon: "cholesterol.png",
        label: "HBA1C",
        dataObj: hba1c,
        description: hba1cDescription,
        fillColorFn: (status) =>
          status === "Normal" ? "#C8E6C9"
          : status === "Pre-Diabetic" ? "#FFF9C4"
          : "#FFCDD2",
        statusBarFn: () => {
          const bar = createFourZoneBar({
            value: hba1c.value, defaultValue: 5.5,
            thresholds: [4.0, 5.6, 6.4], maxRange: 14,
            zones: [
              { label: "Low", color: "#2196F3" },
              { label: "Normal", color: "#4CAF50" },
              { label: "Pre-Diabetic", color: "#FFC107" },
              { label: "Diabetic", color: "#EF5350" },
            ],
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // Color Vision
      ...(colorVision.value
        ? [{
            table: {
              widths: ["*"],
              body: [
                [{
                  columns: [{
                    columns: [
                      { image: getImagePath("eye.png"), width: 28, height: 28 },
                      { text: "Color Vision", fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                    ],
                    width: "*",
                    margin: [10, 10, 0, 0],
                  }],
                  fillColor: "#C8E6C9",
                  margin: [0, 0, 0, 0],
                }],
                [{
                  stack: [
                    { text: "You Might Have", fontSize: 11, color: "#555", alignment: "center", margin: [0, 30, 0, 10] },
                    { text: colorVision.value || "Normal Vision", fontSize: 24, bold: true, color: "#333", alignment: "center", margin: [0, 0, 0, 40] },
                  ],
                  fillColor: "#F5F5F5",
                }],
              ],
            },
            layout: noLineLayout,
            margin: [25, 10, 25, 10],
          }]
        : []),

      // Perceived Stress Scale
      ...createLipidCard({
        icon: "glucose.png",
        label: "Perceived Stress Scale (PSS)",
        dataObj: perceivedStress,
        description: perceivedStressDescription,
        fillColorFn: (status) =>
          status === "Normal" ? "#C8E6C9"
          : status === "Moderate" ? "#FFF9C4"
          : "#FFCDD2",
        margin: [25, 10, 25, 20],
        iconWidth: "45%",
        valueWidth: "25%",
        statusWidth: "25%",
        statusBarFn: () => {
          const bar = createThreeZoneBar({
            value: perceivedStress.value, defaultValue: 10,
            lowThreshold: 13, highThreshold: 26, maxRange: 40, barWidth: 500,
            zones: [
              { label: "Normal", color: "#4CAF50" },
              { label: "Moderate", color: "#FFC107" },
              { label: "Severe", color: "#C62828" },
            ],
            labelFontSize: 9,
          });
          bar.margin = [10, 0, 10, 15];
          return bar;
        },
      }),

      // Fatigue Assessment Scale
      ...(fatigueAssessment.value
        ? [{
            table: {
              widths: ["*"],
              body: [
                [{
                  columns: [
                    {
                      columns: [
                        { image: getImagePath("glucose.png"), width: 28, height: 28 },
                        { text: "Fatigue Assessment Scale (FAS)", fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                      ],
                      width: "45%",
                      margin: [10, 10, 0, 0],
                    },
                    { text: fatigueAssessment.value, fontSize: 13, bold: true, color: "#000", alignment: "center", width: "25%", margin: [0, 16, 0, 0] },
                    { text: fatigueAssessment.status, fontSize: 11, bold: true, color: "#000", alignment: "right", width: "25%", margin: [0, 16, 10, 0] },
                  ],
                  fillColor: "#FFF9C4",
                  margin: [0, 0, 0, 0],
                }],
                [{
                  stack: [
                    { text: fatigueAssessmentDescription, fontSize: 9, color: "#555", lineHeight: 1.5, margin: [10, 15, 10, 15] },
                    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 1, lineColor: "#E0E0E0" }], margin: [10, 0, 10, 15] },
                    (() => {
                      const bar = createThreeZoneBar({
                        value: fatigueAssessment.value, defaultValue: 20,
                        lowThreshold: 22, highThreshold: 34, maxRange: 50, barWidth: 500,
                        zones: [
                          { label: "Normal", color: "#4CAF50" },
                          { label: "Moderate", color: "#FFC107" },
                          { label: "Severe", color: "#C62828" },
                        ],
                        labelFontSize: 9,
                      });
                      bar.margin = [10, 0, 10, 15];
                      return bar;
                    })(),
                  ],
                  fillColor: "#F5F5F5",
                }],
              ],
            },
            layout: noLineLayout,
            margin: [25, 10, 25, 10],
          }]
        : []),

      // Tuberculosis Test
      ...(tuberculosisTest.value
        ? [{
            table: {
              widths: ["*"],
              body: [
                [{
                  columns: [{
                    columns: [
                      { image: getImagePath("eye.png"), width: 28, height: 28 },
                      { text: "Tuberculosis Test", fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                    ],
                    width: "*",
                    margin: [10, 10, 0, 0],
                  }],
                  fillColor: "#C8E6C9",
                  margin: [0, 0, 0, 0],
                }],
                [{
                  stack: [
                    {
                      columns: [
                        { text: "Result :", fontSize: 14, bold: true, color: "#333", width: "auto" },
                        { text: tuberculosisTest.value || "Negative", fontSize: 12, color: "#fff", background: "#607D8B", margin: [10, 2, 0, 0], width: "auto" },
                      ],
                      margin: [10, 20, 10, 15],
                    },
                    {
                      columns: [
                        { text: "Recommendation :", fontSize: 12, bold: true, color: "#333", width: "auto" },
                        { text: "Continue to monitor your health. If you have any concerns or develop symptoms, consult a healthcare professional for further advice.", fontSize: 10, color: "#555", margin: [5, 0, 10, 0], width: "*" },
                      ],
                      margin: [10, 0, 10, 30],
                    },
                  ],
                  fillColor: "#F5F5F5",
                }],
              ],
            },
            layout: noLineLayout,
            margin: [25, 10, 25, 10],
          }]
        : []),

      // Mental Health Assessment
      ...((mentalHealth.depression || mentalHealth.anxiety)
        ? [{
            table: {
              widths: ["*"],
              body: [
                [{
                  columns: [{
                    columns: [
                      { image: getImagePath("eye.png"), width: 28, height: 28 },
                      { text: "Mental Health Assessment", fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                    ],
                    width: "*",
                    margin: [10, 10, 0, 0],
                  }],
                  fillColor: "#FFCDD2",
                  margin: [0, 0, 0, 0],
                }],
                [{
                  stack: [{
                    table: {
                      widths: ["auto", "auto"],
                      body: [
                        [
                          { text: "Level of Depression", fontSize: 11, color: "#333", margin: [10, 10, 20, 10], border: [false, false, false, true] },
                          { text: mentalHealth.depression || "Minimal", fontSize: 11, color: "#fff", fillColor: "#81C784", alignment: "center", margin: [15, 10, 15, 10], border: [false, false, false, true] },
                        ],
                        [
                          { text: "Level of Anxiety", fontSize: 11, color: "#333", margin: [10, 10, 20, 10], border: [false, false, false, false] },
                          { text: mentalHealth.anxiety || "Mild", fontSize: 11, color: "#fff", fillColor: "#EF9A9A", alignment: "center", margin: [15, 10, 15, 10], border: [false, false, false, false] },
                        ],
                      ],
                    },
                    layout: {
                      hLineWidth: (i) => (i === 1 ? 1 : 0),
                      vLineWidth: () => 0,
                      hLineColor: () => "#E0E0E0",
                    },
                    alignment: "center",
                    margin: [150, 30, 0, 40],
                  }],
                  fillColor: "#F5F5F5",
                }],
              ],
            },
            layout: noLineLayout,
            margin: [25, 10, 25, 20],
          }]
        : []),

      // Ayurvedic Test
      ...(ayurvedicTest.result
        ? [{
            table: {
              widths: ["*"],
              body: [
                [{
                  columns: [{
                    columns: [
                      { image: getImagePath("eye.png"), width: 28, height: 28 },
                      { text: "Ayurvedic Test", fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                    ],
                    width: "*",
                    margin: [10, 10, 0, 0],
                  }],
                  fillColor: "#C8E6C9",
                  margin: [0, 0, 0, 0],
                }],
                [{
                  stack: [{
                    columns: [
                      { text: "Result :", fontSize: 14, bold: true, color: "#333", width: "auto", margin: [0, 0, 10, 0] },
                      { text: ayurvedicTest.result, fontSize: 11, color: "#333", fillColor: "#C8E6C9", margin: [10, 3, 10, 3], width: "auto" },
                    ],
                    margin: [30, 40, 10, 50],
                  }],
                  fillColor: "#F5F5F5",
                }],
              ],
            },
            layout: noLineLayout,
            margin: [25, 10, 25, 10],
          }]
        : []),

      // Spirometer Test
      ...(spirometerTest.diagnosis
        ? [{
            table: {
              widths: ["*"],
              body: [
                [{
                  columns: [{
                    columns: [
                      { image: getImagePath("eye.png"), width: 28, height: 28 },
                      { text: "Spirometer Test", fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                    ],
                    width: "*",
                    margin: [10, 10, 0, 0],
                  }],
                  fillColor: "#C8E6C9",
                  margin: [0, 0, 0, 0],
                }],
                [{
                  stack: [
                    {
                      columns: [
                        { text: "Suggested Diagnosis :", fontSize: 13, color: "#333", width: "auto", margin: [150, 0, 0, 0] },
                        { text: spirometerTest.diagnosis, fontSize: 13, bold: true, color: "#333", margin: [-200, 0, 0, 0], width: "*" },
                      ],
                      alignment: "center",
                      margin: [0, 25, 0, 20],
                    },
                    {
                      table: {
                        headerRows: 1,
                        widths: ["*", "*", "*", "*"],
                        body: [
                          [
                            { text: "Parameter", fontSize: 10, bold: true, color: "#333", alignment: "center", margin: [0, 8, 0, 8] },
                            { text: "Predictive %", fontSize: 10, bold: true, color: "#333", alignment: "center", margin: [0, 8, 0, 8] },
                            { text: "Predictive Value", fontSize: 10, bold: true, color: "#333", alignment: "center", margin: [0, 8, 0, 8] },
                            { text: "Measured Value", fontSize: 10, bold: true, color: "#333", alignment: "center", margin: [0, 8, 0, 8] },
                          ],
                          ...["fvc", "pef", "fev1", "fev1Fvc"].map((key) => {
                            const labels = { fvc: "FVC", pef: "PEF", fev1: "FEV1", fev1Fvc: "FEV1/FVC" };
                            const d = spirometerTest[key] || {};
                            return [
                              { text: labels[key], fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                              { text: d.predictivePercent || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                              { text: d.predictiveValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                              { text: d.measuredValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                            ];
                          }),
                        ],
                      },
                      layout: {
                        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 1),
                        vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 1 : 1),
                        hLineColor: () => "#E0E0E0",
                        vLineColor: () => "#E0E0E0",
                      },
                      margin: [20, 0, 20, 25],
                    },
                  ],
                  fillColor: "#F5F5F5",
                }],
              ],
            },
            layout: noLineLayout,
            margin: [25, 10, 25, 20],
          }]
        : []),

      // Audiometry
      ...((audiometry.leftEarGraph || audiometry.rightEarGraph)
        ? [{
            table: {
              widths: ["*"],
              body: [
                [{
                  columns: [{
                    columns: [
                      { image: getImagePath("eye.png"), width: 28, height: 28 },
                      { text: "Audiometry", fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                    ],
                    width: "*",
                    margin: [10, 10, 0, 0],
                  }],
                  fillColor: "#C8E6C9",
                  margin: [0, 0, 0, 0],
                }],
                [{
                  stack: [
                    ...(audiometry.leftEarGraph
                      ? [
                          { image: audiometry.leftEarGraph, width: 500, alignment: "center", margin: [20, 20, 20, 5] },
                          { text: "Left Ear", fontSize: 11, color: "#333", alignment: "center", margin: [0, 0, 0, 15] },
                        ]
                      : []),
                    ...(audiometry.rightEarGraph
                      ? [
                          { image: audiometry.rightEarGraph, width: 500, alignment: "center", margin: [20, 10, 20, 5] },
                          { text: "Right Ear", fontSize: 11, color: "#333", alignment: "center", margin: [0, 0, 0, 15] },
                        ]
                      : []),
                  ],
                  fillColor: "#F5F5F5",
                }],
              ],
            },
            layout: noLineLayout,
            margin: [25, 10, 25, 20],
          }]
        : []),
      // Disclaimer Section
      {
        stack: [
          // Pink background
          {
            canvas: [
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 545,
                h: 280,
                color: "#FFEBEE",
              },
              // Red left border
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 4,
                h: 280,
                color: "#D32F2F",
              },
            ],
            margin: [25, 30, 25, 0],
          },
          // Disclaimer title
          {
            text: "Disclaimer",
            fontSize: 11,
            bold: true,
            color: "#D32F2F",
            margin: [40, -260, 25, 10],
          },
          // Disclaimer content
          {
            text: disclaimer,
            fontSize: 7,
            color: "#666",
            lineHeight: 1.5,
            bold: true,
            margin: [40, 0, 35, 15],
          },
        ],
      },
    ],

    styles: {
      sectionHeader: {
        fontSize: 12,
        bold: true,
        margin: [0, 15, 0, 8],
      },
    },
    defaultStyle: {
      font: "Roboto",
    },
    info: {
      title: "Health Analysis Report",
      author: "cianahealth",
      subject: "Health Analysis Smart Report",
      creator: "PDF API using pdfmake",
    },
  };
}

/**
 * Generates a PDF and returns base64 string
 * @param {Object} docDefinition - PDF document definition
 * @returns {Promise<string>} Base64 encoded PDF
 */
function generatePdfBase64(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];

      pdfDoc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      pdfDoc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64String = pdfBuffer.toString("base64");
        resolve(base64String);
      });

      pdfDoc.on("error", (error) => {
        reject(error);
      });

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "PDF API is running" });
});

// Generate Health Analysis PDF endpoint (POST)
app.post("/api/generate-pdf", async (req, res) => {
  try {
    // Extract health report data from request body
    const requestBody = req.body;
    
    // Detect payload format and transform if needed
    let healthData;
    if (Array.isArray(requestBody.testCategories)) {
      // New format: { testCategories: [...], patientInfo: {...} }
      console.log("Detected new array-based payload format, transforming...");
      healthData = transformPayload(requestBody.testCategories, requestBody.patientInfo || {});
    } else if (Array.isArray(requestBody)) {
      // New format: Array directly at root level
      console.log("Detected array payload at root level, transforming...");
      healthData = transformPayload(requestBody, {});
    } else {
      // Old format: flat object
      console.log("Using legacy flat object payload format");
      healthData = requestBody;
    }
    
    // Extract optional PDF URLs to concatenate (as separate keys)
    const ecgPdfUrl = healthData.ecgPdfUrl || null;
    const labReportPdfUrl = healthData.labReportPdfUrl || null;
    const prescriptionPdfUrl = healthData.prescriptionPdfUrl || null;
    const xrayPdfUrl = healthData.xrayPdfUrl || null;
    const additionalPdfUrls = healthData.additionalPdfUrls || [];

    const docDefinition = createPdfDocDefinition(healthData);
    const base64Pdf = await generatePdfBase64(docDefinition);
    
    // Convert base64 to buffer for merging
    let mainPdfBuffer = Buffer.from(base64Pdf, "base64");
    
    // Collect all PDF URLs to fetch
    const pdfUrlsToFetch = [
      { name: "ECG", url: ecgPdfUrl },
      { name: "Lab Report", url: labReportPdfUrl },
      { name: "Prescription", url: prescriptionPdfUrl },
      { name: "X-Ray", url: xrayPdfUrl },
    ].filter(item => item.url); // Only keep items with URLs
    
    // Add any additional URLs from array
    additionalPdfUrls.forEach((url, index) => {
      pdfUrlsToFetch.push({ name: `Additional PDF ${index + 1}`, url });
    });
    
    // If external PDFs need to be concatenated
    if (pdfUrlsToFetch.length > 0) {
      const additionalPdfBuffers = [];
      
      // Fetch each PDF
      for (const { name, url } of pdfUrlsToFetch) {
        try {
          console.log(`Fetching ${name} PDF from: ${url}`);
          const pdfBuffer = await fetchPdfFromUrl(url);
          additionalPdfBuffers.push(pdfBuffer);
          console.log(`Successfully fetched ${name} PDF`);
        } catch (err) {
          console.error(`Failed to fetch ${name} PDF: ${err.message}`);
          // Continue without this PDF if fetch fails
        }
      }
      
      // Merge PDFs if we have any additional PDFs
      if (additionalPdfBuffers.length > 0) {
        console.log(`Merging ${additionalPdfBuffers.length} additional PDF(s)...`);
        mainPdfBuffer = await mergePdfs(mainPdfBuffer, additionalPdfBuffers);
        console.log(`PDF merge completed successfully`);
      }
    }
    
    // Convert final buffer back to base64
    const finalBase64 = mainPdfBuffer.toString("base64");

    res.json({
      success: true,
      message: "Health Analysis PDF generated successfully",
      data: {
        base64: finalBase64,
        mimeType: "application/pdf",
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(
    `🚀 Health Report PDF API server is running on http://localhost:${PORT}`
  );
  console.log(
    `📄 Generate Health Report: POST http://localhost:${PORT}/api/generate-pdf`
  );
  console.log(
    `❤️  Health Check:          GET  http://localhost:${PORT}/health`
  );
  console.log(
    `\n💡 Send POST request with health data or empty body for sample report`
  );
});
