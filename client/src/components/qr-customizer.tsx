import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import type { QrConfig } from "@shared/schema";
import { Settings2, Download, Paintbrush, Layout, Image } from "lucide-react";
import { downloadQRCode } from "@/lib/utils";
import { cn } from "@/lib/utils";

const colorPresets = [
  { name: "Classic", fg: "#000000", bg: "#FFFFFF" },
  { name: "ADNOC Blue", fg: "#003C71", bg: "#FFFFFF" },
  { name: "Inverse", fg: "#FFFFFF", bg: "#000000" },
  { name: "Forest", fg: "#2F5E3D", bg: "#E8F5E9" },
  { name: "Ocean", fg: "#1565C0", bg: "#E3F2FD" },
];

const patternStyles = [
  { name: "Squares", value: "squares" },
  { name: "Dots", value: "dots" },
  { name: "Rounded", value: "rounded" },
  { name: "Classy", value: "classy" },
  { name: "Elegant", value: "elegant" },
];

const cornerStyles = [
  { name: "Square", value: "square" },
  { name: "Dot", value: "dot" },
  { name: "Extra Rounded", value: "extra-rounded" },
];

const frameStyles = [
  { name: "None", value: "none" },
  { name: "Simple", value: "simple" },
  { name: "Dots", value: "dots" },
];

interface QrCustomizerProps {
  url: string;
  config: QrConfig;
  onSave: (config: QrConfig) => void;
}

