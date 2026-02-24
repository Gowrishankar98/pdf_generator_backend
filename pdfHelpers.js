const path = require("path");
const fs = require("fs");

// Helper function to get image path from assets folder
function getImagePath(imageName) {
  const imagePath = path.join(__dirname, "assets", imageName);
  return fs.existsSync(imagePath) ? imagePath : null;
}

// Reusable zero-line layout for card tables
const noLineLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

/**
 * Creates a 3-zone status bar (Blue/Green/Red or custom colors)
 * @param {Object} opts
 * @param {number} opts.value - The measured value
 * @param {number} opts.defaultValue - Fallback if value is NaN
 * @param {number} opts.lowThreshold - Boundary between zone 1 and zone 2
 * @param {number} opts.highThreshold - Boundary between zone 2 and zone 3
 * @param {number} opts.maxRange - Max display range
 * @param {number} [opts.barWidth=520] - Width of the bar
 * @param {Array} opts.zones - Array of 3 { label, color } objects
 * @param {number} [opts.labelFontSize=10] - Font size for zone labels
 * @returns {Object} pdfmake stack
 */
function createThreeZoneBar({
  value,
  defaultValue = 25,
  lowThreshold,
  highThreshold,
  maxRange,
  barWidth = 520,
  zones = [
    { label: "Low", color: "#2196F3" },
    { label: "Normal", color: "#4CAF50" },
    { label: "High", color: "#EF5350" },
  ],
  labelFontSize = 10,
}) {
  const parsedValue = parseFloat(value) || defaultValue;
  const sectionWidth = barWidth / 3;

  let pointerPosition;
  if (parsedValue <= lowThreshold) {
    pointerPosition = (parsedValue / lowThreshold) * sectionWidth;
  } else if (parsedValue <= highThreshold) {
    pointerPosition =
      sectionWidth +
      ((parsedValue - lowThreshold) / (highThreshold - lowThreshold)) *
        sectionWidth;
  } else {
    pointerPosition =
      sectionWidth * 2 +
      ((Math.min(parsedValue, maxRange) - highThreshold) /
        (maxRange - highThreshold)) *
        sectionWidth;
  }
  pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

  return {
    stack: [
      {
        columns: [
          { text: String(lowThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
          { text: String(highThreshold), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
          { text: "", width: "*" },
        ],
      },
      {
        canvas: [
          { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: zones[0].color },
          { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: zones[1].color },
          { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: zones[2].color },
          { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
        ],
      },
      {
        columns: zones.map((z, i) => ({
          text: z.label,
          fontSize: labelFontSize > 9 ? labelFontSize : 9,
          color: z.color,
          italics: true,
          width: i < 2 ? sectionWidth : "*",
          alignment: "center",
          margin: [0, 6, 0, 0],
        })),
      },
    ],
  };
}

/**
 * Creates a 2-zone status bar (e.g., Low/Normal for O2 sat, BMR, Metabolic Age)
 * @param {Object} opts
 * @param {number} opts.value - The measured value
 * @param {number} opts.defaultValue - Fallback if value is NaN
 * @param {number} opts.threshold - Boundary between zone 1 and zone 2
 * @param {number} opts.minRange - Min display range
 * @param {number} opts.maxRange - Max display range
 * @param {number} [opts.barWidth=520] - Width of the bar
 * @param {number} [opts.splitRatio=0.5] - Width ratio for left zone
 * @param {Array} opts.zones - Array of 2 { label, color, labelMargin } objects
 * @returns {Object} pdfmake stack
 */
function createTwoZoneBar({
  value,
  defaultValue = 0,
  threshold,
  minRange,
  maxRange,
  barWidth = 520,
  splitRatio = 0.5,
  zones = [
    { label: "Low", color: "#EF5350", labelMargin: [90, 6, 0, 0] },
    { label: "Normal", color: "#4CAF50", labelMargin: [0, 6, 90, 0] },
  ],
}) {
  const parsedValue = parseFloat(value) || defaultValue;
  const leftWidth = barWidth * splitRatio;

  let pointerPosition;
  if (parsedValue < threshold) {
    pointerPosition =
      ((parsedValue - minRange) / (threshold - minRange)) * leftWidth;
  } else {
    pointerPosition =
      leftWidth +
      ((parsedValue - threshold) / (maxRange - threshold + 1)) *
        (barWidth - leftWidth);
  }
  pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

  return {
    stack: [
      {
        columns: [
          { text: String(threshold), fontSize: 9, color: "#666", width: leftWidth, alignment: "right", margin: [0, 0, -5, 4] },
          { text: "", width: "*" },
        ],
      },
      {
        canvas: [
          { type: "rect", x: 0, y: 0, w: leftWidth, h: 14, color: zones[0].color },
          { type: "rect", x: leftWidth, y: 0, w: barWidth - leftWidth, h: 14, color: zones[1].color },
          { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
        ],
      },
      {
        columns: [
          { text: zones[0].label, fontSize: 10, color: zones[0].color, italics: true, width: "50%", margin: zones[0].labelMargin || [90, 6, 0, 0] },
          { text: zones[1].label, fontSize: 10, color: zones[1].color, italics: true, alignment: "right", width: "50%", margin: zones[1].labelMargin || [0, 6, 90, 0] },
        ],
      },
    ],
  };
}

/**
 * Creates a 4-zone status bar
 * @param {Object} opts
 * @param {number} opts.value - The measured value
 * @param {number} opts.defaultValue - Fallback if value is NaN
 * @param {Array} opts.thresholds - Array of 3 threshold values
 * @param {number} opts.maxRange - Max display range
 * @param {number} [opts.barWidth=520] - Width of the bar
 * @param {Array} opts.zones - Array of 4 { label, color } objects
 * @returns {Object} pdfmake stack
 */
function createFourZoneBar({
  value,
  defaultValue = 100,
  thresholds,
  maxRange,
  barWidth = 520,
  zones,
}) {
  const parsedValue = parseFloat(value) || defaultValue;
  const sectionWidth = barWidth / 4;

  let pointerPosition;
  if (parsedValue <= thresholds[0]) {
    pointerPosition = (parsedValue / thresholds[0]) * sectionWidth;
  } else if (parsedValue <= thresholds[1]) {
    pointerPosition =
      sectionWidth +
      ((parsedValue - thresholds[0]) / (thresholds[1] - thresholds[0])) *
        sectionWidth;
  } else if (parsedValue <= thresholds[2]) {
    pointerPosition =
      sectionWidth * 2 +
      ((parsedValue - thresholds[1]) / (thresholds[2] - thresholds[1])) *
        sectionWidth;
  } else {
    pointerPosition =
      sectionWidth * 3 +
      ((Math.min(parsedValue, maxRange) - thresholds[2]) /
        (maxRange - thresholds[2])) *
        sectionWidth;
  }
  pointerPosition = Math.max(12, Math.min(barWidth - 12, pointerPosition));

  return {
    stack: [
      {
        columns: [
          { text: String(thresholds[0]), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
          { text: String(thresholds[1]), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
          { text: String(thresholds[2]), fontSize: 9, color: "#666", width: sectionWidth, alignment: "right", margin: [0, 0, -5, 4] },
          { text: "", width: "*" },
        ],
      },
      {
        canvas: [
          { type: "rect", x: 0, y: 0, w: sectionWidth, h: 14, color: zones[0].color },
          { type: "rect", x: sectionWidth, y: 0, w: sectionWidth, h: 14, color: zones[1].color },
          { type: "rect", x: sectionWidth * 2, y: 0, w: sectionWidth, h: 14, color: zones[2].color },
          { type: "rect", x: sectionWidth * 3, y: 0, w: sectionWidth, h: 14, color: zones[3].color },
          { type: "ellipse", x: pointerPosition, y: 7, r1: 10, r2: 10, lineColor: "#424242", lineWidth: 2, color: "white" },
        ],
      },
      {
        columns: zones.map((z, i) => ({
          text: z.label,
          fontSize: 9,
          color: z.color,
          italics: true,
          width: i < 3 ? sectionWidth : "*",
          alignment: "center",
          margin: [0, 6, 0, 0],
        })),
      },
    ],
  };
}

/**
 * Creates a health indicator card with header, description, and optional status bar
 * @param {Object} opts
 * @param {string} opts.icon - Icon filename (e.g., "o2.png")
 * @param {string} opts.label - Card label text
 * @param {Object} opts.dataObj - { value, status } object
 * @param {string} opts.description - Description text
 * @param {Function|null} opts.statusBarFn - Function that returns a status bar stack, or null
 * @param {Function} opts.fillColorFn - Function(status) => header fill color
 * @param {Array} [opts.margin=[25, 20, 25, 20]] - Outer margin
 * @param {boolean} [opts.hasSeparator=true] - Whether to include separator before status bar
 * @param {Object} [opts.headerOverrides={}] - Override header column widths/margins
 * @returns {Array} Array with single card element, or empty array if no value
 */
function createHealthCard({
  icon,
  label,
  dataObj,
  description,
  statusBarFn = null,
  fillColorFn,
  margin = [25, 20, 25, 20],
  hasSeparator = true,
  headerOverrides = {},
}) {
  if (!dataObj.value) return [];

  const iconWidth = headerOverrides.iconWidth || "45%";
  const valueWidth = headerOverrides.valueWidth || "25%";
  const statusWidth = headerOverrides.statusWidth || "30%";
  const iconMargin = headerOverrides.iconMargin || [10, 10, 0, 0];
  const valueMargin = headerOverrides.valueMargin || [-50, 6, 0, 0];
  const statusMargin = headerOverrides.statusMargin || [0, 6, 0, 0];
  const headerMargin = headerOverrides.headerMargin || [10, 10, 10, 10];
  const descMargin = headerOverrides.descMargin || [0, 10, 0, 15];
  const bodyMargin = headerOverrides.bodyMargin || [10, 5, 10, 15];
  const labelFontSize = headerOverrides.labelFontSize || 11;

  const descriptionRow = {
    stack: [
      {
        text: description,
        fontSize: 9,
        color: "#555",
        lineHeight: 1.5,
        margin: descMargin,
      },
      ...(hasSeparator && statusBarFn
        ? [
            {
              canvas: [
                { type: "line", x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 1, lineColor: "#E0E0E0" },
              ],
              margin: [0, 0, 0, 15],
            },
          ]
        : []),
      ...(statusBarFn ? [statusBarFn()] : []),
    ],
    fillColor: "#F5F5F5",
    margin: bodyMargin,
  };

  return [
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              columns: [
                {
                  columns: [
                    { image: getImagePath(icon), width: 28, height: 28 },
                    { text: label, fontSize: labelFontSize, color: "#333", margin: [8, 6, 0, 0] },
                  ],
                  width: iconWidth,
                  margin: iconMargin,
                },
                {
                  text: dataObj.value,
                  fontSize: 13,
                  bold: true,
                  color: "#000",
                  alignment: "center",
                  width: valueWidth,
                  margin: valueMargin,
                },
                {
                  text: dataObj.status,
                  fontSize: 11,
                  bold: true,
                  color: "#000",
                  alignment: "right",
                  width: statusWidth,
                  margin: statusMargin,
                },
              ],
              fillColor: fillColorFn(dataObj.status),
              margin: headerMargin,
            },
          ],
          [descriptionRow],
        ],
      },
      layout: noLineLayout,
      margin: margin,
    },
  ];
}

/**
 * Creates a simple card with header only (no status bar) - for eyes, etc.
 * Uses different margins/widths matching the lipid-style cards
 */
function createSimpleCard({
  icon,
  label,
  dataObj,
  description,
  fillColorFn,
  margin = [25, 20, 25, 10],
}) {
  if (!dataObj.value) return [];

  return [
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              columns: [
                {
                  columns: [
                    { image: getImagePath(icon), width: 28, height: 28 },
                    { text: label, fontSize: 11, color: "#333", margin: [8, 6, 0, 0] },
                  ],
                  width: "40%",
                  margin: [10, 10, 0, 0],
                },
                {
                  text: dataObj.value,
                  fontSize: 13,
                  bold: true,
                  color: "#000",
                  alignment: "center",
                  width: "25%",
                  margin: [0, 16, 0, 0],
                },
                {
                  text: dataObj.status,
                  fontSize: 11,
                  bold: true,
                  color: "#000",
                  alignment: "right",
                  width: "30%",
                  margin: [0, 16, 10, 0],
                },
              ],
              fillColor: fillColorFn(dataObj.status),
              margin: [0, 0, 0, 0],
            },
          ],
          [
            {
              stack: [
                {
                  text: description,
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
      layout: noLineLayout,
      margin: margin,
    },
  ];
}

/**
 * Creates a lipid-style card (with wide label column, different margins) with status bar
 */
function createLipidCard({
  icon,
  label,
  dataObj,
  description,
  statusBarFn,
  fillColorFn,
  margin = [25, 10, 25, 10],
  labelFontSize = 11,
  iconWidth = "40%",
  valueWidth = "25%",
  statusWidth = "30%",
}) {
  if (!dataObj.value) return [];

  return [
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              columns: [
                {
                  columns: [
                    { image: getImagePath(icon), width: 28, height: 28 },
                    { text: label, fontSize: labelFontSize, color: "#333", margin: [8, 6, 0, 0] },
                  ],
                  width: iconWidth,
                  margin: [10, 10, 0, 0],
                },
                {
                  text: dataObj.value,
                  fontSize: 13,
                  bold: true,
                  color: "#000",
                  alignment: "center",
                  width: valueWidth,
                  margin: [0, 16, 0, 0],
                },
                {
                  text: dataObj.status,
                  fontSize: 11,
                  bold: true,
                  color: "#000",
                  alignment: "right",
                  width: statusWidth,
                  margin: [0, 16, 10, 0],
                },
              ],
              fillColor: fillColorFn(dataObj.status),
              margin: [0, 0, 0, 0],
            },
          ],
          [
            {
              stack: [
                {
                  text: description,
                  fontSize: 9,
                  color: "#555",
                  lineHeight: 1.5,
                  margin: [10, 15, 10, 15],
                },
                ...(statusBarFn ? [statusBarFn()] : []),
              ],
              fillColor: "#F5F5F5",
            },
          ],
        ],
      },
      layout: noLineLayout,
      margin: margin,
    },
  ];
}

