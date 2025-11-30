import { SignUp } from "@clerk/clerk-react";
import { Instagram } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-instagram flex items-center justify-center text-white mx-auto shadow-lg mb-4">
            <Instagram size={24} />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Create Account</h1>
        </div>
        
        <SignUp 
          appearance={{
            elements: {
              rootBox: "w-full shadow-xl rounded-xl overflow-hidden",
              card: "shadow-none border border-border bg-card/50 backdrop-blur-sm",
              headerTitle: "text-foreground font-display",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25",
              formFieldInput: "bg-background border-input focus:ring-primary",
              footerActionLink: "text-primary hover:text-primary/80"
            }
          }}
          signInUrl="/auth" 
        />
      </div>
    </div>
  );
}
