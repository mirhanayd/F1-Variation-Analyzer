/**
 * SVG Path Parser
 * Uses browser's native SVG path API for accurate parsing
 */

export class SVGPathParser {
  /**
   * Parse SVG path string to array of commands (legacy method, kept for compatibility)
   */
  static parsePath(pathString) {
    const commands = [];
    // Improved regex that handles negative numbers properly
    const regex = /([MmLlHhVvCcSsQqTtAaZz])([-\d.,eE\s]*)/g;
    let match;

    while ((match = regex.exec(pathString)) !== null) {
      const command = match[1];
      // Split by whitespace or comma, but keep negative numbers together
      const paramString = match[2].trim();
      const params = [];

      if (paramString) {
        // Handle negative numbers properly: "-1.5-2.3" should be [-1.5, -2.3]
        const numberRegex = /-?[\d.]+(?:e[-+]?\d+)?/gi;
        let numMatch;
        while ((numMatch = numberRegex.exec(paramString)) !== null) {
          params.push(parseFloat(numMatch[0]));
        }
      }

      commands.push({ command, params });
    }

    return commands;
  }

  /**
   * Convert SVG commands to absolute coordinates
   */
  static toAbsolute(commands) {
    const absolute = [];
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    let lastControlX = 0;
    let lastControlY = 0;

    commands.forEach(({ command, params }) => {
      const isRelative = command === command.toLowerCase();
      const cmd = command.toUpperCase();
      let absParams = [];

      switch (cmd) {
        case 'M':
          // Move to - can have multiple coordinate pairs (implicit line-to)
          for (let i = 0; i < params.length; i += 2) {
            let x = params[i];
            let y = params[i + 1];
            if (isRelative) {
              x += currentX;
              y += currentY;
            }
            if (i === 0) {
              startX = x;
              startY = y;
            }
            currentX = x;
            currentY = y;
            absolute.push({
              command: i === 0 ? 'M' : 'L',
              params: [x, y],
              x: currentX,
              y: currentY
            });
          }
          return;

        case 'L':
          // Line to - multiple coordinate pairs
          for (let i = 0; i < params.length; i += 2) {
            let x = params[i];
            let y = params[i + 1];
            if (isRelative) {
              x += currentX;
              y += currentY;
            }
            currentX = x;
            currentY = y;
            absolute.push({ command: 'L', params: [x, y], x: currentX, y: currentY });
          }
          return;

        case 'H':
          // Horizontal line
          for (let i = 0; i < params.length; i++) {
            let x = params[i];
            if (isRelative) x += currentX;
            currentX = x;
            absolute.push({ command: 'L', params: [currentX, currentY], x: currentX, y: currentY });
          }
          return;

        case 'V':
          // Vertical line
          for (let i = 0; i < params.length; i++) {
            let y = params[i];
            if (isRelative) y += currentY;
            currentY = y;
            absolute.push({ command: 'L', params: [currentX, currentY], x: currentX, y: currentY });
          }
          return;

        case 'C':
          // Cubic bezier - 6 params per curve (cp1x, cp1y, cp2x, cp2y, endX, endY)
          for (let i = 0; i < params.length; i += 6) {
            let cp1x = params[i];
            let cp1y = params[i + 1];
            let cp2x = params[i + 2];
            let cp2y = params[i + 3];
            let endX = params[i + 4];
            let endY = params[i + 5];

            if (isRelative) {
              cp1x += currentX;
              cp1y += currentY;
              cp2x += currentX;
              cp2y += currentY;
              endX += currentX;
              endY += currentY;
            }

            lastControlX = cp2x;
            lastControlY = cp2y;
            currentX = endX;
            currentY = endY;
            absolute.push({
              command: 'C',
              params: [cp1x, cp1y, cp2x, cp2y, endX, endY],
              x: currentX,
              y: currentY
            });
          }
          return;

        case 'S':
          // Smooth cubic bezier - 4 params per curve
          for (let i = 0; i < params.length; i += 4) {
            // First control point is reflection of last control point
            let cp1x = currentX + (currentX - lastControlX);
            let cp1y = currentY + (currentY - lastControlY);
            let cp2x = params[i];
            let cp2y = params[i + 1];
            let endX = params[i + 2];
            let endY = params[i + 3];

            if (isRelative) {
              cp2x += currentX;
              cp2y += currentY;
              endX += currentX;
              endY += currentY;
            }

            lastControlX = cp2x;
            lastControlY = cp2y;
            currentX = endX;
            currentY = endY;
            absolute.push({
              command: 'C',
              params: [cp1x, cp1y, cp2x, cp2y, endX, endY],
              x: currentX,
              y: currentY
            });
          }
          return;

        case 'Q':
          // Quadratic bezier - 4 params per curve
          for (let i = 0; i < params.length; i += 4) {
            let cpx = params[i];
            let cpy = params[i + 1];
            let endX = params[i + 2];
            let endY = params[i + 3];

            if (isRelative) {
              cpx += currentX;
              cpy += currentY;
              endX += currentX;
              endY += currentY;
            }

            lastControlX = cpx;
            lastControlY = cpy;
            currentX = endX;
            currentY = endY;
            absolute.push({
              command: 'Q',
              params: [cpx, cpy, endX, endY],
              x: currentX,
              y: currentY
            });
          }
          return;

        case 'T':
          // Smooth quadratic bezier - 2 params per curve
          for (let i = 0; i < params.length; i += 2) {
            // Control point is reflection of last control point
            let cpx = currentX + (currentX - lastControlX);
            let cpy = currentY + (currentY - lastControlY);
            let endX = params[i];
            let endY = params[i + 1];

            if (isRelative) {
              endX += currentX;
              endY += currentY;
            }

            lastControlX = cpx;
            lastControlY = cpy;
            currentX = endX;
            currentY = endY;
            absolute.push({
              command: 'Q',
              params: [cpx, cpy, endX, endY],
              x: currentX,
              y: currentY
            });
          }
          return;

        case 'A':
          // Arc - 7 params per arc
          for (let i = 0; i < params.length; i += 7) {
            const rx = params[i];
            const ry = params[i + 1];
            const xAxisRotation = params[i + 2];
            const largeArcFlag = params[i + 3];
            const sweepFlag = params[i + 4];
            let endX = params[i + 5];
            let endY = params[i + 6];

            if (isRelative) {
              endX += currentX;
              endY += currentY;
            }

            currentX = endX;
            currentY = endY;
            absolute.push({
              command: 'A',
              params: [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, endX, endY],
              x: currentX,
              y: currentY
            });
          }
          return;

        case 'Z':
          currentX = startX;
          currentY = startY;
          absolute.push({ command: 'Z', params: [], x: currentX, y: currentY });
          return;
      }
    });

    return absolute;
  }

