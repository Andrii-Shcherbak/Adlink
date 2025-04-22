import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import type { QrConfig } from "@shared/schema";
import { Settings2, Download, Paintbrush, Layout, Image, Check, Loader2 } from "lucide-react";
import { downloadQRCode } from "@/lib/utils";
import { cn } from "@/lib/utils";

const colorPresets = [
  { name: "Classic", fg: "#000000", bg: "#FFFFFF" },
  { name: "ADNOC Blue", fg: "#003C71", bg: "#FFFFFF" },
  { name: "Inverse", fg: "#FFFFFF", bg: "#000000" },
  { name: "Forest", fg: "#2F5E3D", bg: "#E8F5E9" },
  { name: "Ocean", fg: "#1565C0", bg: "#E3F2FD" },
];

interface QrCustomizerProps {
  url: string;
  config: QrConfig;
  onSave: (config: QrConfig) => void;
}

export function QrCustomizer({ url, config, onSave }: QrCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<QrConfig>({
    ...config,
    fgColor: config.fgColor || "#000000",
    bgColor: config.bgColor || "#FFFFFF",
    includeMargin: config.includeMargin || false,
    logoUrl: config.logoUrl || ""
  });
  
  const qrRef = useRef<HTMLDivElement>(null);
  
  const handleDownload = () => {
    if (qrRef.current) {
      downloadQRCode(qrRef.current, `qr-${url.split('/').pop()}`);
    }
  };
  
  const updateColors = (color: string) => {
    setLocalConfig(prev => ({
      ...prev,
      fgColor: color
    }));
  };
  
  const handleSave = () => {
    setIsSaving(true);
    try {
      onSave(localConfig);
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="hover:bg-primary/10 transition-colors">
            <Settings2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[650px] p-6 rounded-lg shadow-lg">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">Customize QR Code</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-[1fr,auto] gap-6 pt-4">
            <Tabs defaultValue="style">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="style" className="flex items-center gap-2">
                  <Paintbrush className="h-4 w-4" /> Style
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
                          onClick={() => {
                            setLocalConfig(prev => ({
                              ...prev, 
                              fgColor: preset.fg,
                              bgColor: preset.bg
                            }));
                          }}
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

              <TabsContent value="frame" className="space-y-4">
                <div className="space-y-4">
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

            <Card className="w-[220px] p-5 bg-muted/50 border rounded-lg">
              <div className="space-y-4">
                <div 
                  className="flex justify-center p-4 bg-background rounded-lg shadow-sm" 
                  ref={qrRef}
                >
                  <QRCodeSVG
                    value={url}
                    size={170}
                    level="H"
                    fgColor={localConfig.fgColor}
                    bgColor={localConfig.bgColor}
                    includeMargin={localConfig.includeMargin}
                    imageSettings={
                      localConfig.logoUrl
                        ? {
                          src: localConfig.logoUrl,
                          height: 30,
                          width: 30,
                          excavate: true,
                        }
                        : undefined
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleSave} 
                    className="w-full"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleDownload} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          </div>
          
          <DialogFooter className="pt-4 border-t mt-6">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="icon" onClick={handleDownload} className="hover:bg-primary/10 transition-colors">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}