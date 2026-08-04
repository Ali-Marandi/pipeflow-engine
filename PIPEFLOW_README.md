# PipeFlow Pro Engine

A professional, web-based pipe flow calculator application designed for engineers performing hydraulic calculations using the Darcy-Weisbach equation.

## Overview

PipeFlow Pro Engine is a comprehensive solution for analyzing fluid flow through circular pipes. Built with modern web technologies and backed by rigorous hydraulic engineering principles, it provides real-time calculations, interactive visualizations, and persistent data storage for engineering professionals.

## Features

### Core Calculations

The application implements the **Darcy-Weisbach equation** for calculating head loss in pipes:

**h_f = f × (L/D) × (v²/2g)**

Where:
- **h_f** = head loss (m)
- **f** = Darcy friction factor (dimensionless)
- **L** = pipe length (m)
- **D** = pipe diameter (m)
- **v** = flow velocity (m/s)
- **g** = gravitational acceleration (9.80665 m/s²)

### Interactive Calculator

The calculator computes four essential hydraulic parameters:

1. **Velocity** - Flow speed through the pipe (m/s)
2. **Reynolds Number** - Dimensionless parameter indicating flow regime (laminar vs. turbulent)
3. **Friction Factor** - Resistance coefficient based on flow regime and pipe roughness
4. **Head Loss** - Pressure drop due to friction (m)

### Moody Diagram

An interactive visualization of the Darcy friction factor across different Reynolds numbers and relative roughness values. The diagram displays both laminar and turbulent flow regions with real-time updates based on user inputs.

### Pipe Network Calculator

Analyze multi-segment pipe systems with support for:
- **Series Configuration** - Segments connected end-to-end (head losses add)
- **Parallel Configuration** - Segments connected side-by-side (head loss is maximum)

### Fluid Properties Database

Preset fluids with standard properties:
- **Water (20°C)** - kinematic viscosity: 1×10⁻⁶ m²/s, density: 998 kg/m³
- **Oil (ISO VG 32)** - kinematic viscosity: 32×10⁻⁶ m²/s, density: 860 kg/m³
- **Air (20°C)** - kinematic viscosity: 15.1×10⁻⁶ m²/s, density: 1.2 kg/m³
- **Custom Fluids** - User-defined properties

### Pipe Material Database

Common pipe materials with standard roughness values:
- **Steel (Commercial)** - 0.000045 m
- **PVC** - 0.0000015 m
- **Copper** - 0.0000015 m
- **Concrete** - 0.0003 m

### Calculation History

Save and manage calculations with the following features:
- **Named Calculations** - Give meaningful names to saved results
- **Persistent Storage** - All calculations stored per user account
- **Quick Retrieval** - Access historical calculations anytime
- **CSV Export** - Download results for documentation and reporting

### Dashboard Navigation

Five main sections accessible via sidebar navigation:

1. **Calculator** - Primary calculation interface
2. **Moody Diagram** - Friction factor visualization
3. **Pipe Network** - Multi-segment analysis
4. **History** - Saved calculations management
5. **About** - Application information and equations

## Technical Architecture

### Frontend Stack

- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Responsive styling
- **Recharts** - Interactive charts and visualizations
- **tRPC** - End-to-end type-safe API calls
- **Wouter** - Lightweight routing

### Backend Stack

- **Express 4** - Web server
- **tRPC 11** - RPC framework
- **Drizzle ORM** - Database abstraction
- **MySQL/TiDB** - Data persistence
- **Manus OAuth** - User authentication

### Database Schema

#### Users Table
```sql
- id (int, primary key)
- openId (varchar, unique)
- name (text)
- email (varchar)
- loginMethod (varchar)
- role (enum: admin|user)
- createdAt (timestamp)
- updatedAt (timestamp)
- lastSignedIn (timestamp)
```

#### Fluids Table
```sql
- id (int, primary key)
- userId (int, nullable)
- name (varchar)
- density (float)
- kinematicViscosity (float)
- isPreset (boolean)
- createdAt (timestamp)
```

