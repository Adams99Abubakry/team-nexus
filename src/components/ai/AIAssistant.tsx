import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Lightbulb,
  ListTodo,
  Zap,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  projectContext?: string;
}

const quickActions = [
  { icon: <ListTodo className="w-4 h-4" />, label: "Suggest tasks", prompt: "Suggest 3-5 tasks I should work on today" },
  { icon: <Lightbulb className="w-4 h-4" />, label: "Prioritize", prompt: "Help me prioritize my current workload" },
  { icon: <Zap className="w-4 h-4" />, label: "Break down", prompt: "Help me break down a large task into smaller steps" },
];

export function AIAssistant({ projectContext }: AIAssistantProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm Flowboard AI, your productivity assistant. I can help you create tasks, prioritize work, and stay organized. You can type or use voice to talk to me!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("");
          setInput(transcript);

          // If final result, send the message
          if (event.results[event.results.length - 1].isFinal) {
            setIsListening(false);
            if (transcript.trim()) {
              sendMessage(transcript);
            }
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error === "not-allowed") {
            toast({
              title: "Microphone Access Required",
              description: "Please allow microphone access to use voice input.",
              variant: "destructive",
            });
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }

      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !voiceEnabled) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;

    // Find a female voice - prioritize common female voice names
    const voices = synthRef.current.getVoices();
    const femaleVoice = voices.find(
      (voice) => 
        voice.name.includes("Samantha") ||
        voice.name.includes("Victoria") ||
        voice.name.includes("Karen") ||
        voice.name.includes("Moira") ||
        voice.name.includes("Tessa") ||
        voice.name.includes("Fiona") ||
        voice.name.includes("Google UK English Female") ||
        voice.name.includes("Google US English Female") ||
        voice.name.includes("Microsoft Zira") ||
        voice.name.includes("Female")
    ) || voices.find(
      (voice) => voice.lang.startsWith("en") && voice.name.toLowerCase().includes("female")
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, [voiceEnabled]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast({
        title: "Voice Not Supported",
        description: "Your browser doesn't support voice input.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.abort();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, toast]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-voice", {
        body: {
          type: "chat",
          message: messageText,
          projectContext,
        },
      });

      if (error) throw error;

      const responseText = data.result || "I'm sorry, I couldn't process that request.";

      const assistantMessage: Message = {
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Speak the response if voice is enabled
      if (voiceEnabled) {
        speak(responseText);
      }
    } catch (error: any) {
      console.error("AI error:", error);

      let errorMessage = "Sorry, I encountered an error. Please try again.";
      if (error.message?.includes("429") || error.message?.includes("Rate limit")) {
        errorMessage = "I'm receiving too many requests. Please wait a moment and try again.";
      } else if (error.message?.includes("402")) {
        errorMessage = "AI credits have been exhausted. Please contact your admin.";
      }

      toast({
        title: "AI Error",
        description: errorMessage,
        variant: "destructive",
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating AI Button */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            className={cn(
              "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-[100]",
              "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70",
              "transition-all duration-300 hover:scale-110",
              isListening && "animate-pulse ring-4 ring-primary/50"
            )}
            size="icon"
          >
            <Sparkles className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col z-[100]">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              Flowboard AI
              <Badge variant="secondary" className="ml-2">
                Voice Enabled
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
              >
                {voiceEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </SheetTitle>
          </SheetHeader>

          {/* Quick Actions */}
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Quick actions</p>
            <div className="flex gap-2 flex-wrap">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => sendMessage(action.prompt)}
                  disabled={loading}
                >
                  {action.icon}
                  <span className="ml-1">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-gradient-to-br from-primary/20 to-primary/10"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === "assistant" && voiceEnabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => speak(message.content)}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span>Speaking...</span>
                  <Button variant="ghost" size="sm" onClick={stopSpeaking}>
                    Stop
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={toggleListening}
                disabled={loading}
                className={cn(isListening && "animate-pulse")}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening..." : "Type or speak..."}
                disabled={loading || isListening}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {isListening ? "🎤 Speak now..." : "Click the mic button or type your message"}
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Add type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
