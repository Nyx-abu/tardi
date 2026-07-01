import chalk from "chalk";

function colorizeGradient(text: string, xStart: number, totalWidth: number): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ' ') {
            result += ' ';
            continue;
        }
        const x = xStart + i;
        const factor = Math.min(1, Math.max(0, x / totalWidth));
        
        // Neon sunset gradient: Cyan (#00F2FE, 0, 242, 254) to Hot Pink (#F355DA, 243, 85, 218)
        const r = Math.round(0 + factor * 243);
        const g = Math.round(242 + factor * (85 - 242));
        const b = Math.round(254 + factor * (218 - 254));
        
        result += chalk.rgb(r, g, b)(char);
    }
    return result;
}

function colorizeSunglasses(text: string): string {
    let result = "";
    for (let char of text) {
        if (char === '█') {
            // Dark lens color
            result += chalk.rgb(30, 30, 45)(char);
        } else if (char === '▀' || char === '▄' || char === ' ') {
            // Neon Yellow Frame
            result += chalk.rgb(255, 235, 0).bold(char);
        } else {
            result += char;
        }
    }
    return result;
}

export function printLogo() {
    const snoutColor = chalk.rgb(255, 110, 60); // Coral snout
    const clawColor = chalk.white.bold; // White claws
    
    // Mascot is 45 characters wide
    const mascotWidth = 45;
    
    // We will render each line manually to apply the sections and colors correctly
    const mascotRendered: string[] = [];
    
    // Line 1: Indent 15, Body 22
    mascotRendered.push("               " + colorizeGradient("▄▄██████████████████▄▄", 15, mascotWidth));
    
    // Line 2: Indent 13, Body 24
    mascotRendered.push("             " + colorizeGradient("▄██████████████████████▄", 13, mascotWidth));
    
    // Line 3: Indent 11, Body 30
    mascotRendered.push("           " + colorizeGradient("▄████████████████████████████▄", 11, mascotWidth));
    
    // Line 4: Indent 5, Snout 2, Space 3, Head 3, Space 1, Sunglasses 11, Space 1, Body 16
    mascotRendered.push(
        "     " + 
        snoutColor("▄▄") + 
        "   " + 
        colorizeGradient("███", 10, mascotWidth) + 
        " " + 
        colorizeSunglasses("▄▄▄▄▄▄▄▄▄▄▄") + 
        " " + 
        colorizeGradient("████████████████", 26, mascotWidth)
    );
    
    // Line 5: Indent 4, Snout 4, Space 2, Head 3, Space 1, Sunglasses 13, Space 1, Body 16
    mascotRendered.push(
        "    " + 
        snoutColor("█  █") + 
        "  " + 
        colorizeGradient("███", 10, mascotWidth) + 
        " " + 
        colorizeSunglasses("▀████ ▀ ████▀") + 
        " " + 
        colorizeGradient("████████████████", 28, mascotWidth)
    );
    
    // Line 6: Indent 4, Snout 4, Space 2, Head 3, Space 1, Sunglasses 13, Space 1, Body 16
    mascotRendered.push(
        "    " + 
        snoutColor("█  █") + 
        "  " + 
        colorizeGradient("███", 10, mascotWidth) + 
        " " + 
        colorizeSunglasses("▄████   ▄████") + 
        " " + 
        colorizeGradient("▄███████████████", 28, mascotWidth)
    );
    
    // Line 7: Indent 5, Snout 3, Space 3, Body 32
    mascotRendered.push(
        "     " + 
        snoutColor("▀▄▀") + 
        "   " + 
        colorizeGradient("▀██████████████████████████████▀", 11, mascotWidth)
    );
    
    // Line 8: Indent 13, Body 28
    mascotRendered.push("             " + colorizeGradient("▀██████████████████████████▀", 13, mascotWidth));
    
    // Line 9: Indent 15, Legs 29
    mascotRendered.push("               " + colorizeGradient("▀████▀▀▀▀████▀▀▀▀████▀▀▀▀███▀", 15, mascotWidth));
    
    // Line 10: Indent 17, Claws 26
    mascotRendered.push(
        "                 " + 
        clawColor("▀▀") + "     " + 
        clawColor("▀▀") + "     " + 
        clawColor("▀▀") + "     " + 
        clawColor("▀▀")
    );
    
    // Title is 49 characters wide
    const titleWidth = 49;
    const titleLines = [
        "████████  ▄██████▄   █████████▄   ████████▄   ███",
        "  ███    ███    ███  ███    ███   ███    ███  ███",
        "  ███    ██████████  █████████▀   ███    ███  ███",
        "  ███    ███    ███  ███  ▀██▄    ███    ███  ███",
        "  ███    ███    ███  ███    ▀██▄  ████████▀   ███"
    ];
    
    // Colorize the title
    const titleRendered = titleLines.map(line => colorizeGradient(line, 0, titleWidth));
    
    console.log();
    for (const line of mascotRendered) {
        console.log("       " + line);
    }
    console.log();
    for (const line of titleRendered) {
        console.log("     " + line);
    }
    console.log();
    
    const subtitle = "  🦠 tardi-cli v1.0.0 • Testing non-deterministic agents • Extreme resilience 🦠";
    console.log(chalk.cyan.bold(subtitle));
    console.log();
}
