import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

function getSegmentShading(x: number): number {
    const creases = [18, 25, 32, 39];
    let minDistance = 999;
    for (const c of creases) {
        const dist = Math.abs(x - c);
        if (dist < minDistance) {
            minDistance = dist;
        }
    }
    if (minDistance === 0) return 0.45;
    if (minDistance === 1) return 0.75;
    return 1.0;
}

function getCharColorHex(lineIndex: number, x: number, char: string): string | null {
    if (char === ' ') return null;
    
    // Snout
    const isSnout = (lineIndex === 3 && x >= 6 && x <= 9) ||
                    (lineIndex === 4 && x >= 4 && x <= 8) ||
                    (lineIndex === 5 && x >= 4 && x <= 8) ||
                    (lineIndex === 6 && x >= 6 && x <= 9);
    if (isSnout) {
        return "#FF6E3C"; // Coral Snout
    }
    
    // Sunglasses
    const isSunglasses = (lineIndex === 3 || lineIndex === 4 || lineIndex === 5) && (x >= 14 && x <= 27);
    if (isSunglasses) {
        if (char === '█') return "#1E1E2D"; // Dark lenses
        return "#FFEB00"; // Neon Yellow Frame
    }
    
    // Claws (Line 9)
    if (lineIndex === 9) {
        const isFrontClaw = (x >= 16 && x <= 17) || (x >= 24 && x <= 25) || (x >= 32 && x <= 33) || (x >= 40 && x <= 41);
        const isBackClaw = (x >= 20 && x <= 21) || (x >= 28 && x <= 29) || (x >= 36 && x <= 37) || (x >= 44 && x <= 45);
        if (isFrontClaw) return "#FFFFFF";
        if (isBackClaw) return "#787878";
        return null;
    }
    
    // Gradient (Body, Legs, etc.)
    const mascotWidth = 46;
    const factor = Math.min(1, Math.max(0, x / mascotWidth));
    
    // Sunset gradient: Cyan (0, 242, 254) -> Hot Pink (243, 85, 218)
    const rBase = 0 + factor * 243;
    const gBase = 242 + factor * (85 - 242);
    const bBase = 254 + factor * (218 - 254);
    
    // Crease shading
    const shade = getSegmentShading(x);
    
    // Leg shading (Line 8 back legs)
    let legShade = 1.0;
    if (lineIndex === 8) {
        const isBackLeg = (x >= 20 && x <= 21) || (x >= 28 && x <= 29) || (x >= 36 && x <= 37) || (x >= 44 && x <= 45);
        if (isBackLeg) legShade = 0.45;
    }
    
    const r = Math.round(rBase * shade * legShade);
    const g = Math.round(gBase * shade * legShade);
    const b = Math.round(bBase * shade * legShade);
    
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function renderLineToSVG(charsAndColors: { char: string, color: string }[], dy: number = 13): string {
    let result = `<tspan x="85" dy="${dy}">`;
    let currentColor = "";
    let currentText = "";
    
    for (const item of charsAndColors) {
        if (item.char === ' ') {
            if (currentColor === "") {
                result += " ";
            } else {
                currentText += " ";
            }
            continue;
        }
        
        if (item.color === currentColor) {
            currentText += item.char;
        } else {
            if (currentText !== "") {
                if (currentColor === "") {
                    result += currentText;
                } else {
                    result += `<tspan fill="${currentColor}">${currentText}</tspan>`;
                }
            }
            currentColor = item.color;
            currentText = item.char;
        }
    }
    
    if (currentText !== "") {
        if (currentColor === "") {
            result += currentText;
        } else {
            result += `<tspan fill="${currentColor}">${currentText}</tspan>`;
        }
    }
    
    result += `</tspan>`;
    return result;
}

export function printLogo() {
    const rawMascot = [
        "               ▄▄████  ▄████  ▄████  ▄████▄",
        "             ▄████████████████████████████▄",
        "           ▄████████████████████████████████▄",
        "      ▄▄▄▄███ ▄▄▄▄▄▄▄▄▄▄▄▄▄▀ ██████████████████",
        "    █████████ ▄████████████▀ ████████████████",
        "    █████████ ▀██████████▀   ▄███████████████",
        "      ▀▀▀▀██████████████████████████████████",
        "             ▀██████████████████████████▀",
        "               ▀██  ██▀▀██  ██▀▀██  ██▀▀██  ██▀",
        "                ▀▀  ▀▀  ▀▀  ▀▀  ▀▀  ▀▀  ▀▀  ▀▀"
    ];

    const titleLines = [
        "████████  ▄██████▄   █████████▄   ████████▄   ███",
        "  ███    ███    ███  ███    ███   ███    ███  ███",
        "  ███    ██████████  █████████▀   ███    ███  ███",
        "  ███    ███    ███  ███  ▀██▄    ███    ███  ███",
        "  ███    ███    ███  ███    ▀██▄  ████████▀   ███"
    ];

    console.log();
    for (let y = 0; y < rawMascot.length; y++) {
        const line = rawMascot[y];
        let consoleLine = "";
        for (let x = 0; x < line.length; x++) {
            const char = line[x];
            const hex = getCharColorHex(y, x, char);
            if (hex) {
                consoleLine += chalk.hex(hex)(char);
            } else {
                consoleLine += char;
            }
        }
        console.log("       " + consoleLine);
    }

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
            consoleLine += chalk.rgb(r, g, b)(char);
        }
        console.log("     " + consoleLine);
    }
    console.log();
    
    const subtitle = "  🦠 tardi-cli v1.0.0 • Testing non-deterministic agents • Extreme resilience 🦠";
    console.log(chalk.cyan.bold(subtitle));
    console.log();
}

