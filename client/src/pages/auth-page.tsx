import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Redirect } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  FiLink,
  FiBarChart2,
  FiGlobe,
  FiCode,
  FiUser,
  FiLock,
  FiMail,
  FiBriefcase,
  FiArrowRight,
} from "react-icons/fi";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  // Initialize with the first feature active
  const [activeFeatures, setActiveFeatures] = useState<Record<number, boolean>>({
    0: true,
    1: false,
    2: false,
    3: false,
    4: false,
    5: false
  });
  
  // Define feature data
  const features = [
    {
      id: 1,
      icon: <FiLink className="h-6 w-6 text-blue-400" />,
      title: "AI-Powered Links",
      description: "Generate titles and custom shortcodes with our AI integration",
      color: "bg-gradient-to-br from-blue-600 to-indigo-600",
      delay: 0
    },
    {
      id: 2,
      icon: <FiCode className="h-6 w-6 text-violet-400" />,
      title: "Advanced QR Codes",
      description: "Create customizable QR codes with your logo, patterns, and frames",
      color: "bg-gradient-to-br from-violet-600 to-purple-600",
      delay: 0.2
    },
    {
      id: 3,
      icon: <FiBarChart2 className="h-6 w-6 text-teal-400" />,
      title: "Geo-Analytics",
      description: "Track link usage with detailed geographic and device data",
      color: "bg-gradient-to-br from-teal-600 to-emerald-600",
      delay: 0.4
    },
    {
      id: 4,
      icon: <FiGlobe className="h-6 w-6 text-orange-400" />,
      title: "Multi-Destination",
      description: "Smart redirection based on the user's device type",
      color: "bg-gradient-to-br from-orange-600 to-amber-600",
      delay: 0.6
    },
    {
      id: 5,
      icon: (
        <svg
          className="h-6 w-6 text-rose-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
      title: "PDF Document Sharing",
      description: "Share PDF documents through secure, expiring links",
      color: "bg-gradient-to-br from-rose-600 to-pink-600",
      delay: 0.8
    },
    {
      id: 6,
      icon: (
        <svg
          className="h-6 w-6 text-cyan-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      ),
      title: "Digital Asset Management",
      description: "Organize and manage your files with folders and drag-and-drop",
      color: "bg-gradient-to-br from-cyan-600 to-blue-600",
      delay: 1.0
    }
  ];

  // Initialize feature animations
  useEffect(() => {
    // Add a small delay to ensure smooth animation
    const timer = setTimeout(() => {
      setIsLoaded(true);
      
      // Keep the initialization from useState, don't override it here
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Setup feature rotation
  useEffect(() => {
    if (!isLoaded) return;
    
    // Show only one feature at a time
    const rotateFeatures = () => {
      // Get current active feature
      const currentIndex = Object.keys(activeFeatures)
        .findIndex(key => activeFeatures[Number(key)]);
      
      // Calculate next feature index
      const nextIndex = (currentIndex >= 0 && currentIndex < features.length - 1) 
        ? currentIndex + 1 
        : 0;
      
      // Reset all features to inactive, then activate only the next one
      const newActiveFeatures: Record<number, boolean> = {};
      features.forEach((_, index) => {
        newActiveFeatures[index] = index === nextIndex;
      });
      
      setActiveFeatures(newActiveFeatures);
    };
    
    // Start with only the first feature active
    if (Object.keys(activeFeatures).length === 0 || 
        Object.values(activeFeatures).filter(Boolean).length !== 1) {
      // Initialize with just the first feature active
      const initialFeatures: Record<number, boolean> = {};
      features.forEach((_, index) => {
        initialFeatures[index] = index === 0;
      });
      setActiveFeatures(initialFeatures);
    }
    
    // Periodically rotate features
    const interval = setInterval(() => {
      rotateFeatures();
    }, 5000); // Change feature every 5 seconds
    
    return () => clearInterval(interval);
  }, [isLoaded, activeFeatures, features.length]);

  const loginForm = useForm<Pick<InsertUser, "username" | "password">>({
    resolver: zodResolver(
      insertUserSchema.pick({ username: true, password: true }),
    ),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      company: "",
    },
  });

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gray-950">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "url('/images/gradient-bg.svg')",
            backgroundSize: "cover",
          }}
        />
        <div
          className="absolute opacity-10 top-0 left-0 right-0 bottom-0"
          style={{
            backgroundImage: "url('/images/light-dots.svg')",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-3xl rounded-full bg-blue-500/10 animate-pulse" />
        <div
          className="absolute top-[45%] left-[48%] transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] blur-3xl rounded-full bg-purple-500/10 animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div
        className={`container max-w-screen-xl mx-auto px-4 py-8 md:py-12 relative z-10 flex flex-col md:flex-row gap-12 items-center transition-opacity duration-1000 ${isLoaded ? "opacity-100" : "opacity-0"}`}
      >
        {/* Left side - Branding and Features */}
        <div className="w-full md:w-1/2 text-white space-y-4 md:space-y-6">
          <div className="space-y-4 text-center transition-all duration-700 delay-100">
            <div>
              <h1 className="text-5xl md:text-7xl tracking-tight text-white">
                <span className="text-white">
                  ADLink
                </span>
              </h1>
              <div className="w-24 h-1 mx-auto mt-4 rounded-full" style={{
                backgroundImage: 'linear-gradient(90deg, #FF9A9E 0%, #FAD0C4 25%, #B5FFFC 50%, #A0FE65 75%, #FCCB90 100%)'
              }}></div>
            </div>
            <p className="text-xl md:text-2xl font-light text-white/80 max-w-2xl mx-auto">
              Intelligent link management platform with advanced analytics, digital assets, and custom branding
            </p>
          </div>

          <div className="block transition-all duration-700 delay-300">
            <div className="mt-6 relative h-[460px] overflow-hidden deepmind-grid rounded-xl">
              {/* Glowing effects */}
              <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] deepmind-glow"></div>
              <div className="absolute bottom-1/3 right-1/3 w-[250px] h-[250px] deepmind-glow" style={{ opacity: '0.1' }}></div>
              
              {/* Floating 3D elements */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Feature visual representations - more spread out across the entire area */}
                <motion.div 
                  className="absolute left-[8%] top-[18%] float-animation-delay-1 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5 }}
                >
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-blue-400/30 flex items-center justify-center text-blue-400">
                    <FiLink className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute left-[68%] top-[12%] float-animation-delay-2 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 0.3 }}
                >
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-purple-400/30 flex items-center justify-center text-purple-400">
                    <FiCode className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute left-[12%] top-[78%] float-animation-delay-3 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 0.6 }}
                >
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-teal-400/30 flex items-center justify-center text-teal-400">
                    <FiBarChart2 className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute left-[85%] top-[75%] float-animation-delay-1 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 0.9 }}
                >
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-orange-400/30 flex items-center justify-center text-orange-400">
                    <FiGlobe className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                </motion.div>
                
                {/* Additional floating icons - better distributed across the entire space */}
                <motion.div 
                  className="absolute left-[22%] top-[45%] float-animation-delay-2 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 1.2 }}
                >
                  <div className="w-6 h-6 md:w-10 md:h-10 rounded-full border border-pink-400/20 flex items-center justify-center text-pink-400">
                    <svg
                      className="w-3 h-3 md:w-5 md:h-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute left-[35%] top-[35%] float-animation-delay-3 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 1.5 }}
                >
                  <div className="w-5 h-5 md:w-8 md:h-8 rounded-full border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                    <svg
                      className="w-2.5 h-2.5 md:w-4 md:h-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute left-[88%] top-[40%] float-animation-delay-1 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 1.8 }}
                >
                  <div className="w-4 h-4 md:w-7 md:h-7 rounded-full border border-emerald-400/20 flex items-center justify-center text-emerald-400">
                    <svg
                      className="w-2 h-2 md:w-3.5 md:h-3.5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
                      <line x1="16" y1="8" x2="2" y2="22"></line>
                      <line x1="17.5" y1="15" x2="9" y2="15"></line>
                    </svg>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute left-[58%] top-[85%] float-animation-delay-2 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 2.1 }}
                >
                  <div className="w-6 h-6 md:w-9 md:h-9 rounded-full border border-yellow-400/20 flex items-center justify-center text-yellow-400">
                    <svg
                      className="w-3 h-3 md:w-4.5 md:h-4.5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </div>
                </motion.div>

                {/* Additional icons for better coverage */}
                <motion.div 
                  className="absolute left-[75%] top-[28%] float-animation-delay-3 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 2.2 }}
                >
                  <div className="w-5 h-5 md:w-8 md:h-8 rounded-full border border-red-400/20 flex items-center justify-center text-red-400">
                    <svg
                      className="w-2.5 h-2.5 md:w-4 md:h-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="absolute left-[30%] top-[60%] float-animation-delay-1 float-animation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 2.4 }}
                >
                  <div className="w-7 h-7 md:w-10 md:h-10 rounded-full border border-indigo-400/20 flex items-center justify-center text-indigo-400">
                    <svg
                      className="w-3.5 h-3.5 md:w-5 md:h-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                  </div>
                </motion.div>
                
                {/* Small decorative dots */}
                <motion.div 
                  className="absolute left-[15%] top-[35%] w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-400/40 float-animation-delay-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 2.4 }}
                />
                
                <motion.div 
                  className="absolute left-[55%] top-[22%] w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-purple-400/40 float-animation-delay-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 2.7 }}
                />
                
                <motion.div 
                  className="absolute left-[45%] top-[70%] w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-teal-400/40 float-animation-delay-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 3.0 }}
                />
                
                <motion.div 
                  className="absolute left-[82%] top-[58%] w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-pink-400/40 float-animation-delay-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 3.3 }}
                />
                
                <motion.div 
                  className="absolute left-[28%] top-[88%] w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-yellow-400/40 float-animation-delay-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.5, delay: 3.6 }}
                />
              </div>

              {/* Centered feature content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-80 h-80 md:w-96 md:h-96 relative text-center">
                  {/* Only show one feature at a time */}
                  <AnimatePresence mode="wait">
                    {features.map((feature, index) => 
                      activeFeatures[index] && (
                        <motion.div
                          key={feature.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.7 }}
                          className="absolute inset-0 flex flex-col items-center justify-center p-6"
                        >
                          <div className="p-4 rounded-full bg-white/5 mb-4 border border-white/10">
                            {feature.icon}
                          </div>
                          <h3 className="text-xl md:text-2xl font-light text-white mb-3">
                            {feature.title}
                          </h3>
                          <p className="text-white/70 text-sm md:text-base max-w-[280px]">
                            {feature.description}
                          </p>
                        </motion.div>
                      )
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Connection lines (using SVG) - updated to connect new icon positions */}
              <svg className="absolute inset-0 w-full h-full z-0" xmlns="http://www.w3.org/2000/svg">
                {/* Web of connections */}
                <motion.line 
                  x1="8%" y1="18%" x2="35%" y2="35%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 1 }}
                />
                <motion.line 
                  x1="35%" y1="35%" x2="68%" y2="12%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 1.3 }}
                />
                <motion.line 
                  x1="68%" y1="12%" x2="75%" y2="28%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 1.6 }}
                />
                <motion.line 
                  x1="75%" y1="28%" x2="88%" y2="40%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 1.9 }}
                />
                <motion.line 
                  x1="88%" y1="40%" x2="85%" y2="75%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 2.1 }}
                />
                <motion.line 
                  x1="85%" y1="75%" x2="58%" y2="85%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 2.3 }}
                />
                <motion.line 
                  x1="58%" y1="85%" x2="30%" y2="60%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 2.5 }}
                />
                <motion.line 
                  x1="30%" y1="60%" x2="12%" y2="78%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 2.7 }}
                />
                <motion.line 
                  x1="12%" y1="78%" x2="8%" y2="18%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.1)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 2, delay: 2.9 }}
                />
                
                {/* Cross connections */}
                <motion.line 
                  x1="22%" y1="45%" x2="38%" y2="20%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.08)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 2, delay: 3.1 }}
                />
                <motion.line 
                  x1="75%" y1="28%" x2="55%" y2="22%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.08)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 2, delay: 3.3 }}
                />
                <motion.line 
                  x1="30%" y1="60%" x2="45%" y2="70%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.08)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 2, delay: 3.5 }}
                />
                <motion.line 
                  x1="82%" y1="58%" x2="58%" y2="85%"
                  strokeWidth="1" stroke="rgba(255,255,255,0.08)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 2, delay: 3.7 }}
                />
              </svg>

              {/* Feature category selection - hidden as requested */}
            </div>
          </div>
        </div>

        {/* Right side - Auth Forms */}
        <div className="w-full md:w-1/2 flex justify-center transition-all duration-700 delay-500">
          <Card className="w-full max-w-md bg-gradient-to-br from-gray-900/60 to-gray-900/40 border border-white/10 shadow-2xl backdrop-blur-xl rounded-2xl p-1 overflow-hidden">
            <div
              className="absolute opacity-50 -top-32 -right-32 w-64 h-64"
              style={{
                backgroundImage: "url('/images/blob-shape.svg')",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
              }}
            />
            {/* Add a subtle glow effect */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl"></div>

            <CardHeader className="space-y-2 relative z-10">
              <CardTitle className="text-2xl font-medium text-white">
                Welcome
              </CardTitle>
              <CardDescription className="text-white/70">
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 p-1 rounded-lg mb-6">
                  <TabsTrigger
                    value="login"
                    className="text-sm font-medium data-[state=active]:bg-gradient-to-r from-blue-600 to-violet-600 data-[state=active]:text-white"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="text-sm font-medium data-[state=active]:bg-gradient-to-r from-blue-600 to-violet-600 data-[state=active]:text-white"
                  >
                    Create Account
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <div className="space-y-2 mb-6">
                    <h3 className="text-lg font-medium text-white">
                      Sign in to your account
                    </h3>
                    <p className="text-sm text-white/60">
                      Enter your credentials below to continue
                    </p>
                  </div>

                  <Form {...loginForm}>
                    <form
                      onSubmit={loginForm.handleSubmit((data) =>
                        loginMutation.mutate(data),
                      )}
                      className="space-y-4"
                    >
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">
                              Username
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="Enter your username"
                                  value={field.value || ""}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">
                              Password
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input
                                  type="password"
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="Enter your password"
                                  value={field.value || ""}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full h-11 text-base font-medium bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.02] mt-2"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          "Signing in..."
                        ) : (
                          <span className="flex items-center justify-center">
                            Sign In
                            <FiArrowRight className="ml-2 h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-gray-900/40 px-2 text-white/60">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-base text-white border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 rounded-lg transition-all duration-300"
                    onClick={() =>
                      (window.location.href = `/api/auth/microsoft`)
                    }
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 23 23"
                    >
                      <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                    Sign in with Microsoft
                  </Button>
                </TabsContent>

                <TabsContent value="register">
                  <div className="space-y-2 mb-6">
                    <h3 className="text-lg font-medium text-white">
                      Create a new account
                    </h3>
                    <p className="text-sm text-white/60">
                      Fill out the form below to register
                    </p>
                  </div>

                  <Form {...registerForm}>
                    <form
                      onSubmit={registerForm.handleSubmit((data) =>
                        registerMutation.mutate(data),
                      )}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-white/80">
                                First Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-11 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="First Name"
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-white/80">
                                Last Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-11 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="Last Name"
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">
                              Username
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="Choose a username"
                                  value={field.value || ""}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">
                              Email
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input
                                  type="email"
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="Enter your email"
                                  value={field.value || ""}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">
                              Company
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiBriefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="Your company (optional)"
                                  value={field.value || ""}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-white/80">
                              Password
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                                <Input
                                  type="password"
                                  className="h-11 pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-white/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                  {...field}
                                  placeholder="Choose a strong password"
                                  value={field.value || ""}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full h-11 text-base font-medium bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-[1.02] mt-2"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          "Creating account..."
                        ) : (
                          <span className="flex items-center justify-center">
                            Create Account
                            <FiArrowRight className="ml-2 h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 items-start p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 transform hover:scale-[1.03]">
      <div className="flex-shrink-0 mt-1">{icon}</div>
      <div>
        <h3 className="text-base font-medium text-white mb-1">{title}</h3>
        <p className="text-sm text-white/70">{description}</p>
      </div>
    </div>
  );
}