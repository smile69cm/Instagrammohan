import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Wand2, 
  Image as ImageIcon, 
  Send,
  RefreshCw,
  Copy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { useApiClient } from "@/lib/api";

export default function Content() {
  const api = useApiClient();
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [generatedCaption, setGeneratedCaption] = useState("");

  const generateMutation = useMutation({
    mutationFn: (data: { topic: string; tone: string; additionalInstructions: string }) =>
      api.post("/content/generate", data),
    onSuccess: (data) => {
      setGeneratedCaption(data.generatedText);
      toast({
        title: "Content generated!",
        description: "Your caption is ready.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic for your content.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      topic,
      tone,
      additionalInstructions,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCaption);
    toast({
      title: "Copied!",
      description: "Caption copied to clipboard.",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Content AI</h2>
            <p className="text-muted-foreground">Generate engaging captions and ideas instantly.</p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-none shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic or Idea</Label>
                <Input 
                  id="topic"
                  placeholder="e.g., A post about productivity tips for remote workers" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  data-testid="input-topic"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tone</Label>
                <div className="flex gap-2 flex-wrap">
                  {['Professional', 'Casual', 'Inspirational', 'Funny'].map((t) => (
                    <Badge 
                      key={t} 
                      variant={tone === t ? "default" : "outline"}
                      className={`cursor-pointer transition-colors px-3 py-1 ${tone === t ? 'bg-secondary text-white' : 'hover:bg-secondary/10 hover:text-secondary hover:border-secondary'}`}
                      onClick={() => setTone(t)}
                      data-testid={`badge-tone-${t.toLowerCase()}`}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Additional Instructions</Label>
                <Textarea 
                  id="instructions"
                  placeholder="Include emojis, ask a question at the end..." 
                  className="h-24" 
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  data-testid="textarea-instructions"
                />
              </div>

              <Button 
                className="w-full bg-gradient-instagram text-white border-none shadow-lg shadow-primary/20" 
                size="lg"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating Magic...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-secondary" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="border rounded-xl p-4 flex-1 bg-muted/30 min-h-[300px]">
                {generatedCaption ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[2px]">
                        <div className="w-full h-full rounded-full bg-background p-[2px]">
                          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="w-full h-full rounded-full" alt="Profile" />
                        </div>
                      </div>
                      <span className="font-semibold text-sm">your_username</span>
                    </div>
                    <div className="aspect-square rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      Image Preview Placeholder
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-generated-caption">
                      {generatedCaption}
                    </p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                    <Wand2 className="h-8 w-8 mb-3 opacity-20" />
                    <p>Your generated content will appear here</p>
                  </div>
                )}
              </div>
              
              {generatedCaption && (
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" className="flex-1" onClick={handleCopy} data-testid="button-copy">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Text
                  </Button>
                  <Button className="flex-1 bg-primary hover:bg-primary/90 text-white" data-testid="button-schedule">
                    <Send className="mr-2 h-4 w-4" />
                    Schedule Post
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