export function QrCustomizer({ url, config, onSave }: QrCustomizerProps) {
  const [localConfig, setLocalConfig] = useState<QrConfig>({
    ...config,
    cornerDotColor: config.cornerDotColor || config.fgColor,
    cornerSquareColor: config.cornerSquareColor || config.fgColor,
    frameColor: config.frameColor || config.fgColor,
  });
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (qrRef.current) {
      downloadQRCode(qrRef.current, `qr-${url.split('/').pop()}`);
    }
  };

  const StyleButton = ({ style, type }: {
    style: { name: string; value: string };
    type: "pattern" | "cornerStyle" | "frame";
  }) => (
    <Button
      variant="outline"
      className={cn("h-auto p-2 flex flex-col gap-1 relative", {
        'ring-2 ring-primary':
          type === "pattern" ? localConfig.pattern === style.value :
            type === "cornerStyle" ? localConfig.cornerStyle === style.value :
              localConfig.frameStyle === style.value
      })}
      onClick={() => {
        if (type === "pattern") {
          setLocalConfig(prev => ({ ...prev, pattern: style.value as QrConfig["pattern"] }));
        } else if (type === "cornerStyle") {
          setLocalConfig(prev => ({ ...prev, cornerStyle: style.value as QrConfig["cornerStyle"] }));
        } else {
          setLocalConfig(prev => ({ ...prev, frameStyle: style.value as QrConfig["frameStyle"] }));
        }
      }}
    >
      <div className="w-20 h-20 flex items-center justify-center bg-background rounded-md">
        <QRCodeSVG
          value={style.name}
          size={60}
          level="Q"
          fgColor={localConfig.fgColor}
          bgColor={localConfig.bgColor}
          {...(type === "pattern" && {
            style: {
              // Apply pattern styles through CSS
              moduleShape: style.value === "dots" ? "circle" : "square",
              moduleSize: style.value === "rounded" ? 0.5 : 1,
              borderRadius: style.value === "rounded" ? "50%" : "0",
            }
          })}
          {...(type === "cornerStyle" && {
            cornerSquareOptions: {
              type: style.value,
              color: localConfig.cornerSquareColor,
            },
            cornerDotOptions: {
              type: style.value,
              color: localConfig.cornerDotColor,
            },
          })}
          {...(type === "frame" && style.value !== "none" && {
            frameOptions: {
              style: style.value,
              width: 5,
              height: 5,
              color: localConfig.frameColor,
            },
          })}
        />
      </div>
      <span className="text-xs capitalize">{style.name}</span>
    </Button>
  );

  const updateColors = (color: string) => {
    setLocalConfig(prev => ({
      ...prev,
      fgColor: color,
      cornerDotColor: color,
      cornerSquareColor: color,
      frameColor: color,
    }));
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Customize QR Code</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-[1fr,auto] gap-6">
            <Tabs defaultValue="style">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="style" className="flex items-center gap-2">
                  <Paintbrush className="h-4 w-4" /> Style
                </TabsTrigger>
                <TabsTrigger value="pattern" className="flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z" />
                  </svg>
                  Pattern
                </TabsTrigger>
                <TabsTrigger value="frame" className="flex items-center gap-2">
                  <Layout className="h-4 w-4" /> Frame
                </TabsTrigger>
                <TabsTrigger value="logo" className="flex items-center gap-2">
                  <Image className="h-4 w-4" /> Logo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="style" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Color Presets</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {colorPresets.map((preset) => (
                        <Button
                          key={preset.name}
                          variant="outline"
                          className={cn("h-auto p-2 flex flex-col gap-1", {
                            'ring-2 ring-primary': localConfig.fgColor === preset.fg && localConfig.bgColor === preset.bg
                          })}
                          onClick={() => updateColors(preset.fg)}
                        >
                          <div className="w-full aspect-square rounded-md" style={{ background: preset.bg }}>
                            <div className="w-1/2 h-1/2 m-auto" style={{ background: preset.fg }} />
                          </div>
                          <span className="text-xs">{preset.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fgColor">QR Color</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          id="fgColor"
                          type="color"
                          value={localConfig.fgColor}
                          onChange={(e) => updateColors(e.target.value)}
                          className="w-12 h-12 p-1"
                        />
                        <Input
                          type="text"
                          value={localConfig.fgColor}
                          onChange={(e) => updateColors(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bgColor">Background</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          id="bgColor"
                          type="color"
                          value={localConfig.bgColor}
                          onChange={(e) =>
                            setLocalConfig((prev) => ({ ...prev, bgColor: e.target.value }))
                          }
                          className="w-12 h-12 p-1"
                        />
                        <Input
                          type="text"
                          value={localConfig.bgColor}
                          onChange={(e) =>
                            setLocalConfig((prev) => ({ ...prev, bgColor: e.target.value }))
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pattern" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Pattern Style</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {patternStyles.map((style) => (
                        <StyleButton
                          key={style.value}
                          style={style}
                          type="pattern"
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Corner Style</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {cornerStyles.map((style) => (
                        <StyleButton
                          key={style.value}
                          style={style}
                          type="cornerStyle"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="frame" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Frame Style</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {frameStyles.map((style) => (
                        <StyleButton
                          key={style.value}
                          style={style}
                          type="frame"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="margin">Include Margin</Label>
                    <Switch
                      id="margin"
                      checked={localConfig.includeMargin}
                      onCheckedChange={(checked) =>
                        setLocalConfig((prev) => ({ ...prev, includeMargin: checked }))
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="logo" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={localConfig.logoUrl}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({ ...prev, logoUrl: e.target.value }))
                      }
                      placeholder="https://example.com/logo.png"
                      className="mt-2"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Card className="w-[200px] p-4 bg-muted">
              <div className="space-y-4">
                <div className="flex justify-center p-4 bg-background rounded-lg" ref={qrRef}>
                  <QRCodeSVG
                    value={url}
                    size={150}
                    level="H"
                    fgColor={localConfig.fgColor}
                    bgColor={localConfig.bgColor}
                    includeMargin={localConfig.includeMargin}
                    style={{
                      width: "100%",
                      height: "100%",
                      ...(localConfig.pattern === "dots" && {
                        moduleShape: "circle"
                      }),
                      ...(localConfig.pattern === "rounded" && {
                        moduleSize: 0.5,
                        borderRadius: "50%"
                      })
                    }}
                    cornerSquareOptions={{
                      type: localConfig.cornerStyle,
                      color: localConfig.cornerSquareColor,
                    }}
                    cornerDotOptions={{
                      type: localConfig.cornerStyle,
                      color: localConfig.cornerDotColor,
                    }}
                    {...(localConfig.frameStyle !== "none" && {
                      frameOptions: {
                        style: localConfig.frameStyle,
                        width: 5,
                        height: 5,
                        color: localConfig.frameColor,
                      }
                    })}
                    imageSettings={
                      localConfig.logoUrl
                        ? {
                            src: localConfig.logoUrl,
                            height: 24,
                            width: 24,
                            excavate: true,
                          }
                        : undefined
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => onSave(localConfig)}>Save Changes</Button>
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="icon" onClick={handleDownload}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}