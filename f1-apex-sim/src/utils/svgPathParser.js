/**
 * SVG Path Parser
 * Parses SVG path data and converts to points
 */

export class SVGPathParser {
  /**
   * Parse SVG path string to array of commands
   */
  static parsePath(pathString) {
    const commands = [];
    const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match;

    while ((match = regex.exec(pathString)) !== null) {
      const command = match[1];
      const params = match[2]
        .trim()
        .split(/[\s,]+/)
        .filter(p => p)
        .map(parseFloat);

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

    commands.forEach(({ command, params }) => {
      let absCommand = command.toUpperCase();
      let absParams = [...params];

      // Convert relative to absolute
      if (command === command.toLowerCase() && command !== 'z') {
        switch (absCommand) {
          case 'M':
          case 'L':
            absParams = absParams.map((p, i) => 
              i % 2 === 0 ? p + currentX : p + currentY
            );
            break;
          case 'H':
            absParams = absParams.map(p => p + currentX);
            break;
          case 'V':
            absParams = absParams.map(p => p + currentY);
            break;
          case 'C':
            absParams = absParams.map((p, i) => 
              i % 2 === 0 ? p + currentX : p + currentY
            );
            break;
          case 'Q':
            absParams = absParams.map((p, i) => 
              i % 2 === 0 ? p + currentX : p + currentY
            );
            break;
        }
      }

      // Update current position
      switch (absCommand) {
        case 'M':
          currentX = absParams[absParams.length - 2];
          currentY = absParams[absParams.length - 1];
          startX = currentX;
          startY = currentY;
          break;
        case 'L':
          currentX = absParams[absParams.length - 2];
          currentY = absParams[absParams.length - 1];
          break;
        case 'H':
          currentX = absParams[absParams.length - 1];
          break;
        case 'V':
          currentY = absParams[absParams.length - 1];
          break;
        case 'C':
          currentX = absParams[absParams.length - 2];
          currentY = absParams[absParams.length - 1];
          break;
        case 'Q':
          currentX = absParams[absParams.length - 2];
          currentY = absParams[absParams.length - 1];
          break;
        case 'Z':
          currentX = startX;
          currentY = startY;
          break;
      }

      absolute.push({ command: absCommand, params: absParams, x: currentX, y: currentY });
    });

    return absolute;
  }

  /**
   * Sample points along the path
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
          const steps = Math.ceil(Math.hypot(targetX - currentX, targetY - currentY) / 5);
          
          for (let i = 0; i <= steps; i++) {
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
          const bezierSteps = 50;
          
          for (let i = 0; i <= bezierSteps; i++) {
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
          const qSteps = 30;
          
          for (let i = 0; i <= qSteps; i++) {
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
