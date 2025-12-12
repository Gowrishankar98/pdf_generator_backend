const express = require("express");
const PdfPrinter = require("pdfmake");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { PDFDocument } = require("pdf-lib");

// Helper function to get image path from assets folder (returns null if not found)
function getImagePath(imageName) {
  const imagePath = path.join(__dirname, "assets", imageName);
  return fs.existsSync(imagePath) ? imagePath : null;
}

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

      // Oxygen Saturation Section - Only render if value exists
      ...(oxygenSaturation.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Green header row
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("o2.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Oxygen saturation",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: oxygenSaturation.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: oxygenSaturation.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        oxygenSaturation.status === "Normal"
                          ? "#C8E6C9"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: oxygenSaturationDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar
                        (() => {
                          const oxygenValue =
                            parseFloat(oxygenSaturation.value) || 94;
                          const barWidth = 520;
                          const lowBarWidth = barWidth * 0.5;
                          const normalThreshold = 95;
                          const minRange = 85;
                          const maxRange = 100;

                          let pointerPosition;
                          if (oxygenValue < normalThreshold) {
                            pointerPosition =
                              ((oxygenValue - minRange) /
                                (normalThreshold - minRange)) *
                              lowBarWidth;
                          } else {
                            pointerPosition =
                              lowBarWidth +
                              ((oxygenValue - normalThreshold) /
                                (maxRange - normalThreshold + 1)) *
                                (barWidth - lowBarWidth);
                          }
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Value above pointer
                              {
                                columns: [
                                  {
                                    text: String(normalThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar
                              {
                                canvas: [
                                  // Red (Low) section
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Green (Normal) section
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: barWidth - lowBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "50%",
                                    margin: [90, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    alignment: "right",
                                    width: "50%",
                                    margin: [0, 6, 90, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Body Fat Section - Only render if value exists
      ...(bodyFat.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Body fat",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: bodyFat.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: bodyFat.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        bodyFat.status === "Normal"
                          ? "#C8E6C9"
                          : bodyFat.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: bodyFatDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(bodyFat.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 21;
                          const highThreshold = 30;
                          const maxRange = 50; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Subcutaneous fat
      ...(subcutaneousFat.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Subcutaneous fat",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: subcutaneousFat.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: subcutaneousFat.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        subcutaneousFat.status === "Normal"
                          ? "#C8E6C9"
                          : subcutaneousFat.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: subcutaneousFatDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue =
                            parseFloat(subcutaneousFat.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 18.5;
                          const highThreshold = 26.7;
                          const maxRange = 60; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Visceral fat
      ...(visceralFat.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Visceral fat",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: visceralFat.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: visceralFat.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        visceralFat.status === "Normal"
                          ? "#C8E6C9"
                          : visceralFat.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: visceralFatDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(visceralFat.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 9;
                          const highThreshold = 14;
                          const maxRange = 30; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Body Water
      ...(bodyWater.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Body water",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: bodyWater.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: bodyWater.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        bodyWater.status === "Normal"
                          ? "#C8E6C9"
                          : bodyWater.status === "Low"
                          ? "#E3F2FD"
                          : "#09922e",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: bodyWaterDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(bodyWater.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 45;
                          const highThreshold = 60;
                          const maxRange = 80; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#09922e",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Adequate",
                                    fontSize: 10,
                                    color: "#09922e",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Skeletal Muscle
      ...(skeletalMuscle.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Skeletal muscle",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: skeletalMuscle.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: skeletalMuscle.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        skeletalMuscle.status === "Normal"
                          ? "#C8E6C9"
                          : skeletalMuscle.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: skeletalMuscleDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue =
                            parseFloat(skeletalMuscle.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 40;
                          const highThreshold = 50;
                          const maxRange = 70; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Muscle Mass
      ...(muscleMass.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Muscle Mass",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: muscleMass.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: muscleMass.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        muscleMass.status === "Normal"
                          ? "#C8E6C9"
                          : muscleMass.status === "Low"
                          ? "#E3F2FD"
                          : "#09922e",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: muscleMassDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(muscleMass.value);
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 32.9;
                          const highThreshold = 37.5;
                          const maxRange = 120; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#09922e",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Adequate",
                                    fontSize: 10,
                                    color: "#09922e",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Bone Mass (Blue to Green to Red)
      ...(boneMass.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Bone mass",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: boneMass.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: boneMass.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        boneMass.status === "Normal"
                          ? "#C8E6C9"
                          : boneMass.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: boneMassDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(boneMass.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 2.3;
                          const highThreshold = 2.7;
                          const maxRange = 5; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Protein (Blue to Green to Dark Green)
      ...(protein.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Protein",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: protein.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: protein.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        protein.status === "Normal"
                          ? "#C8E6C9"
                          : protein.status === "Low"
                          ? "#E3F2FD"
                          : "#09922e",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: proteinDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(protein.value);
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 16;
                          const highThreshold = 18;
                          const maxRange = 30; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#09922e",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Adequate",
                                    fontSize: 10,
                                    color: "#09922e",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // BMR (Red to Green)
      ...(bmr.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Green header row
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("o2.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "BMR",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: bmr.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: bmr.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        bmr.status === "Normal" ? "#C8E6C9" : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: bmrDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar
                        (() => {
                          const bmrValue = parseFloat(bmr.value);
                          const barWidth = 520;
                          const lowBarWidth = barWidth * 0.5;
                          const normalThreshold = 1615;
                          const minRange = 800;
                          const maxRange = 4000;

                          let pointerPosition;
                          if (bmrValue < normalThreshold) {
                            pointerPosition =
                              ((bmrValue - minRange) /
                                (normalThreshold - minRange)) *
                              lowBarWidth;
                          } else {
                            pointerPosition =
                              lowBarWidth +
                              ((bmrValue - normalThreshold) /
                                (maxRange - normalThreshold + 1)) *
                                (barWidth - lowBarWidth);
                          }
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              {
                                columns: [
                                  {
                                    text: String(normalThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar
                              {
                                canvas: [
                                  // Red (Low) section
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Green (Normal) section
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: barWidth - lowBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Not Upto Standard",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "50%",
                                    margin: [90, 6, 0, 0],
                                  },
                                  {
                                    text: "Standard",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    alignment: "right",
                                    width: "50%",
                                    margin: [0, 6, 90, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Metabolic Age (Green to Red)
      ...(metabolicAge.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Green header row
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("o2.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Metabolic Age",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: metabolicAge.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: metabolicAge.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        metabolicAge.status === "Normal"
                          ? "#C8E6C9"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: metabolicAgeDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar
                        (() => {
                          const metabolicAgeValue = parseFloat(
                            metabolicAge.value
                          );
                          const barWidth = 520;
                          const lowBarWidth = barWidth * 0.5;
                          const normalThreshold = 27;
                          const minRange = 15;
                          const maxRange = 90;

                          let pointerPosition;
                          if (metabolicAgeValue < normalThreshold) {
                            pointerPosition =
                              ((metabolicAgeValue - minRange) /
                                (normalThreshold - minRange)) *
                              lowBarWidth;
                          } else {
                            pointerPosition =
                              lowBarWidth +
                              ((metabolicAgeValue - normalThreshold) /
                                (maxRange - normalThreshold + 1)) *
                                (barWidth - lowBarWidth);
                          }
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              {
                                columns: [
                                  {
                                    text: String(normalThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar
                              {
                                canvas: [
                                  // Red (Low) section
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Green (Normal) section
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: barWidth - lowBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: "50%",
                                    margin: [90, 6, 0, 0],
                                  },
                                  {
                                    text: "Not upto normal",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    alignment: "right",
                                    width: "50%",
                                    margin: [0, 6, 90, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Body temperature (Blue to Green to Red)
      ...(bodyTemperature.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Body temperature",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: bodyTemperature.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: bodyTemperature.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        bodyTemperature.status === "Normal"
                          ? "#C8E6C9"
                          : bodyTemperature.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: bodyTemperatureDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue =
                            parseFloat(bodyTemperature.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 35.5;
                          const highThreshold = 37.2;
                          const maxRange = 42; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // BP systolic (Blue to Green to Red)
      ...(bpSystolic.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Blood pressure (Systolic)",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: bpSystolic.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: bpSystolic.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        bpSystolic.status === "Normal"
                          ? "#C8E6C9"
                          : bpSystolic.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: bpSystolicDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(bpSystolic.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 90;
                          const highThreshold = 139;
                          const maxRange = 200; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // BP Diastolic (Blue to Green to Red)
      ...(bpDiastolic.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Blood pressure (Diastolic)",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: bpDiastolic.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: bpDiastolic.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        bpDiastolic.status === "Normal"
                          ? "#C8E6C9"
                          : bpDiastolic.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: bpDiastolicDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(bpDiastolic.value) || 25;
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 60;
                          const highThreshold = 89;
                          const maxRange = 200; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      //Pulse (Blue to Green to Red)
      ...(pulse.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Pulse",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: pulse.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: pulse.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        pulse.status === "Normal"
                          ? "#C8E6C9"
                          : pulse.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: pulseDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(pulse.value);
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 60;
                          const highThreshold = 100;
                          const maxRange = 200; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      //Hemoglobin (Blue to Green to Red)
      ...(hemoglobin.value
        ? [
            // Full card using table for background
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("fat.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Hemoglobin",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: hemoglobin.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: hemoglobin.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        hemoglobin.status === "Normal"
                          ? "#C8E6C9"
                          : hemoglobin.status === "Low"
                          ? "#E3F2FD"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row (light background)
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: hemoglobinDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with three zones: Low (blue), Normal (green), High (red)
                        (() => {
                          const fatValue = parseFloat(hemoglobin.value);
                          const barWidth = 520;

                          // Thresholds: Low = 0-21%, Normal = 21-30%, High = 30%+
                          const lowThreshold = 11;
                          const highThreshold = 16;
                          const maxRange = 20; // Max display range for pointer calculation

                          // Equal width for all three sections
                          const sectionWidth = barWidth / 3;
                          const lowBarWidth = sectionWidth;
                          const normalBarWidth = sectionWidth;
                          const highBarWidth = sectionWidth;

                          // Calculate pointer position based on actual value and thresholds
                          let pointerPosition;
                          if (fatValue <= lowThreshold) {
                            // In Low zone (0-21%)
                            pointerPosition =
                              (fatValue / lowThreshold) * sectionWidth;
                          } else if (fatValue <= highThreshold) {
                            // In Normal zone (21-30%)
                            pointerPosition =
                              sectionWidth +
                              ((fatValue - lowThreshold) /
                                (highThreshold - lowThreshold)) *
                                sectionWidth;
                          } else {
                            // In High zone (30%+)
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(fatValue, maxRange) - highThreshold) /
                                highRangeMax) *
                                sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(
                            12,
                            Math.min(barWidth - 12, pointerPosition)
                          );

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: lowBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: normalBarWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with three sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-21%
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: lowBarWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 21-30%
                                  {
                                    type: "rect",
                                    x: lowBarWidth,
                                    y: 0,
                                    w: normalBarWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Red (High) section - 30%+
                                  {
                                    type: "rect",
                                    x: lowBarWidth + normalBarWidth,
                                    y: 0,
                                    w: highBarWidth,
                                    h: 14,
                                    color: "#EF5350",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 10,
                                    color: "#2196F3",
                                    italics: true,
                                    width: lowBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 10,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: normalBarWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "High",
                                    fontSize: 10,
                                    color: "#EF5350",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Glucose Section - 4 zones: Low (Blue), Normal (Green), Pre-Diabetic (Yellow), Diabetic (Red)
      ...(glucose.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("glucose.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Glucose",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                        },
                        // Value
                        {
                          text: glucose.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [-50, 6, 0, 0],
                        },
                        // Status
                        {
                          text: glucose.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 6, 0, 0],
                        },
                      ],
                      fillColor:
                        glucose.status === "Normal"
                          ? "#C8E6C9"
                          : glucose.status === "Low"
                          ? "#E3F2FD"
                          : glucose.status === "Pre-Diabetic"
                          ? "#FFF9C4"
                          : "#FFEBEE",
                      margin: [10, 10, 10, 10],
                    },
                  ],
                  // Description and status bar row
                  [
                    {
                      stack: [
                        // Description text
                        {
                          text: glucoseDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [0, 10, 0, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [0, 0, 0, 15],
                        },
                        // Status bar with 4 zones
                        (() => {
                          const glucoseValue = parseFloat(glucose.value) || 100;
                          const barWidth = 520;

                          // Thresholds: Low = 0-60, Normal = 60-140, Pre-Diabetic = 140-199, Diabetic = 199+
                          const lowThreshold = 60;
                          const normalThreshold = 140;
                          const preDiabeticThreshold = 199;
                          const maxRange = 300; // Max display range

                          // Equal width for all 4 sections
                          const sectionWidth = barWidth / 4;

                          // Calculate pointer position based on value
                          let pointerPosition;
                          if (glucoseValue <= lowThreshold) {
                            // Low zone (0-60)
                            pointerPosition = (glucoseValue / lowThreshold) * sectionWidth;
                          } else if (glucoseValue <= normalThreshold) {
                            // Normal zone (60-140)
                            pointerPosition =
                              sectionWidth +
                              ((glucoseValue - lowThreshold) / (normalThreshold - lowThreshold)) * sectionWidth;
                          } else if (glucoseValue <= preDiabeticThreshold) {
                            // Pre-Diabetic zone (140-199)
                            pointerPosition =
                              sectionWidth * 2 +
                              ((glucoseValue - normalThreshold) / (preDiabeticThreshold - normalThreshold)) * sectionWidth;
                          } else {
                            // Diabetic zone (199+)
                            const diabeticRangeMax = maxRange - preDiabeticThreshold;
                            pointerPosition =
                              sectionWidth * 3 +
                              ((Math.min(glucoseValue, maxRange) - preDiabeticThreshold) / diabeticRangeMax) * sectionWidth;
                          }

                          // Clamp pointer position
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              // Threshold markers
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(normalThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(preDiabeticThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: "",
                                    width: "*",
                                  },
                                ],
                              },
                              // Scale bar with 4 sections
                              {
                                canvas: [
                                  // Blue (Low) section - 0-60
                                  {
                                    type: "rect",
                                    x: 0,
                                    y: 0,
                                    w: sectionWidth,
                                    h: 14,
                                    color: "#2196F3",
                                  },
                                  // Green (Normal) section - 60-140
                                  {
                                    type: "rect",
                                    x: sectionWidth,
                                    y: 0,
                                    w: sectionWidth,
                                    h: 14,
                                    color: "#4CAF50",
                                  },
                                  // Yellow (Pre-Diabetic) section - 140-199
                                  {
                                    type: "rect",
                                    x: sectionWidth * 2,
                                    y: 0,
                                    w: sectionWidth,
                                    h: 14,
                                    color: "#FFC107",
                                  },
                                  // Red (Diabetic) section - 199+
                                  {
                                    type: "rect",
                                    x: sectionWidth * 3,
                                    y: 0,
                                    w: sectionWidth,
                                    h: 14,
                                    color: "#C62828",
                                  },
                                  // Pointer circle
                                  {
                                    type: "ellipse",
                                    x: pointerPosition,
                                    y: 7,
                                    r1: 10,
                                    r2: 10,
                                    lineColor: "#424242",
                                    lineWidth: 2,
                                    color: "white",
                                  },
                                ],
                              },
                              // Labels
                              {
                                columns: [
                                  {
                                    text: "Low",
                                    fontSize: 9,
                                    color: "#2196F3",
                                    italics: true,
                                    width: sectionWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Normal",
                                    fontSize: 9,
                                    color: "#4CAF50",
                                    italics: true,
                                    width: sectionWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Pre-Diabetic",
                                    fontSize: 9,
                                    color: "#FFC107",
                                    italics: true,
                                    width: sectionWidth,
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                  {
                                    text: "Diabetic",
                                    fontSize: 9,
                                    color: "#C62828",
                                    italics: true,
                                    width: "*",
                                    alignment: "center",
                                    margin: [0, 6, 0, 0],
                                  },
                                ],
                              },
                            ],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                      margin: [10, 5, 10, 15],
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 20],
            },
          ]
        : []),
      // Left Eye Section
      ...(leftEye.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Green left accent border
                        // {
                        //   canvas: [
                        //     {
                        //       type: "rect",
                        //       x: 0,
                        //       y: 0,
                        //       w: 4,
                        //       h: 48,
                        //       color: "#4CAF50",
                        //     },
                        //   ],
                        //   width: 4,
                        // },
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Left Eye",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "40%",
                          margin: [10, 10, 0, 0],
                        },
                        // Value
                        {
                          text: leftEye.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        // Status
                        {
                          text: leftEye.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        leftEye.status === "Normal" ? "#C8E6C9" : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  // Description row
                  [
                    {
                      stack: [
                        {
                          text: leftEyeDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 20, 25, 10],
            },
          ]
        : []),
      // Right Eye Section
      ...(rightEye.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Green left accent border
                        // {
                        //   canvas: [
                        //     {
                        //       type: "rect",
                        //       x: 0,
                        //       y: 0,
                        //       w: 4,
                        //       h: 48,
                        //       color: "#4CAF50",
                        //     },
                        //   ],
                        //   width: 4,
                        // },
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Right Eye",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "40%",
                          margin: [10, 10, 0, 0],
                        },
                        // Value
                        {
                          text: rightEye.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        // Status
                        {
                          text: rightEye.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        rightEye.status === "Normal" ? "#C8E6C9" : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  // Description row
                  [
                    {
                      stack: [
                        {
                          text: rightEyeDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 10, 25, 20],
            },
          ]
        : []),
      // Lipid and HbA1c Test Title
      ...((totalCholesterol.value || triglycerides.value || hdlCholesterol.value || nonHdlCholesterol.value || ldlCholesterol.value || cholesterolRatio.value || hba1c.value)
        ? [
            {
              text: "Lipid and HbA1c Test",
              fontSize: 14,
              bold: true,
              color: "#3C678C",
              alignment: "center",
              margin: [25, 20, 25, 15],
            },
          ]
        : []),
      // Total Cholesterol Section - 3 zones: Desirable (Green), Borderline High (Yellow), High (Red)
      ...(totalCholesterol.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Yellow left accent border
                        // {
                        //   canvas: [
                        //     {
                        //       type: "rect",
                        //       x: 0,
                        //       y: 0,
                        //       w: 4,
                        //       h: 48,
                        //       color: "#FFC107",
                        //     },
                        //   ],
                        //   width: 4,
                        // },
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("cholesterol.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Total Cholesterol",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "40%",
                          margin: [10, 10, 0, 0],
                        },
                        // Value
                        {
                          text: totalCholesterol.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        // Status
                        {
                          text: totalCholesterol.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        totalCholesterol.status === "Desirable"
                          ? "#C8E6C9"
                          : totalCholesterol.status === "Borderline High"
                          ? "#FFC107"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  // Description and status bar row
                  [
                    {
                      stack: [
                        {
                          text: totalCholesterolDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        // Status bar with 3 zones
                        (() => {
                          const cholesterolValue = parseFloat(totalCholesterol.value) || 200;
                          const barWidth = 520;

                          // Thresholds: Desirable = 0-200, Borderline High = 200-239, High = 239+
                          const desirableThreshold = 200;
                          const highThreshold = 239;
                          const maxRange = 300;

                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (cholesterolValue <= desirableThreshold) {
                            pointerPosition = (cholesterolValue / desirableThreshold) * sectionWidth;
                          } else if (cholesterolValue <= highThreshold) {
                            pointerPosition =
                              sectionWidth +
                              ((cholesterolValue - desirableThreshold) / (highThreshold - desirableThreshold)) * sectionWidth;
                          } else {
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(cholesterolValue, maxRange) - highThreshold) / highRangeMax) * sectionWidth;
                          }

                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  {
                                    text: String(desirableThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#FFC107" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#EF5350" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Desirable", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Borderline High", fontSize: 9, color: "#FFC107", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "High", fontSize: 9, color: "#EF5350", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // Triglycerides Section - 3 zones: Desirable (Green), Border Line (Yellow), High (Red)
      ...(triglycerides.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Yellow left accent border
                        // {
                        //   canvas: [
                        //     {
                        //       type: "rect",
                        //       x: 0,
                        //       y: 0,
                        //       w: 4,
                        //       h: 48,
                        //       color: "#FFC107",
                        //     },
                        //   ],
                        //   width: 4,
                        // },
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("cholesterol.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Triglycerides",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "40%",
                          margin: [10, 10, 0, 0],
                        },
                        // Value
                        {
                          text: triglycerides.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        // Status
                        {
                          text: triglycerides.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "30%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        triglycerides.status === "Desirable"
                          ? "#C8E6C9"
                          : triglycerides.status === "Border Line"
                          ? "#FFC107"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  // Description and status bar row
                  [
                    {
                      stack: [
                        {
                          text: triglyceridesDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        // Status bar with 3 zones
                        (() => {
                          const triglyceridesValue = parseFloat(triglycerides.value) || 100;
                          const barWidth = 520;

                          // Thresholds: Desirable = 0-150, Border Line = 150-199, High = 199+
                          const desirableThreshold = 150;
                          const highThreshold = 199;
                          const maxRange = 300;

                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (triglyceridesValue <= desirableThreshold) {
                            pointerPosition = (triglyceridesValue / desirableThreshold) * sectionWidth;
                          } else if (triglyceridesValue <= highThreshold) {
                            pointerPosition =
                              sectionWidth +
                              ((triglyceridesValue - desirableThreshold) / (highThreshold - desirableThreshold)) * sectionWidth;
                          } else {
                            const highRangeMax = maxRange - highThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(triglyceridesValue, maxRange) - highThreshold) / highRangeMax) * sectionWidth;
                          }

                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  {
                                    text: String(desirableThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(highThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#FFC107" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#EF5350" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Desirable", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Border Line", fontSize: 9, color: "#FFC107", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "High", fontSize: 9, color: "#EF5350", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // HDL Cholesterol Section - 3 zones: Low (Blue), Normal (Green), Desirable (Dark Green)
      ...(hdlCholesterol.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  // Header row with dynamic color based on status
                  [
                    {
                      columns: [
                        // Yellow left accent border
                        // {
                        //   canvas: [
                        //     {
                        //       type: "rect",
                        //       x: 0,
                        //       y: 0,
                        //       w: 4,
                        //       h: 48,
                        //       color: "#FFC107",
                        //     },
                        //   ],
                        //   width: 4,
                        // },
                        // Icon and label
                        {
                          columns: [
                            {
                              image: getImagePath("cholesterol.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "High-density lipo-protein (HDL) cholesterol",
                              fontSize: 10,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "50%",
                          margin: [10, 10, 0, 0],
                        },
                        // Value
                        {
                          text: hdlCholesterol.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "20%",
                          margin: [0, 16, 0, 0],
                        },
                        // Status
                        {
                          text: hdlCholesterol.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        hdlCholesterol.status === "Desirable"
                          ? "#09922e"
                          : hdlCholesterol.status === "Normal"
                          ? "#C8E6C9"
                          : "#E3F2FD",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  // Description and status bar row
                  [
                    {
                      stack: [
                        {
                          text: hdlCholesterolDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        // Status bar with 3 zones
                        (() => {
                          const hdlValue = parseFloat(hdlCholesterol.value) || 50;
                          const barWidth = 520;

                          // Thresholds: Low = 0-40, Normal = 40-60, Desirable = 60+
                          const lowThreshold = 40;
                          const normalThreshold = 60;
                          const maxRange = 100;

                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (hdlValue <= lowThreshold) {
                            pointerPosition = (hdlValue / lowThreshold) * sectionWidth;
                          } else if (hdlValue <= normalThreshold) {
                            pointerPosition =
                              sectionWidth +
                              ((hdlValue - lowThreshold) / (normalThreshold - lowThreshold)) * sectionWidth;
                          } else {
                            const desirableRangeMax = maxRange - normalThreshold;
                            pointerPosition =
                              sectionWidth * 2 +
                              ((Math.min(hdlValue, maxRange) - normalThreshold) / desirableRangeMax) * sectionWidth;
                          }

                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  {
                                    text: String(lowThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  {
                                    text: String(normalThreshold),
                                    fontSize: 9,
                                    color: "#666",
                                    width: sectionWidth,
                                    alignment: "right",
                                    margin: [0, 0, -5, 4],
                                  },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#2196F3" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#09922e" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Low", fontSize: 9, color: "#2196F3", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Normal", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Desirable", fontSize: 9, color: "#09922e", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [25, 10, 25, 20],
            },
          ]
        : []),
      // Non-HDL Cholesterol Section - 3 zones: Desirable (Green), Border Line (Yellow), High (Red)
      ...(nonHdlCholesterol.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("cholesterol.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Non-high-density lipo-protein (NON-HDL) cholesterol",
                              fontSize: 9,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "50%",
                          margin: [10, 10, 0, 0],
                        },
                        {
                          text: nonHdlCholesterol.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "20%",
                          margin: [0, 16, 0, 0],
                        },
                        {
                          text: nonHdlCholesterol.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        nonHdlCholesterol.status === "Desirable" || nonHdlCholesterol.status === "desirable"
                          ? "#C8E6C9"
                          : nonHdlCholesterol.status === "Border Line"
                          ? "#FFC107"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: nonHdlCholesterolDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        (() => {
                          const value = parseFloat(nonHdlCholesterol.value) || 130;
                          const barWidth = 520;
                          const desirableThreshold = 159;
                          const highThreshold = 179;
                          const maxRange = 250;
                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (value <= desirableThreshold) {
                            pointerPosition = (value / desirableThreshold) * sectionWidth;
                          } else if (value <= highThreshold) {
                            pointerPosition = sectionWidth + ((value - desirableThreshold) / (highThreshold - desirableThreshold)) * sectionWidth;
                          } else {
                            pointerPosition = sectionWidth * 2 + ((Math.min(value, maxRange) - highThreshold) / (maxRange - highThreshold)) * sectionWidth;
                          }
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  { text: String(desirableThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(highThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#FFC107" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#EF5350" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Desirable", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Border Line", fontSize: 9, color: "#FFC107", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "High", fontSize: 9, color: "#EF5350", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // LDL Cholesterol Section - 4 zones: Optimal (Green), Near Optimal (Yellow), Slightly High (Light Green), High (Red)
      ...(ldlCholesterol.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("cholesterol.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Low-density lipoprotein (LDL) cholesterol",
                              fontSize: 10,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "50%",
                          margin: [10, 10, 0, 0],
                        },
                        {
                          text: ldlCholesterol.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "20%",
                          margin: [0, 16, 0, 0],
                        },
                        {
                          text: ldlCholesterol.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        ldlCholesterol.status === "Optimal"
                          ? "#C8E6C9"
                          : ldlCholesterol.status === "Near Optimal"
                          ? "#FFC107"
                          : ldlCholesterol.status === "Slightly High"
                          ? "#A5D6A7"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: ldlCholesterolDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        (() => {
                          const value = parseFloat(ldlCholesterol.value) || 100;
                          const barWidth = 520;
                          const optimalThreshold = 100;
                          const nearOptimalThreshold = 129;
                          const slightlyHighThreshold = 159;
                          const maxRange = 200;
                          const sectionWidth = barWidth / 4;

                          let pointerPosition;
                          if (value <= optimalThreshold) {
                            pointerPosition = (value / optimalThreshold) * sectionWidth;
                          } else if (value <= nearOptimalThreshold) {
                            pointerPosition = sectionWidth + ((value - optimalThreshold) / (nearOptimalThreshold - optimalThreshold)) * sectionWidth;
                          } else if (value <= slightlyHighThreshold) {
                            pointerPosition = sectionWidth * 2 + ((value - nearOptimalThreshold) / (slightlyHighThreshold - nearOptimalThreshold)) * sectionWidth;
                          } else {
                            pointerPosition = sectionWidth * 3 + ((Math.min(value, maxRange) - slightlyHighThreshold) / (maxRange - slightlyHighThreshold)) * sectionWidth;
                          }
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  { text: String(optimalThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(nearOptimalThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(slightlyHighThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#FFC107" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#A5D6A7" },
                                  { type: "rect", x: sectionWidth * 3, y: 0, w: sectionWidth, h: 14, color: "#EF5350" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Optimal", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Near Optimal", fontSize: 9, color: "#FFC107", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Slightly High", fontSize: 9, color: "#A5D6A7", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "High", fontSize: 9, color: "#EF5350", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // Total CHOL / HDL Cholesterol Ratio Section - 3 zones: Low (Blue), Normal (Green), High (Red)
      ...(cholesterolRatio.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("cholesterol.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Total CHOL / HDL Cholesterol Ratio",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                          margin: [10, 10, 0, 0],
                        },
                        {
                          text: cholesterolRatio.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        {
                          text: cholesterolRatio.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        cholesterolRatio.status === "Low"
                          ? "#BBDEFB"
                          : cholesterolRatio.status === "Normal"
                          ? "#C8E6C9"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: cholesterolRatioDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        (() => {
                          const value = parseFloat(cholesterolRatio.value) || 3.0;
                          const barWidth = 520;
                          const lowThreshold = 3.3;
                          const normalThreshold = 4.4;
                          const maxRange = 6.0;
                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (value <= lowThreshold) {
                            pointerPosition = (value / lowThreshold) * sectionWidth;
                          } else if (value <= normalThreshold) {
                            pointerPosition = sectionWidth + ((value - lowThreshold) / (normalThreshold - lowThreshold)) * sectionWidth;
                          } else {
                            pointerPosition = sectionWidth * 2 + ((Math.min(value, maxRange) - normalThreshold) / (maxRange - normalThreshold)) * sectionWidth;
                          }
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  { text: String(lowThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(normalThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#2196F3" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#EF5350" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Low", fontSize: 9, color: "#2196F3", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Normal", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "High", fontSize: 9, color: "#EF5350", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 25, 25, 20],
            },
          ]
        : []),
      // HBA1C Section - 3 zones: Normal (Green), Pre-Diabetic (Yellow), Diabetic (Red)
      ...(hba1c.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("glucose.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "HBA1C",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                          margin: [10, 10, 0, 0],
                        },
                        {
                          text: hba1c.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        {
                          text: hba1c.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        hba1c.status === "Normal"
                          ? "#C8E6C9"
                          : hba1c.status === "Pre-Diabetic"
                          ? "#FFC107"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: hba1cDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        // Separator line
                        {
                          canvas: [
                            {
                              type: "line",
                              x1: 0,
                              y1: 0,
                              x2: 520,
                              y2: 0,
                              lineWidth: 1,
                              lineColor: "#E0E0E0",
                            },
                          ],
                          margin: [10, 0, 10, 15],
                        },
                        (() => {
                          const value = parseFloat(hba1c.value) || 5.0;
                          const barWidth = 500;
                          const normalThreshold = 5.7;
                          const preDiabeticThreshold = 6.4;
                          const maxRange = 10.0;
                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (value <= normalThreshold) {
                            pointerPosition = (value / normalThreshold) * sectionWidth;
                          } else if (value <= preDiabeticThreshold) {
                            pointerPosition = sectionWidth + ((value - normalThreshold) / (preDiabeticThreshold - normalThreshold)) * sectionWidth;
                          } else {
                            pointerPosition = sectionWidth * 2 + ((Math.min(value, maxRange) - preDiabeticThreshold) / (maxRange - preDiabeticThreshold)) * sectionWidth;
                          }
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  { text: String(normalThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(preDiabeticThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#FFC107" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#EF5350" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Normal", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Pre-Diabetic", fontSize: 9, color: "#FFC107", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Diabetic", fontSize: 9, color: "#EF5350", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 20],
            },
          ]
        : []),
      // Uric Acid Test Section - 3 zones: Low (Blue), Normal (Green), High (Red)
      ...(uricAcid.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("glucose.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Uric Acid Test",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                          margin: [10, 10, 0, 0],
                        },
                        {
                          text: uricAcid.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        {
                          text: uricAcid.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        uricAcid.status === "Normal"
                          ? "#C8E6C9"
                          : uricAcid.status === "Low"
                          ? "#E3F2FD"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: uricAcidDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        {
                          canvas: [
                            { type: "line", x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 1, lineColor: "#E0E0E0" },
                          ],
                          margin: [10, 0, 10, 15],
                        },
                        (() => {
                          const value = parseFloat(uricAcid.value) || 4.0;
                          const barWidth = 500;
                          const lowThreshold = 2.4;
                          const normalThreshold = 6;
                          const maxRange = 10;
                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (value <= lowThreshold) {
                            pointerPosition = (value / lowThreshold) * sectionWidth;
                          } else if (value <= normalThreshold) {
                            pointerPosition = sectionWidth + ((value - lowThreshold) / (normalThreshold - lowThreshold)) * sectionWidth;
                          } else {
                            pointerPosition = sectionWidth * 2 + ((Math.min(value, maxRange) - normalThreshold) / (maxRange - normalThreshold)) * sectionWidth;
                          }
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  { text: String(lowThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(normalThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#2196F3" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#EF5350" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Low", fontSize: 9, color: "#2196F3", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Normal", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "High", fontSize: 9, color: "#EF5350", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // Color Vision Section - Simple card with status display
      ...(colorVision.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Color Vision",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "*",
                          margin: [10, 10, 0, 0],
                        },
                      ],
                      fillColor: "#C8E6C9",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: "You Might Have",
                          fontSize: 11,
                          color: "#555",
                          alignment: "center",
                          margin: [0, 30, 0, 10],
                        },
                        {
                          text: colorVision.value || "Normal Vision",
                          fontSize: 24,
                          bold: true,
                          color: "#333",
                          alignment: "center",
                          margin: [0, 0, 0, 40],
                        },
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // Perceived Stress Scale (PSS) Section - 3 zones: Normal (Green), Moderate (Yellow), Severe (Red)
      ...(perceivedStress.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("glucose.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Perceived Stress Scale (PSS)",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                          margin: [10, 10, 0, 0],
                        },
                        {
                          text: perceivedStress.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        {
                          text: perceivedStress.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor:
                        perceivedStress.status === "Normal"
                          ? "#C8E6C9"
                          : perceivedStress.status === "Moderate"
                          ? "#FFF9C4"
                          : "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: perceivedStressDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        {
                          canvas: [
                            { type: "line", x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 1, lineColor: "#E0E0E0" },
                          ],
                          margin: [10, 0, 10, 15],
                        },
                        (() => {
                          const value = parseFloat(perceivedStress.value) || 10;
                          const barWidth = 500;
                          const normalThreshold = 13;
                          const moderateThreshold = 26;
                          const maxRange = 40;
                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (value <= normalThreshold) {
                            pointerPosition = (value / normalThreshold) * sectionWidth;
                          } else if (value <= moderateThreshold) {
                            pointerPosition = sectionWidth + ((value - normalThreshold) / (moderateThreshold - normalThreshold)) * sectionWidth;
                          } else {
                            pointerPosition = sectionWidth * 2 + ((Math.min(value, maxRange) - moderateThreshold) / (maxRange - moderateThreshold)) * sectionWidth;
                          }
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  { text: String(normalThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(moderateThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#FFC107" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#C62828" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Normal", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Moderate", fontSize: 9, color: "#FFC107", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Severe", fontSize: 9, color: "#C62828", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 20],
            },
          ]
        : []),
      // Fatigue Assessment Scale (FAS) Section - 3 zones: Normal (Green), Moderate (Yellow), Severe (Red)
      ...(fatigueAssessment.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("glucose.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Fatigue Assessment Scale (FAS)",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "45%",
                          margin: [10, 10, 0, 0],
                        },
                        {
                          text: fatigueAssessment.value,
                          fontSize: 13,
                          bold: true,
                          color: "#000",
                          alignment: "center",
                          width: "25%",
                          margin: [0, 16, 0, 0],
                        },
                        {
                          text: fatigueAssessment.status,
                          fontSize: 11,
                          bold: true,
                          color: "#000",
                          alignment: "right",
                          width: "25%",
                          margin: [0, 16, 10, 0],
                        },
                      ],
                      fillColor: "#FFF9C4",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          text: fatigueAssessmentDescription,
                          fontSize: 9,
                          color: "#555",
                          lineHeight: 1.5,
                          margin: [10, 15, 10, 15],
                        },
                        {
                          canvas: [
                            { type: "line", x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 1, lineColor: "#E0E0E0" },
                          ],
                          margin: [10, 0, 10, 15],
                        },
                        (() => {
                          const value = parseFloat(fatigueAssessment.value) || 20;
                          const barWidth = 500;
                          const normalThreshold = 22;
                          const moderateThreshold = 34;
                          const maxRange = 50;
                          const sectionWidth = barWidth / 3;

                          let pointerPosition;
                          if (value <= normalThreshold) {
                            pointerPosition = (value / normalThreshold) * sectionWidth;
                          } else if (value <= moderateThreshold) {
                            pointerPosition = sectionWidth + ((value - normalThreshold) / (moderateThreshold - normalThreshold)) * sectionWidth;
                          } else {
                            pointerPosition = sectionWidth * 2 + ((Math.min(value, maxRange) - moderateThreshold) / (maxRange - moderateThreshold)) * sectionWidth;
                          }
                          pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

                          return {
                            stack: [
                              {
                                columns: [
                                  { text: String(normalThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: String(moderateThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
                                  { text: "", width: "*" },
                                ],
                              },
                              {
                                canvas: [
                                  { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: "#4CAF50" },
                                  { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: "#FFC107" },
                                  { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: "#C62828" },
                                  { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
                                ],
                              },
                              {
                                columns: [
                                  { text: "Normal", fontSize: 9, color: "#4CAF50", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Moderate", fontSize: 9, color: "#FFC107", italics: true, width: sectionWidth, alignment: "center", margin: [0, 6, 0, 0] },
                                  { text: "Severe", fontSize: 9, color: "#C62828", italics: true, width: "*", alignment: "center", margin: [0, 6, 0, 0] },
                                ],
                              },
                            ],
                            margin: [10, 0, 10, 15],
                          };
                        })(),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // Tuberculosis Test Section - Simple card with Result and Recommendation
      ...(tuberculosisTest.value
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        // {
                        //   canvas: [
                        //     { type: "rect", x: 0, y: 0, w: 4, h: 48, color: "#FFC107" },
                        //   ],
                        //   width: 4,
                        // },
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Tuberculosis Test",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "*",
                          margin: [10, 10, 0, 0],
                        },
                      ],
                      fillColor: "#C8E6C9",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          columns: [
                            {
                              text: "Result :",
                              fontSize: 14,
                              bold: true,
                              color: "#333",
                              width: "auto",
                            },
                            {
                              text: tuberculosisTest.value || "Negative",
                              fontSize: 12,
                              color: "#fff",
                              background: "#607D8B",
                              margin: [10, 2, 0, 0],
                              width: "auto",
                            },
                          ],
                          margin: [10, 20, 10, 15],
                        },
                        {
                          columns: [
                            {
                              text: "Recommendation :",
                              fontSize: 12,
                              bold: true,
                              color: "#333",
                              width: "auto",
                            },
                            {
                              text: "Continue to monitor your health. If you have any concerns or develop symptoms, consult a healthcare professional for further advice.",
                              fontSize: 10,
                              color: "#555",
                              margin: [5, 0, 10, 0],
                              width: "*",
                            },
                          ],
                          margin: [10, 0, 10, 30],
                        },
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // Mental Health Assessment Section - Card with Depression and Anxiety levels
      ...((mentalHealth.depression || mentalHealth.anxiety)
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        // {
                        //   canvas: [
                        //     { type: "rect", x: 0, y: 0, w: 4, h: 48, color: "#EF5350" },
                        //   ],
                        //   width: 4,
                        // },
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Mental Health Assessment",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "*",
                          margin: [10, 10, 0, 0],
                        },
                      ],
                      fillColor: "#FFCDD2",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          table: {
                            widths: ["auto", "auto"],
                            body: [
                              [
                                {
                                  text: "Level of Depression",
                                  fontSize: 11,
                                  color: "#333",
                                  margin: [10, 10, 20, 10],
                                  border: [false, false, false, true],
                                },
                                {
                                  text: mentalHealth.depression || "Minimal",
                                  fontSize: 11,
                                  color: "#fff",
                                  fillColor: "#81C784",
                                  alignment: "center",
                                  margin: [15, 10, 15, 10],
                                  border: [false, false, false, true],
                                },
                              ],
                              [
                                {
                                  text: "Level of Anxiety",
                                  fontSize: 11,
                                  color: "#333",
                                  margin: [10, 10, 20, 10],
                                  border: [false, false, false, false],
                                },
                                {
                                  text: mentalHealth.anxiety || "Mild",
                                  fontSize: 11,
                                  color: "#fff",
                                  fillColor: "#EF9A9A",
                                  alignment: "center",
                                  margin: [15, 10, 15, 10],
                                  border: [false, false, false, false],
                                },
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
                        },
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 20],
            },
          ]
        : []),
      // Ayurvedic Test Section - Simple card with Result display
      ...(ayurvedicTest.result
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        // {
                        //   canvas: [
                        //     { type: "rect", x: 0, y: 0, w: 4, h: 48, color: "#4CAF50" },
                        //   ],
                        //   width: 4,
                        // },
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Ayurvedic Test",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "*",
                          margin: [10, 10, 0, 0],
                        },
                      ],
                      fillColor: "#C8E6C9",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          columns: [
                            {
                              text: "Result :",
                              fontSize: 14,
                              bold: true,
                              color: "#333",
                              width: "auto",
                              margin: [0, 0, 10, 0],
                            },
                            {
                              text: ayurvedicTest.result,
                              fontSize: 11,
                              color: "#333",
                              fillColor: "#C8E6C9",
                              margin: [10, 3, 10, 3],
                              width: "auto",
                            },
                          ],
                          margin: [30, 40, 10, 50],
                        },
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 10],
            },
          ]
        : []),
      // Spirometer Test Section - Card with diagnosis and parameter table
      ...(spirometerTest.diagnosis
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        // {
                        //   canvas: [
                        //     { type: "rect", x: 0, y: 0, w: 4, h: 48, color: "#4CAF50" },
                        //   ],
                        //   width: 4,
                        // },
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Spirometer Test",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "*",
                          margin: [10, 10, 0, 0],
                        },
                      ],
                      fillColor: "#C8E6C9",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        {
                          columns: [
                            {
                              text: "Suggested Diagnosis :",
                              fontSize: 13,
                              color: "#333",
                              width: "auto",
                              margin: [150, 0, 0, 0],
                            },
                            {
                              text: spirometerTest.diagnosis,
                              fontSize: 13,
                              bold: true,
                              color: "#333",
                              margin: [-200, 0, 0, 0],
                              width: "*",
                            },
                          ],
                          alignment: "center",
                          // justifyContent: "center",
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
                              [
                                { text: "FVC", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fvc?.predictivePercent || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fvc?.predictiveValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fvc?.measuredValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                              ],
                              [
                                { text: "PEF", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.pef?.predictivePercent || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.pef?.predictiveValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.pef?.measuredValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                              ],
                              [
                                { text: "FEV1", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fev1?.predictivePercent || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fev1?.predictiveValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fev1?.measuredValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                              ],
                              [
                                { text: "FEV1/FVC", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fev1Fvc?.predictivePercent || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fev1Fvc?.predictiveValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                                { text: spirometerTest.fev1Fvc?.measuredValue || "", fontSize: 10, color: "#555", alignment: "center", margin: [0, 8, 0, 8] },
                              ],
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
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 20],
            },
          ]
        : []),
      // Audiometry Section - Card with Left Ear and Right Ear graphs
      ...((audiometry.leftEarGraph || audiometry.rightEarGraph)
        ? [
            {
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      columns: [
                        {
                          columns: [
                            {
                              image: getImagePath("eye.png"),
                              width: 28,
                              height: 28,
                            },
                            {
                              text: "Audiometry",
                              fontSize: 11,
                              color: "#333",
                              margin: [8, 6, 0, 0],
                            },
                          ],
                          width: "*",
                          margin: [10, 10, 0, 0],
                        },
                      ],
                      fillColor: "#C8E6C9",
                      margin: [0, 0, 0, 0],
                    },
                  ],
                  [
                    {
                      stack: [
                        // Left Ear Graph
                        ...(audiometry.leftEarGraph
                          ? [
                              {
                                image: audiometry.leftEarGraph,
                                width: 500,
                                alignment: "center",
                                margin: [20, 20, 20, 5],
                              },
                              {
                                text: "Left Ear",
                                fontSize: 11,
                                color: "#333",
                                alignment: "center",
                                margin: [0, 5, 0, 20],
                              },
                            ]
                          : []),
                        // Right Ear Graph
                        ...(audiometry.rightEarGraph
                          ? [
                              {
                                image: audiometry.rightEarGraph,
                                width: 500,
                                alignment: "center",
                                margin: [20, 10, 20, 5],
                              },
                              {
                                text: "Right Ear",
                                fontSize: 11,
                                color: "#333",
                                alignment: "center",
                                margin: [0, 5, 0, 20],
                              },
                            ]
                          : []),
                      ],
                      fillColor: "#F5F5F5",
                    },
                  ],
                ],
              },
              layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
              margin: [25, 10, 25, 20],
            },
          ]
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
    // If no data provided, will use default sample data
    const healthData = req.body;
    
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