/**
 * Creates a body diagram indicator with icon in ellipse + label
 */
function createBodyIndicator({ imageName, label, subLabel = "Test not taken" }) {
  return {
    columns: [
      {
        stack: [
          {
            canvas: [
              { type: "ellipse", x: 20, y: 20, r1: 20, r2: 20, color: "#FFF3E0" },
            ],
          },
          {
            image: getImagePath(imageName),
            width: 25,
            height: 25,
            margin: [8, -32, 0, 0],
          },
        ],
        width: 45,
      },
      {
        stack: [
          { text: label, fontSize: 8, color: "#333" },
          { text: subLabel, fontSize: 7, color: "#999", margin: [0, 2, 0, 0] },
        ],
        margin: [5, 10, 0, 0],
      },
    ],
    margin: [0, 20, 0, 50],
  };
}

// Common fill-color functions
const fillColors = {
  normalOrRed: (status) => (status === "Normal" ? "#C8E6C9" : "#FFEBEE"),
  normalOrRedSimple: (status) => (status === "Normal" ? "#C8E6C9" : "#FFCDD2"),
  lowNormalHigh: (status) =>
    status === "Normal" ? "#C8E6C9" : status === "Low" ? "#E3F2FD" : "#FFEBEE",
  lowNormalAdequate: (status) =>
    status === "Normal" ? "#C8E6C9" : status === "Low" ? "#E3F2FD" : "#09922e",
};

module.exports = {
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
};