export function generateSVG() {
    const rawMascot = [
        "               ▄▄████  ▄████  ▄████  ▄████▄",
        "             ▄████████████████████████████▄",
        "           ▄████████████████████████████████▄",
        "      ▄▄▄▄███ ▄▄▄▄▄▄▄▄▄▄▄▄▄▀ ██████████████████",
        "    █████████ ▄████████████▀ ████████████████",
        "    █████████ ▀██████████▀   ▄███████████████",
        "      ▀▀▀▀██████████████████████████████████",
        "             ▀██████████████████████████▀",
        "               ▀██  ██▀▀██  ██▀▀██  ██▀▀██  ██▀",
        "                ▀▀  ▀▀  ▀▀  ▀▀  ▀▀  ▀▀  ▀▀  ▀▀"
    ];

    const titleLines = [
        "████████  ▄██████▄   █████████▄   ████████▄   ███",
        "  ███    ███    ███  ███    ███   ███    ███  ███",
        "  ███    ██████████  █████████▀   ███    ███  ███",
        "  ███    ███    ███  ███  ▀██▄    ███    ███  ███",
        "  ███    ███    ███  ███    ▀██▄  ████████▀   ███"
    ];

    let textElements = "";
    
    // Render mascot lines to SVG
    for (let y = 0; y < rawMascot.length; y++) {
        const line = rawMascot[y];
        const charsAndColors: { char: string, color: string }[] = [];
        
        for (let x = 0; x < line.length; x++) {
            const char = line[x];
            const hex = getCharColorHex(y, x, char) || "";
            charsAndColors.push({ char, color: hex });
        }
        
        textElements += "    " + renderLineToSVG(charsAndColors, 13) + "\n";
    }

    // Spacing between mascot and title
    textElements += `    <tspan x="85" dy="20"> </tspan>\n`;

    // Render title lines to SVG
    for (let y = 0; y < titleLines.length; y++) {
        const line = titleLines[y];
        const charsAndColors: { char: string, color: string }[] = [];
        
        for (let x = 0; x < line.length; x++) {
            const char = line[x];
            if (char === ' ') {
                charsAndColors.push({ char, color: "" });
            } else {
                const factor = x / 49;
                const r = Math.round(0 + factor * 243);
                const g = Math.round(242 + factor * (85 - 242));
                const b = Math.round(254 + factor * (218 - 254));
                const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
                charsAndColors.push({ char, color: hex });
            }
        }
        
        textElements += "    " + renderLineToSVG(charsAndColors, 13) + "\n";
    }

    // Subtitle line
    textElements += `    <tspan x="45" dy="30" fill="#00F2FE" font-weight="bold">  🦠 tardi-cli v1.0.0 • Testing non-deterministic agents • Extreme resilience 🦠</tspan>\n`;

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 360" width="650" height="360">
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
