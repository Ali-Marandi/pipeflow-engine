import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UnitProvider } from "./contexts/UnitContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { PipeFlowDashboard } from "./components/PipeFlowDashboard";
import Calculator from "./pages/Calculator";
import MoodyDiagram from "./pages/MoodyDiagram";
import PipeNetwork from "./pages/PipeNetwork";
import History from "./pages/History";
import About from "./pages/About";
import Home from "./pages/Home";
import { useState } from "react";

function Router() {
  const { isAuthenticated, loading } = useAuth();
  const [currentSection, setCurrentSection] = useState<'calculator' | 'moody' | 'network' | 'history' | 'about'>('calculator');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <PipeFlowDashboard currentSection={currentSection} onSectionChange={setCurrentSection}>
      {currentSection === 'calculator' && <Calculator />}
      {currentSection === 'moody' && <MoodyDiagram />}
      {currentSection === 'network' && <PipeNetwork />}
      {currentSection === 'history' && <History />}
      {currentSection === 'about' && <About />}
    </PipeFlowDashboard>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <UnitProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </UnitProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
