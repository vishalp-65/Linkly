# URL Shortener Frontend

A modern React application built with TypeScript, Vite, and Tailwind CSS for the URL Shortener service.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit with RTK Query
- **Routing**: React Router
- **Testing**: Vitest + React Testing Library
- **Code Quality**: ESLint + Prettier

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── common/         # Common components (Button, Input, etc.)
├── pages/              # Page components
├── services/           # API services and RTK Query
├── store/              # Redux store and slices
├── utils/              # Utility functions
└── test/               # Test setup and utilities
```

## Features

- Modern React 18 with TypeScript
- Responsive design with Tailwind CSS
- State management with Redux Toolkit
- Client-side routing with React Router
- Comprehensive testing setup
- Code quality tools (ESLint, Prettier)
- Fast development with Vite HMR