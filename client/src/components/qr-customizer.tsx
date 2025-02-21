import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { QRCodeSVG } from "qrcode.react";
import type { QrConfig } from "@shared/schema";
import { Settings2 } from "lucide-react";

interface QrCustomizerProps {
  url: string;
  config: QrConfig;
  onSave: (config: QrConfig) => void;
}

export function QrCustomizer({ url, config, onSave }: QrCustomizerProps) {
  const [localConfig, setLocalConfig] = useState<QrConfig>(config);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Customize QR Code</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 items-center gap-4">
            <div>
              <Label htmlFor="fgColor">QR Color</Label>
              <Input
                id="fgColor"
                type="color"
                value={localConfig.fgColor}
                onChange={(e) =>
                  setLocalConfig((prev) => ({ ...prev, fgColor: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="bgColor">Background</Label>
              <Input
                id="bgColor"
                type="color"
                value={localConfig.bgColor}
                onChange={(e) =>
                  setLocalConfig((prev) => ({ ...prev, bgColor: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Label htmlFor="margin">Include Margin</Label>
            <Switch
              id="margin"
              checked={localConfig.includeMargin}
              onCheckedChange={(checked) =>
                setLocalConfig((prev) => ({ ...prev, includeMargin: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>QR Style</Label>
            <RadioGroup
              value={localConfig.qrStyle}
              onValueChange={(value: "dots" | "squares") =>
                setLocalConfig((prev) => ({ ...prev, qrStyle: value }))
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dots" id="dots" />
                <Label htmlFor="dots">Dots</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="squares" id="squares" />
                <Label htmlFor="squares">Squares</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input
              id="logoUrl"
              value={localConfig.logoUrl}
              onChange={(e) =>
                setLocalConfig((prev) => ({ ...prev, logoUrl: e.target.value }))
              }
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="flex justify-center p-4 bg-muted rounded-lg">
            <QRCodeSVG
              value={url}
              size={150}
              level="H"
              {...localConfig}
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

          <Button onClick={() => onSave(localConfig)}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
