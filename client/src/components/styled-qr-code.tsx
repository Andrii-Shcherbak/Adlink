import { useEffect, useRef } from "react";
import QRCodeStyling, { type Options } from "qr-code-styling";
import type { QrConfig } from "@shared/schema";

export const defaultQrConfig: QrConfig = {
  fgColor: "#000000",
  bgColor: "#FFFFFF",
  includeMargin: false,
  logoUrl: "",
  pattern: "squares",
  cornerStyle: "square",
  frameStyle: "none",
  cornerDotColor: "#000000",
  cornerSquareColor: "#000000",
  frameColor: "#000000",
};

// Saved configs may predate some fields
export function normalizeQrConfig(config?: Partial<QrConfig> | null): QrConfig {
  const fgColor = config?.fgColor || defaultQrConfig.fgColor;
  return {
    ...defaultQrConfig,
    ...config,
    fgColor,
    bgColor: config?.bgColor || defaultQrConfig.bgColor,
    logoUrl: config?.logoUrl || "",
    pattern: config?.pattern || defaultQrConfig.pattern,
    cornerStyle: config?.cornerStyle || defaultQrConfig.cornerStyle,
    frameStyle: config?.frameStyle || defaultQrConfig.frameStyle,
    cornerDotColor: config?.cornerDotColor || fgColor,
    cornerSquareColor: config?.cornerSquareColor || fgColor,
    frameColor: config?.frameColor || fgColor,
  };
}

const dotTypes = {
  squares: "square",
  dots: "dots",
  rounded: "rounded",
  classy: "classy",
  elegant: "classy-rounded",
} as const;

const cornerDotTypes = {
  square: "square",
  dot: "dot",
  "extra-rounded": "dot",
} as const;

function qrOptions(value: string, config: QrConfig, size: number, withLogo = true): Partial<Options> {
  return {
    width: size,
    height: size,
    data: value,
    margin: config.includeMargin ? Math.round(size * 0.06) : 0,
    image: withLogo && config.logoUrl ? config.logoUrl : undefined,
    qrOptions: { errorCorrectionLevel: "H" },
    imageOptions: {
      crossOrigin: "anonymous",
      hideBackgroundDots: true,
      imageSize: 0.3,
      margin: Math.max(1, Math.round(size * 0.01)),
    },
    dotsOptions: { type: dotTypes[config.pattern], color: config.fgColor },
    cornersSquareOptions: { type: config.cornerStyle, color: config.cornerSquareColor },
    cornersDotOptions: { type: cornerDotTypes[config.cornerStyle], color: config.cornerDotColor },
    backgroundOptions: { color: config.bgColor },
  };
}

// Frame dimensions scale with the QR size so previews and downloads match
function frameMetrics(config: QrConfig, size: number) {
  if (config.frameStyle === "none") return { padding: 0, border: 0, radius: 0 };
  return {
    padding: Math.round(size * 0.05),
    border: Math.max(2, Math.round(size * 0.02)),
    radius: Math.round(size * 0.08),
  };
}

interface StyledQrCodeProps {
  value: string;
  config: QrConfig;
  size: number;
  className?: string;
}

export function StyledQrCode({ value, config, size, className }: StyledQrCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { padding, border, radius } = frameMetrics(config, size);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Rebuild rather than update(): update() merges options and can't remove a logo
    container.replaceChildren();
    new QRCodeStyling({ ...qrOptions(value, config, size), type: "svg" }).append(container);
  }, [value, size, JSON.stringify(config)]);

  return (
    <div
      className={className}
      style={{
        display: "inline-block",
        lineHeight: 0,
        padding,
        borderRadius: radius,
        border: border ? `${border}px ${config.frameStyle === "dots" ? "dotted" : "solid"} ${config.frameColor}` : undefined,
        background: config.frameStyle === "none" ? undefined : config.bgColor,
      }}
    >
      <div ref={containerRef} style={{ width: size, height: size }} />
    </div>
  );
}

async function renderQrPng(value: string, config: QrConfig, size: number): Promise<Blob> {
  try {
    const blob = await new QRCodeStyling({ ...qrOptions(value, config, size), type: "canvas" }).getRawData("png");
    if (blob instanceof Blob) return blob;
  } catch (error) {
    // Typically a logo host that doesn't allow cross-origin use
    console.warn("Could not render QR code with logo, retrying without it", error);
  }
  const blob = await new QRCodeStyling({ ...qrOptions(value, config, size, false), type: "canvas" }).getRawData("png");
  if (!(blob instanceof Blob)) throw new Error("Failed to render QR code");
  return blob;
}

/** Downloads the QR code as a PNG, including its frame. */
export async function downloadStyledQrCode(value: string, config: QrConfig, filename: string, size = 1024) {
  const qrImage = await createImageBitmap(await renderQrPng(value, config, size));
  const { padding, border, radius } = frameMetrics(config, size);
  const total = size + 2 * (padding + border);

  const canvas = document.createElement("canvas");
  canvas.width = total;
  canvas.height = total;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (config.frameStyle !== "none") {
    ctx.fillStyle = config.bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, total, total, radius + border);
    ctx.fill();

    ctx.strokeStyle = config.frameColor;
    ctx.lineWidth = border;
    if (config.frameStyle === "dots") {
      // Zero-length dashes with round caps draw as dots, like CSS `dotted`
      ctx.setLineDash([0, border * 2]);
      ctx.lineCap = "round";
    }
    ctx.beginPath();
    ctx.roundRect(border / 2, border / 2, total - border, total - border, radius + border / 2);
    ctx.stroke();
  }
  ctx.drawImage(qrImage, padding + border, padding + border, size, size);

  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) return;
  const href = URL.createObjectURL(png);
  const link = document.createElement("a");
  link.href = href;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
