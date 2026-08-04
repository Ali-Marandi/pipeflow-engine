import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Download } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function History() {
  const { data: calculations, isLoading, refetch } = trpc.pipeflow.getCalculations.useQuery();
  const deleteMutation = trpc.pipeflow.deleteCalculation.useMutation({
    onSuccess: () => {
      toast.success('Calculation deleted');
      refetch();
    },
    onError: (error) => {
      toast.error(`Delete error: ${error.message}`);
    },
  });

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this calculation?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleDownloadCSV = (calculation: any) => {
    const csv = [
      ['Calculation Name', calculation.name],
      ['Created', new Date(calculation.createdAt).toLocaleString()],
      [],
      ['Input Parameters'],
      ['Pipe Diameter (m)', calculation.inputs.pipeDiameter],
      ['Pipe Length (m)', calculation.inputs.pipeLength],
      ['Flow Rate (m³/s)', calculation.inputs.flowRate],
      ['Fluid Kinematic Viscosity (m²/s)', calculation.inputs.fluidKinematicViscosity],
      ['Pipe Roughness (m)', calculation.inputs.pipeRoughness],
      [],
      ['Results'],
      ['Velocity (m/s)', calculation.results.velocity],
      ['Reynolds Number', calculation.results.reynoldsNumber],
      ['Friction Factor', calculation.results.frictionFactor],
      ['Head Loss (m)', calculation.results.headLoss],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${calculation.name}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading calculations...</p>
        </CardContent>
      </Card>
    );
  }

  if (!calculations || calculations.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Calculation History</CardTitle>
          <CardDescription>Your saved calculations will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No calculations saved yet. Create and save a calculation to see it here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Calculation History</CardTitle>
        <CardDescription>Your saved calculations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Velocity (m/s)</TableHead>
                <TableHead>Reynolds #</TableHead>
                <TableHead>Head Loss (m)</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.map((calc: any) => (
                <TableRow key={calc.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium">{calc.name}</TableCell>
                  <TableCell>{calc.results.velocity.toFixed(4)}</TableCell>
                  <TableCell>{calc.results.reynoldsNumber.toFixed(0)}</TableCell>
                  <TableCell>{calc.results.headLoss.toFixed(4)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(calc.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      onClick={() => handleDownloadCSV(calc)}
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(calc.id)}
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
