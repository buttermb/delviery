// ============================================
// QR Code Placeholder Component
// ============================================

interface QRCodePlaceholderProps {
  value: string;
  size?: number;
}

export function QRCodePlaceholder({ value, size = 128 }: QRCodePlaceholderProps) {
  // Basic SVG QR code placeholder - swap with qrcode.react when ready
  const gridSize = 21;
  const cellSize = size / gridSize;

  // Generate a deterministic pattern from the value string
  const cells: boolean[][] = [];
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }

  for (let row = 0; row < gridSize; row++) {
    cells[row] = [];
    for (let col = 0; col < gridSize; col++) {
      // Fixed patterns for QR finder patterns (corners)
      const isFinderPattern =
        (row < 7 && col < 7) ||
        (row < 7 && col >= gridSize - 7) ||
        (row >= gridSize - 7 && col < 7);

      if (isFinderPattern) {
        const inOuter = row < 7 && col < 7
          ? (row === 0 || row === 6 || col === 0 || col === 6)
          : row < 7 && col >= gridSize - 7
            ? (row === 0 || row === 6 || col === gridSize - 7 || col === gridSize - 1)
            : (row === gridSize - 7 || row === gridSize - 1 || col === 0 || col === 6);
        const inInner = row < 7 && col < 7
          ? (row >= 2 && row <= 4 && col >= 2 && col <= 4)
          : row < 7 && col >= gridSize - 7
            ? (row >= 2 && row <= 4 && col >= gridSize - 5 && col <= gridSize - 3)
            : (row >= gridSize - 5 && row <= gridSize - 3 && col >= 2 && col <= 4);
        cells[row][col] = inOuter || inInner;
      } else {
        // Pseudo-random for data area
        const seed = (hash + row * 37 + col * 53) & 0xFFFFFF;
        cells[row][col] = (seed % 3) !== 0;
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="border rounded">
      <rect width={size} height={size} fill="white" />
      {cells.map((row, rowIdx) =>
        row.map((filled, colIdx) =>
          filled ? (
            <rect
              key={`${rowIdx}-${colIdx}`}
              x={colIdx * cellSize}
              y={rowIdx * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null
        )
      )}
    </svg>
  );
}
