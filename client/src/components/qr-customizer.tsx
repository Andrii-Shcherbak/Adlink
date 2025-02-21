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
  { name: "Squares", value: "squares", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5,5 h10v10h-10z M20,5 h10v10h-10z M35,5 h10v10h-10z M5,20 h10v10h-10z M20,20 h10v10h-10z M35,20 h10v10h-10z M5,35 h10v10h-10z M20,35 h10v10h-10z M35,35 h10v10h-10z' fill='currentColor'/%3E%3C/svg%3E" },
  { name: "Dots", value: "dots", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='4' fill='currentColor'/%3E%3Ccircle cx='25' cy='10' r='4' fill='currentColor'/%3E%3Ccircle cx='40' cy='10' r='4' fill='currentColor'/%3E%3Ccircle cx='10' cy='25' r='4' fill='currentColor'/%3E%3Ccircle cx='25' cy='25' r='4' fill='currentColor'/%3E%3Ccircle cx='40' cy='25' r='4' fill='currentColor'/%3E%3Ccircle cx='10' cy='40' r='4' fill='currentColor'/%3E%3Ccircle cx='25' cy='40' r='4' fill='currentColor'/%3E%3Ccircle cx='40' cy='40' r='4' fill='currentColor'/%3E%3C/svg%3E" },
  { name: "Rounded", value: "rounded", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='5' y='5' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='20' y='5' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='35' y='5' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='5' y='20' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='20' y='20' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='35' y='20' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='5' y='35' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='20' y='35' width='10' height='10' rx='2' fill='currentColor'/%3E%3Crect x='35' y='35' width='10' height='10' rx='2' fill='currentColor'/%3E%3C/svg%3E" },
  { name: "Classy", value: "classy", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5,5 h40 v5 h-40z M5,10 h5 v30 h-5z M40,10 h5 v30 h-5z M5,40 h40 v5 h-40z M15,15 h5v5h-5z M25,15 h5v5h-5z M35,15 h5v5h-5z M15,25 h5v5h-5z M25,25 h5v5h-5z M35,25 h5v5h-5z M15,35 h5v5h-5z M25,35 h5v5h-5z M35,35 h5v5h-5z' fill='currentColor'/%3E%3C/svg%3E" },
  { name: "Elegant", value: "elegant", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,10 l15,15 l15,-15 l-5,5 l-10,10 l-10,-10z M10,25 l15,15 l15,-15 l-5,5 l-10,10 l-10,-10z' fill='currentColor'/%3E%3C/svg%3E" },
];

const cornerStyles = [
  { name: "Square", value: "square", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5,5 h15v15h-15z M30,5 h15v15h-15z M5,30 h15v15h-15z' fill='currentColor'/%3E%3C/svg%3E" },
  { name: "Dot", value: "dot", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12.5' cy='12.5' r='7.5' fill='currentColor'/%3E%3Ccircle cx='37.5' cy='12.5' r='7.5' fill='currentColor'/%3E%3Ccircle cx='12.5' cy='37.5' r='7.5' fill='currentColor'/%3E%3C/svg%3E" },
  { name: "Extra Rounded", value: "extra-rounded", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='5' y='5' width='15' height='15' rx='7.5' fill='currentColor'/%3E%3Crect x='30' y='5' width='15' height='15' rx='7.5' fill='currentColor'/%3E%3Crect x='5' y='30' width='15' height='15' rx='7.5' fill='currentColor'/%3E%3C/svg%3E" },
];

const frameStyles = [
  { name: "None", value: "none", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10,10 h30v30h-30z' fill='currentColor' fill-opacity='0.2'/%3E%3C/svg%3E" },
  { name: "Simple", value: "simple", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='5' y='5' width='40' height='40' stroke='currentColor' fill='none' stroke-width='2'/%3E%3Crect x='15' y='15' width='20' height='20' fill='currentColor'/%3E%3C/svg%3E" },
  { name: "Dots", value: "dots", previewUrl: "data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='5' cy='5' r='2' fill='currentColor'/%3E%3Ccircle cx='15' cy='5' r='2' fill='currentColor'/%3E%3Ccircle cx='25' cy='5' r='2' fill='currentColor'/%3E%3Ccircle cx='35' cy='5' r='2' fill='currentColor'/%3E%3Ccircle cx='45' cy='5' r='2' fill='currentColor'/%3E%3Ccircle cx='5' cy='45' r='2' fill='currentColor'/%3E%3Ccircle cx='15' cy='45' r='2' fill='currentColor'/%3E%3Ccircle cx='25' cy='45' r='2' fill='currentColor'/%3E%3Ccircle cx='35' cy='45' r='2' fill='currentColor'/%3E%3Ccircle cx='45' cy='45' r='2' fill='currentColor'/%3E%3Ccircle cx='5' cy='15' r='2' fill='currentColor'/%3E%3Ccircle cx='5' cy='25' r='2' fill='currentColor'/%3E%3Ccircle cx='5' cy='35' r='2' fill='currentColor'/%3E%3Ccircle cx='45' cy='15' r='2' fill='currentColor'/%3E%3Ccircle cx='45' cy='25' r='2' fill='currentColor'/%3E%3Ccircle cx='45' cy='35' r='2' fill='currentColor'/%3E%3Crect x='15' y='15' width='20' height='20' fill='currentColor'/%3E%3C/svg%3E" },
];

interface QrCustomizerProps {
  url: string;
  config: QrConfig;
  onSave: (config: QrConfig) => void;
}

export function QrCustomizer({ url, config, onSave }: QrCustomizerProps) {
  const [localConfig, setLocalConfig] = useState<QrConfig>(config);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (qrRef.current) {
      downloadQRCode(qrRef.current, `qr-${url.split('/').pop()}`);
    }
  };

  const StylePreview = ({ style, isSelected, onClick }: { style: { name: string; value: string; previewUrl: string }; isSelected: boolean; onClick: () => void }) => (
    <Button
      variant="outline"
      className={cn("h-auto p-2 flex flex-col gap-1 relative", {
        'ring-2 ring-primary': isSelected
      })}
      onClick={onClick}
    >
      <div className="w-20 h-20 flex items-center justify-center bg-background rounded-md">
        <div className="w-12 h-12" style={{ 
          WebkitMaskImage: `url(${style.previewUrl})`,
          maskImage: `url(${style.previewUrl})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          backgroundColor: localConfig.fgColor
        }} />
      </div>
      <span className="text-xs">{style.name}</span>
    </Button>
  );

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
            <Tabs defaultValue="style" className="flex-1">
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
                          onClick={() => setLocalConfig(prev => ({
                            ...prev,
                            fgColor: preset.fg,
                            bgColor: preset.bg
                          }))}
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
                          onChange={(e) =>
                            setLocalConfig((prev) => ({ ...prev, fgColor: e.target.value }))
                          }
                          className="w-12 h-12 p-1"
                        />
                        <Input
                          type="text"
                          value={localConfig.fgColor}
                          onChange={(e) =>
                            setLocalConfig((prev) => ({ ...prev, fgColor: e.target.value }))
                          }
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
                        <StylePreview
                          key={style.value}
                          style={style}
                          isSelected={localConfig.pattern === style.value}
                          onClick={() => setLocalConfig(prev => ({ ...prev, pattern: style.value as QrConfig['pattern'] }))}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Corner Style</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {cornerStyles.map((style) => (
                        <StylePreview
                          key={style.value}
                          style={style}
                          isSelected={localConfig.cornerStyle === style.value}
                          onClick={() => setLocalConfig(prev => ({ ...prev, cornerStyle: style.value as QrConfig['cornerStyle'] }))}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cornerDotColor">Corner Dot Color</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="cornerDotColor"
                        type="color"
                        value={localConfig.cornerDotColor}
                        onChange={(e) =>
                          setLocalConfig((prev) => ({ ...prev, cornerDotColor: e.target.value }))
                        }
                        className="w-12 h-12 p-1"
                      />
                      <Input
                        type="text"
                        value={localConfig.cornerDotColor}
                        onChange={(e) =>
                          setLocalConfig((prev) => ({ ...prev, cornerDotColor: e.target.value }))
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cornerSquareColor">Corner Square Color</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="cornerSquareColor"
                        type="color"
                        value={localConfig.cornerSquareColor}
                        onChange={(e) =>
                          setLocalConfig((prev) => ({ ...prev, cornerSquareColor: e.target.value }))
                        }
                        className="w-12 h-12 p-1"
                      />
                      <Input
                        type="text"
                        value={localConfig.cornerSquareColor}
                        onChange={(e) =>
                          setLocalConfig((prev) => ({ ...prev, cornerSquareColor: e.target.value }))
                        }
                        className="flex-1"
                      />
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
                        <StylePreview
                          key={style.value}
                          style={style}
                          isSelected={localConfig.frameStyle === style.value}
                          onClick={() => setLocalConfig(prev => ({ ...prev, frameStyle: style.value as QrConfig['frameStyle'] }))}
                        />
                      ))}
                    </div>
                  </div>

                  {localConfig.frameStyle !== "none" && (
                    <div>
                      <Label htmlFor="frameColor">Frame Color</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          id="frameColor"
                          type="color"
                          value={localConfig.frameColor}
                          onChange={(e) =>
                            setLocalConfig((prev) => ({ ...prev, frameColor: e.target.value }))
                          }
                          className="w-12 h-12 p-1"
                        />
                        <Input
                          type="text"
                          value={localConfig.frameColor}
                          onChange={(e) =>
                            setLocalConfig((prev) => ({ ...prev, frameColor: e.target.value }))
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}

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
                      height: "100%"
                    }}
                    {...{
                      dotsOptions: {
                        type: localConfig.pattern,
                        color: localConfig.fgColor
                      },
                      cornersSquareOptions: {
                        type: localConfig.cornerStyle,
                        color: localConfig.cornerSquareColor
                      },
                      cornersDotOptions: {
                        type: localConfig.cornerStyle,
                        color: localConfig.cornerDotColor
                      },
                      frameOptions: localConfig.frameStyle !== "none" ? {
                        style: localConfig.frameStyle,
                        color: localConfig.frameColor
                      } : undefined
                    }}
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