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

  // Helper function to download the canvas as PNG
  const downloadCanvas = () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  img.onload = () => {
    // Fill background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw SVG
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Find logo image in the SVG
    const logoImg = svg.querySelector('image');
    if (logoImg) {
      // If there's a logo, wait for it to load before downloading
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = logoImg.getAttribute('href') || '';

      logo.onload = () => {
        // Get logo position and size from the SVG
        const logoX = parseFloat(logoImg.getAttribute('x') || '0');
        const logoY = parseFloat(logoImg.getAttribute('y') || '0');
        const logoWidth = parseFloat(logoImg.getAttribute('width') || '0');
        const logoHeight = parseFloat(logoImg.getAttribute('height') || '0');

        // Scale logo position and size to match canvas
        const scale = canvas.width / svgSize;
        ctx.drawImage(
          logo,
          logoX * scale,
          logoY * scale,
          logoWidth * scale,
          logoHeight * scale
        );
        downloadCanvas();
      };

      logo.onerror = () => {
        // If logo fails to load, download without it
        downloadCanvas();
      };
    } else {
      // If no logo, download immediately
      downloadCanvas();
    }

    // Cleanup
    URL.revokeObjectURL(url);
  };

  img.src = url;
}