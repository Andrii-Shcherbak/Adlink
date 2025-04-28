import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FiLock } from "react-icons/fi";

export default function ProtectedUrl() {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [location] = useLocation();
  const shortCode = location.split("/").pop();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/${shortCode}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        throw new Error("Invalid password");
      }

      const data = await res.json();
      // Check if this is a PDF document URL
      if (data.isPdfDocument) {
        // Navigate to the URL within our application, which will show the PDF in our viewer
        window.location.href = data.redirectUrl;
      } else {
        // For regular URLs, proceed with the direct redirect
        window.location.href = data.redirectUrl;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid password. Please try again.",
        variant: "destructive",
      });
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <FiLock className="h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">Protected Link</h1>
          <p className="text-muted-foreground">
            This link is password protected. Please enter the password to continue.
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Verifying..." : "Continue"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