  /**
   * Sample points along the path with improved accuracy
   */
  static samplePath(commands, numSamples = 1000) {
    const points = [];
    const absoluteCommands = this.toAbsolute(commands);

    let currentX = 0;
    let currentY = 0;

    absoluteCommands.forEach(({ command, params }) => {
      switch (command) {
        case 'M':
          currentX = params[0];
          currentY = params[1];
          points.push({ x: currentX, y: currentY });
          break;

        case 'L':
          const targetX = params[0];
          const targetY = params[1];
          const dist = Math.hypot(targetX - currentX, targetY - currentY);
          const steps = Math.max(Math.ceil(dist / 2), 1);

          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            points.push({
              x: currentX + (targetX - currentX) * t,
              y: currentY + (targetY - currentY) * t
            });
          }
          currentX = targetX;
          currentY = targetY;
          break;

        case 'C':
          // Cubic bezier
          const [cp1x, cp1y, cp2x, cp2y, endX, endY] = params;
          const bezierSteps = 30;

          for (let i = 1; i <= bezierSteps; i++) {
            const t = i / bezierSteps;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const t2 = t * t;
            const t3 = t2 * t;

            points.push({
              x: mt3 * currentX + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * endX,
              y: mt3 * currentY + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * endY
            });
          }
          currentX = endX;
          currentY = endY;
          break;

        case 'Q':
          // Quadratic bezier
          const [qcpx, qcpy, qendX, qendY] = params;
          const qSteps = 20;

          for (let i = 1; i <= qSteps; i++) {
            const t = i / qSteps;
            const mt = 1 - t;

            points.push({
              x: mt * mt * currentX + 2 * mt * t * qcpx + t * t * qendX,
              y: mt * mt * currentY + 2 * mt * t * qcpy + t * t * qendY
            });
          }
          currentX = qendX;
          currentY = qendY;
          break;

        case 'A':
          // Arc - approximate with line segments
          const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, arcEndX, arcEndY] = params;
          // Simple approximation: just add intermediate points
          const arcSteps = 20;
          for (let i = 1; i <= arcSteps; i++) {
            const t = i / arcSteps;
            points.push({
              x: currentX + (arcEndX - currentX) * t,
              y: currentY + (arcEndY - currentY) * t
            });
          }
          currentX = arcEndX;
          currentY = arcEndY;
          break;

        case 'Z':
          // Close path - line back to start if needed
          if (points.length > 0) {
            const startPoint = points[0];
            if (Math.hypot(currentX - startPoint.x, currentY - startPoint.y) > 1) {
              points.push({ x: startPoint.x, y: startPoint.y });
            }
          }
          break;
      }
    });

    return points;
  }

  /**
   * Get bounding box of points
   */
  static getBoundingBox(points) {
    if (points.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    points.forEach(({ x, y }) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  /**
   * Divide path into sectors
   */
  static dividePath(points, numSectors = 3) {
    const pointsPerSector = Math.floor(points.length / numSectors);
    const sectors = [];

    for (let i = 0; i < numSectors; i++) {
      const start = i * pointsPerSector;
      const end = i === numSectors - 1 ? points.length : (i + 1) * pointsPerSector;
      const sectorPoints = points.slice(start, end);

      sectors.push({
        id: i + 1,
        points: sectorPoints,
        boundingBox: this.getBoundingBox(sectorPoints),
        startIndex: start,
        endIndex: end
      });
    }

    return sectors;
  }
}
