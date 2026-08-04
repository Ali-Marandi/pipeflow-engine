# Project TODO

## Core Features
- [x] Interactive pipe flow calculator (velocity, Reynolds, friction factor, head loss)
- [x] Fluid properties database with presets (water, oil, air, custom)
- [x] Pipe material database with roughness values (steel, PVC, copper, concrete)
- [x] Real-time interactive charts (Moody diagram) using Recharts
- [x] Multi-segment pipe network calculator (series/parallel)
- [x] Calculation history (save, name, revisit past calculations per user)
- [x] Export results as CSV reports

## UI/UX
- [x] Modern dark-themed dashboard UI with professional engineering aesthetic
- [x] Deep navy background with cyan/teal accent colors
- [x] Clean sans-serif typography
- [x] Dashboard layout with sidebar navigation
- [x] Sidebar sections: Calculator, Moody Diagram, Pipe Network, History, About

## Authentication & Data
- [x] User authentication via Manus OAuth
- [x] Persist calculation history and saved projects across sessions

## Backend
- [x] Database schema for fluid properties, pipe materials, and saved calculations
- [x] API procedures for calculations, data retrieval, and data storage
- [x] Darcy-Weisbach calculation functions
- [x] tRPC procedures for all features

## Testing & Deployment
- [x] Unit tests for all backend logic and calculations
- [x] Integration tests for API and database interactions
- [x] End-to-end tests for UI functionality
- [x] Prepare for GitHub release
