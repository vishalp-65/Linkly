/**
 * OpenTelemetry Tracing Initialization
 * This file must be imported before any other modules to ensure proper instrumentation
 */

import { tracingService } from './services/tracingService';

// Initialize tracing as early as possible
tracingService.initialize();

export { tracingService };