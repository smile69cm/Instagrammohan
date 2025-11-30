import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/config";
import NotFound from "@/pages/not-found";

// Pages
import Dashboard from "@/pages/Dashboard";
import Automations from "@/pages/Automations";
import Content from "@/pages/Content";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import SignUpPage from "@/pages/SignUp";

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <SignedIn>
        <Component />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={Auth} />
      <Route path="/sign-up" component={SignUpPage} />
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/automations">
        <ProtectedRoute component={Automations} />
      </Route>
      <Route path="/content">
        <ProtectedRoute component={Content} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
