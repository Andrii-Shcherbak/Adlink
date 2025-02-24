import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Url } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Security level type definition
export type SecurityLevel = 'high' | 'medium' | 'low';

// Function to determine URL security level
export function getUrlSecurityLevel(url: Url): SecurityLevel {
  if (url.isPasswordProtected) {
    return 'high';
  }

  // Check if URL is potentially risky (you can expand this logic)
  const riskyDomains = ['bit.ly', 'tinyurl.com', 'goo.gl'];
  try {
    const domain = new URL(url.originalUrl).hostname;
    if (riskyDomains.some(d => domain.includes(d))) {
      return 'low';
    }
  } catch (e) {
    return 'low';
  }

  return 'medium';
}

// Get color classes based on security level
export function getSecurityColorClasses(level: SecurityLevel): {
  text: string;
  bg: string;
  border: string;
} {
  switch (level) {
    case 'high':
      return {
        text: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800'
      };
    case 'low':
      return {
        text: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800'
      };
    default:
      return {
        text: 'text-yellow-700 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800'
      };
  }
}

// Keep existing downloadQRCode function
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