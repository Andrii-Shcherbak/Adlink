import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function downloadQRCode(qrRef: HTMLDivElement, filename: string) {
  const svg = qrRef.querySelector('svg');
  if (!svg) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size to match SVG
  const svgSize = svg.viewBox.baseVal.width;
  canvas.width = svgSize * 4; // Multiply by 4 for better quality
  canvas.height = svgSize * 4;

  // Create image from SVG
  const img = new Image();
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    // Fill background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw SVG
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Convert to PNG and download
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    URL.revokeObjectURL(url);
  };

  img.src = url;
}