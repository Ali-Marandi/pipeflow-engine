import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PipeSegment {
  id: string;
  diameter: number;
  length: number;
  roughness: number;
  configuration: 'series' | 'parallel';
}

export default function PipeNetwork() {
  const [segments, setSegments] = useState<PipeSegment[]>([
    { id: '1', diameter: 0.1, length: 100, roughness: 0.000045, configuration: 'series' },
  ]);
  const [flowRate, setFlowRate] = useState(0.01);
  const [kinematicViscosity, setKinematicViscosity] = useState(1e-6);

  const addSegment = () => {
    const newId = (Math.max(...segments.map(s => parseInt(s.id)), 0) + 1).toString();
    setSegments([...segments, {
      id: newId,
      diameter: 0.1,
      length: 100,
      roughness: 0.000045,
      configuration: 'series',
    }]);
  };

  const removeSegment = (id: string) => {
    if (segments.length === 1) {
      toast.error('At least one segment is required');
      return;
    }
    setSegments(segments.filter(s => s.id !== id));
  };

  const updateSegment = (id: string, field: keyof PipeSegment, value: any) => {
    setSegments(segments.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const calculateTotalHeadLoss = () => {
    let totalHeadLoss = 0;

    segments.forEach(segment => {
      const velocity = flowRate / (Math.PI * segment.diameter ** 2 / 4);
      const re = velocity * segment.diameter / kinematicViscosity;
      const relRoughness = segment.roughness / segment.diameter;

      let f;
      if (re < 2300) {
        f = 64 / re;
      } else {
        f = 0.25 / Math.log10(relRoughness / 3.7 + 5.74 / re ** 0.9) ** 2;
      }

      const headLoss = f * segment.length / segment.diameter * velocity ** 2 / (2 * 9.80665);

      if (segment.configuration === 'series') {
        totalHeadLoss += headLoss;
      } else {
        // For parallel, head loss is the same but flow is divided
        totalHeadLoss = Math.max(totalHeadLoss, headLoss);
      }
    });

    return totalHeadLoss;
  };

  const totalHeadLoss = calculateTotalHeadLoss();

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Pipe Network Calculator</CardTitle>
          <CardDescription>Configure multiple pipe segments in series or parallel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global Parameters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flow">Flow Rate (m³/s)</Label>
              <Input
                id="flow"
                type="number"
                step="0.0001"
                value={flowRate}
                onChange={(e) => setFlowRate(parseFloat(e.target.value))}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="viscosity">Kinematic Viscosity (m²/s)</Label>
              <Input
                id="viscosity"
                type="number"
                step="1e-7"
                value={kinematicViscosity}
                onChange={(e) => setKinematicViscosity(parseFloat(e.target.value))}
                className="bg-input border-border"
              />
            </div>
          </div>

          {/* Segments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pipe Segments</h3>
              <Button
                onClick={addSegment}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Segment
              </Button>
            </div>

            {segments.map((segment, index) => (
              <Card key={segment.id} className="bg-muted border-border">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label>Diameter (m)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={segment.diameter}
                        onChange={(e) => updateSegment(segment.id, 'diameter', parseFloat(e.target.value))}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Length (m)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={segment.length}
                        onChange={(e) => updateSegment(segment.id, 'length', parseFloat(e.target.value))}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Roughness (m)</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={segment.roughness}
                        onChange={(e) => updateSegment(segment.id, 'roughness', parseFloat(e.target.value))}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Configuration</Label>
                      <Select
                        value={segment.configuration}
                        onValueChange={(value) => updateSegment(segment.id, 'configuration', value)}
                      >
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="series">Series</SelectItem>
                          <SelectItem value="parallel">Parallel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => removeSegment(segment.id)}
                        variant="destructive"
                        size="sm"
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Results */}
          <Card className="bg-accent/10 border-accent">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Total Head Loss</Label>
                <p className="text-3xl font-bold text-accent">{totalHeadLoss.toFixed(4)} m</p>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
