# Changelog

All notable changes to PipeFlow Pro Engine will be documented in this file.

## [1.0.0] - 2026-08-04

### Added

#### Core Features
- Interactive pipe flow calculator with real-time Darcy-Weisbach calculations
- Computation of velocity, Reynolds number, friction factor, and head loss
- Moody diagram visualization with interactive Recharts integration
- Multi-segment pipe network calculator supporting series and parallel configurations
- Calculation history with persistent storage per user account
- CSV export functionality for engineering documentation

#### Fluid & Material Databases
- Preset fluid properties (water, oil, air) with standard kinematic viscosity and density values
- Preset pipe materials (steel, PVC, copper, concrete) with standard roughness values
- Support for custom fluid and pipe material definitions

#### User Interface
- Professional dark-themed dashboard with navy background and cyan/teal accents
- Collapsible sidebar navigation with five main sections:
  - Calculator
  - Moody Diagram
  - Pipe Network
  - History
  - About
- Responsive design supporting desktop and tablet viewports
- Clean sans-serif typography for professional appearance

#### Authentication & Data Management
- Manus OAuth integration for secure user authentication
- User-scoped calculation history and custom fluid/material storage
- Persistent session management across browser sessions

#### Backend Infrastructure
- tRPC API with end-to-end type safety
- MySQL/TiDB database integration via Drizzle ORM
- Comprehensive database schema for users, fluids, pipe materials, and calculations
- Public and protected procedures for flexible access control

#### Testing
- 30+ unit tests covering all Darcy-Weisbach calculation functions
- Reynolds number calculation tests (laminar and turbulent regimes)
- Friction factor calculation tests (Swamee-Jain approximation)
- Head loss calculation tests with various pipe configurations
- Error handling and input validation tests

#### Documentation
- Comprehensive README with technical architecture and feature descriptions
- Detailed hydraulic equations documentation
- Database schema documentation
- API procedure documentation
- Development setup and build instructions

### Technical Details

#### Hydraulic Equations Implemented
- **Darcy-Weisbach Equation**: h_f = f × (L/D) × (v²/2g)
- **Reynolds Number**: Re = (v × D) / ν
- **Friction Factor (Laminar)**: f = 64 / Re
- **Friction Factor (Turbulent)**: Swamee-Jain approximation
- **Flow Velocity**: v = Q / (π × D² / 4)

#### Technology Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Recharts
- **Backend**: Express 4, tRPC 11, Drizzle ORM
- **Database**: MySQL/TiDB
- **Authentication**: Manus OAuth
- **Testing**: Vitest

### Known Limitations

- PDF export not yet implemented (CSV export available)
- Real-time pressure drop vs. flow rate chart requires manual recalculation
- Parallel pipe network calculations use simplified head loss model

### Future Enhancements

- PDF report generation with professional formatting
- Real-time interactive pressure drop vs. flow rate charts
- Advanced pipe network solver with iterative methods
- Temperature-dependent fluid property calculations
- Unit conversion utilities (SI/Imperial)
- Batch calculation processing
- API access for third-party integrations

---

## Release Information

**Version**: 1.0.0  
**Release Date**: August 4, 2026  
**Status**: Production Ready

### Installation

```bash
git clone https://github.com/Ali-Marandi/pipeflow-engine.git
cd pipeflow-web
pnpm install
pnpm dev
```

### Testing

```bash
pnpm test
```

All 30 unit tests pass successfully.

### Build & Deploy

```bash
pnpm build
pnpm start
```

---

For detailed information, see [PIPEFLOW_README.md](./PIPEFLOW_README.md)
