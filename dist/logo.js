"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printLogo = printLogo;
exports.generateSVG = generateSVG;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mascot_data_1 = require("./mascot-data");
function renderLineToSVG(charsAndColors, charWidth) {
    let result = `<tspan x="25" dy="14">`;
    let currentColor = "";
    let currentBgColor = "";
    let currentText = "";
    // SVG doesn't support background colors on tspans easily without rects.
    // We'll just render the foreground character.
    for (const item of charsAndColors) {
        let displayChar = item.char;
        if (displayChar === ' ' && item.bg) {
            displayChar = '█'; // Hack to show background
        }
        const fgColor = item.color || item.bg || "";
        if (fgColor === currentColor) {
            currentText += displayChar;
        }
        else {
            if (currentText !== "") {
                if (currentColor === "") {
                    result += currentText;
                }
                else {
                    result += `<tspan fill="${currentColor}">${currentText}</tspan>`;
                }
            }
            currentColor = fgColor;
            currentText = displayChar;
        }
    }
    if (currentText !== "") {
        if (currentColor === "") {
            result += currentText;
        }
        else {
            result += `<tspan fill="${currentColor}">${currentText}</tspan>`;
        }
    }
    result += `</tspan>`;
    return result;
}
function printLogo() {
    console.log();
    for (const line of mascot_data_1.mascotLines) {
        let consoleLine = "";
        for (const item of line) {
            const char = item.char;
            if (item.fg && item.bg) {
                // both fg and bg
                const fgMatches = item.fg.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
                const bgMatches = item.bg.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
                if (fgMatches && bgMatches) {
                    const rF = parseInt(fgMatches[1], 16);
                    const gF = parseInt(fgMatches[2], 16);
                    const bF = parseInt(fgMatches[3], 16);
                    const rB = parseInt(bgMatches[1], 16);
                    const gB = parseInt(bgMatches[2], 16);
                    const bB = parseInt(bgMatches[3], 16);
                    consoleLine += chalk_1.default.rgb(rF, gF, bF).bgRgb(rB, gB, bB)(char);
                }
                else {
                    consoleLine += char;
                }
            }
            else if (item.fg) {
                const fgMatches = item.fg.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
                if (fgMatches) {
                    const rF = parseInt(fgMatches[1], 16);
                    const gF = parseInt(fgMatches[2], 16);
                    const bF = parseInt(fgMatches[3], 16);
                    consoleLine += chalk_1.default.rgb(rF, gF, bF)(char);
                }
                else {
                    consoleLine += char;
                }
            }
            else if (item.bg) {
                const bgMatches = item.bg.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
                if (bgMatches) {
                    const rB = parseInt(bgMatches[1], 16);
                    const gB = parseInt(bgMatches[2], 16);
                    const bB = parseInt(bgMatches[3], 16);
                    consoleLine += chalk_1.default.bgRgb(rB, gB, bB)(char);
                }
                else {
                    consoleLine += char;
                }
            }
            else {
                consoleLine += char;
            }
        }
        // Skip empty lines to remove vertical padding
        if (consoleLine.trim().length === 0)
            continue;
        // Center the mascot loosely by adding some spaces
        console.log("       " + consoleLine);
    }
    const titleLines = [
        "████████  ▄██████▄   █████████▄   ████████▄   ███",
        "  ███    ███    ███  ███    ███   ███    ███  ███",
        "  ███    ██████████  █████████▀   ███    ███  ███",
        "  ███    ███    ███  ███  ▀██▄    ███    ███  ███",
        "  ███    ███    ███  ███    ▀██▄  ████████▀   ███"
    ];
    console.log();
    for (const line of titleLines) {
        let consoleLine = "";
        for (let x = 0; x < line.length; x++) {
            const char = line[x];
            if (char === ' ') {
                consoleLine += ' ';
                continue;
            }
            const factor = x / 49;
            const r = Math.round(0 + factor * 243);
            const g = Math.round(242 + factor * (85 - 242));
            const b = Math.round(254 + factor * (218 - 254));
            consoleLine += chalk_1.default.rgb(r, g, b)(char);
        }
        console.log("     " + consoleLine);
    }
    console.log();
    const subtitle = "  tardi-cli v1.0.0 • Deterministic testing for LLM agents";
    console.log(chalk_1.default.cyan.bold(subtitle));
    console.log();
}
function generateSVG() {
    const titleLines = [
        "████████  ▄██████▄   █████████▄   ████████▄   ███",
        "  ███    ███    ███  ███    ███   ███    ███  ███",
        "  ███    ██████████  █████████▀   ███    ███  ███",
        "  ███    ███    ███  ███  ▀██▄    ███    ███  ███",
        "  ███    ███    ███  ███    ▀██▄  ████████▀   ███"
    ];
    let textElements = "";
    // Render mascot lines to SVG
    for (let y = 0; y < mascot_data_1.mascotLines.length; y++) {
        const line = mascot_data_1.mascotLines[y];
        const charsAndColors = line.map(item => ({
            char: item.char,
            color: item.fg,
            bg: item.bg
        }));
        textElements += "    " + renderLineToSVG(charsAndColors, 13) + "\n";
    }
    // Spacing between mascot and title
    textElements += `    <tspan x="85" dy="20"> </tspan>\n`;
    // Render title lines to SVG
    for (let y = 0; y < titleLines.length; y++) {
        const line = titleLines[y];
        const charsAndColors = [];
        for (let x = 0; x < line.length; x++) {
            const char = line[x];
            if (char === ' ') {
                charsAndColors.push({ char, color: "", bg: null });
            }
            else {
                const factor = x / 49;
                const r = Math.round(0 + factor * 243);
                const g = Math.round(242 + factor * (85 - 242));
                const b = Math.round(254 + factor * (218 - 254));
                const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
                charsAndColors.push({ char, color: hex, bg: null });
            }
        }
        textElements += "    " + renderLineToSVG(charsAndColors, 13) + "\n";
    }
    // Subtitle line
    textElements += `    <tspan x="45" dy="30" fill="#00F2FE" font-weight="bold">  tardi-cli v1.0.0 • Deterministic testing for LLM agents</tspan>\n`;
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 460" width="650" height="460">
  <style>
    .ascii {
      font-family: Consolas, "Courier New", monospace;
      font-size: 11px;
      line-height: 14px;
    }
  </style>
  <rect width="100%" height="100%" fill="#0a0a16" rx="10"/>
  
  <text x="25" y="30" class="ascii" xml:space="preserve">
${textElements}  </text>
</svg>
`;
    // Ensure assets directory exists
    const assetsDir = path.join("D:\\CLI\\agent-harness", "assets");
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(assetsDir, "tardi-logo.svg"), svgContent, "utf8");
}
