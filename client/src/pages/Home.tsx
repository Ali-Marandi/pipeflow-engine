import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, BarChart3, Pipette, History, Info } from "lucide-react";
import { startLogin } from "@/const";

export default function Home() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-accent">PipeFlow Pro Engine</h1>
            <p className="text-muted-foreground mt-1">Professional Hydraulic Calculations</p>
          </div>
          <Button
            onClick={() => startLogin()}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Advanced Pipe Flow Analysis</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            PipeFlow Pro Engine is a comprehensive web-based application for engineers performing hydraulic calculations using the Darcy-Weisbach equation.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-card border-border hover:border-accent transition-colors">
            <CardHeader>
              <Calculator className="w-8 h-8 text-accent mb-2" />
              <CardTitle>Interactive Calculator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Real-time computation of velocity, Reynolds number, friction factor, and head loss.</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-accent transition-colors">
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-accent mb-2" />
              <CardTitle>Moody Diagram</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Visual representation of friction factor across laminar and turbulent flow regimes.</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-accent transition-colors">
            <CardHeader>
              <Pipette className="w-8 h-8 text-accent mb-2" />
              <CardTitle>Pipe Network</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Multi-segment calculations for series and parallel pipe configurations.</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-accent transition-colors">
            <CardHeader>
              <History className="w-8 h-8 text-accent mb-2" />
              <CardTitle>Calculation History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Save, name, and retrieve past calculations with secure cloud storage.</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-accent transition-colors">
            <CardHeader>
              <Info className="w-8 h-8 text-accent mb-2" />
              <CardTitle>Material Database</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Presets for common pipe materials and fluid properties.</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-accent transition-colors">
            <CardHeader>
              <Info className="w-8 h-8 text-accent mb-2" />
              <CardTitle>Export Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Download results as CSV for engineering documentation.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-card border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
          <p className="text-muted-foreground mb-6">Sign in with your account to access all features and save your calculations.</p>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Sign In Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>PipeFlow Pro Engine v1.0.0 | Built with Darcy-Weisbach Equations</p>
        </div>
      </footer>
    </div>
  );
}