#### Pipe Materials Table
```sql
- id (int, primary key)
- userId (int, nullable)
- name (varchar)
- roughness (float)
- isPreset (boolean)
- createdAt (timestamp)
```

#### Calculations Table
```sql
- id (int, primary key)
- userId (int)
- name (varchar)
- inputs (json)
- results (json)
- createdAt (timestamp)
- updatedAt (timestamp)
```

## Hydraulic Equations

### Reynolds Number

**Re = (v × D) / ν**

Where:
- **v** = flow velocity (m/s)
- **D** = pipe diameter (m)
- **ν** = kinematic viscosity (m²/s)

**Flow Regimes:**
- Laminar: Re < 2300
- Transitional: 2300 ≤ Re ≤ 4000
- Turbulent: Re > 4000

### Friction Factor Calculation

**Laminar Flow (Re < 2300):**
```
f = 64 / Re
```

**Turbulent Flow (Re ≥ 2300):**
Uses the Swamee-Jain approximation:
```
f = 0.25 / [log₁₀(ε/3.7D + 5.74/Re^0.9)]²
```

Where:
- **ε** = absolute roughness (m)
- **ε/D** = relative roughness

### Flow Velocity

**v = Q / (π × D² / 4)**

Where:
- **Q** = volumetric flow rate (m³/s)
- **D** = pipe diameter (m)

## Authentication

The application uses **Manus OAuth** for secure user authentication. Users can:
- Sign in with their Manus account
- Persist calculations across sessions
- Access their calculation history from any device
- Maintain separate data profiles

## API Procedures (tRPC)

### Public Procedures

- `pipeflow.calculateDarcyWeisbach` - Perform single-pipe calculation
- `pipeflow.getFluids` - Retrieve available fluids
- `pipeflow.getPipeMaterials` - Retrieve available pipe materials

### Protected Procedures

- `pipeflow.addFluid` - Create custom fluid
- `pipeflow.addPipeMaterial` - Create custom pipe material
- `pipeflow.getCalculations` - Retrieve user's saved calculations
- `pipeflow.saveCalculation` - Save a new calculation
- `pipeflow.deleteCalculation` - Delete a saved calculation

## User Interface Design

### Color Scheme

- **Background** - Deep navy (oklch(0.08 0.01 260))
- **Card** - Slightly lighter navy (oklch(0.12 0.01 260))
- **Accent** - Cyan/Teal (oklch(0.55 0.2 260))
- **Foreground** - Light gray (oklch(0.95 0.01 65))
- **Muted** - Medium gray (oklch(0.2 0.01 260))

### Layout

- **Sidebar Navigation** - Collapsible sidebar with five main sections
- **Responsive Design** - Mobile-friendly layout
- **Dark Theme** - Professional engineering aesthetic
- **Clean Typography** - Sans-serif fonts for readability

## Testing

The application includes comprehensive unit tests covering:

- **Calculation Functions** - All Darcy-Weisbach calculations
- **Reynolds Number** - Laminar and turbulent regimes
- **Friction Factor** - Both laminar and turbulent formulas
- **Head Loss** - Various pipe configurations
- **Error Handling** - Invalid input validation

Run tests with:
```bash
pnpm test
```

## Development

### Prerequisites

- Node.js 22.13.0+
- pnpm 10.4.1+

### Installation

```bash
cd pipeflow-web
pnpm install
```

### Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

### Building

```bash
pnpm build
```

### Production

```bash
pnpm start
```

## Export Functionality

### CSV Export

Users can export calculation results as CSV files containing:
- Calculation name and timestamp
- Input parameters (diameter, length, flow rate, viscosity, roughness)
- Calculated results (velocity, Reynolds number, friction factor, head loss)

## Version History

- **v1.0.0** (August 2026) - Initial release with core features

## License

MIT

## Support

For issues, feature requests, or technical questions, please contact the development team.

---

**Built with engineering precision. Powered by Darcy-Weisbach.**
