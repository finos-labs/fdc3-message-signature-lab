# Changelog

## Recent Changes (October 2025)

### Fixed Metadata Handling
- **Source field**: Fixed undefined source in messages by ensuring server sends `metadata.source: 'React Demo Server'` and client handles missing metadata gracefully with fallback to 'Unknown'
- **Name field**: Updated React example listener to always unwrap signed contexts for display so `name` is available even when verification fails
- **Type field**: Added fallback rendering logic to extract type from nested signed payload (`item.context.context.type`) when top-level type is missing

### FDC3 API Modernization
- **React example** (`examples/react-fdc3-integration.tsx`): Updated to use standard `@finos/fdc3` `getAgent()` API with graceful fallback to legacy `window.fdc3` approaches
- **Demo client** (`demo/client-app.js`): Implemented FDC3 agent detection supporting:
  - Modern FDC3 2.0+ `window.fdc3.getAgent()` 
  - Legacy FDC3 1.x `window.fdc3` direct access
  - Promise-based `window.fdc3Ready()`
  - Graceful fallback to demo-only mode

### Build and Architecture Improvements
- **Extracted static content**: Moved embedded client script from `demo/react-server.js` into separate `demo/client-app.js` file
  - Server now serves pre-built client file instead of generating at runtime
  - Improves maintainability and allows for separate development/testing of client code
  - Eliminates complex template literal escaping issues
- **Build resilience**: Server gracefully handles missing `dist/` directory, running in simulation mode with clear warnings instead of crashing
- **Type safety**: All rendering code includes defensive fallbacks for undefined fields

### Demo Server Structure
```
demo/
├── react-server.js    # Express server with KMS signing endpoints
├── client-app.js      # Browser client application (NEW)
└── static/           # Static assets directory
```

### API Endpoints
- `GET /` - Main demo page with embedded HTML
- `GET /client-app.js` - Client application script
- `GET /api/status` - KMS readiness status
- `POST /api/sign` - Sign FDC3 context with AWS KMS (returns signed context + metadata)
- `POST /api/verify` - Verify signed FDC3 context

### Key Features
- ✅ Real AWS KMS signing via server-side API
- ✅ Proper metadata propagation (source, signed status, verification result)
- ✅ Modern FDC3 `getAgent()` API support
- ✅ Graceful degradation when FDC3 or KMS unavailable
- ✅ Clear visual indicators for signed/verified/invalid contexts
- ✅ Defensive rendering with fallbacks for all fields

### Running the Demo
```bash
# Build the TypeScript library
npm run build

# Start demo server (default port 3000)
npm run demo:react

# Or specify custom port
PORT=3001 npm run demo:react
```

### Next Steps / Future Improvements
- Consider adding real FDC3 broadcast integration (currently simulated locally)
- Add TypeScript types for client-app.js
- Create unit tests for metadata handling
- Add configurable app identity for dynamic source labels
- Support additional FDC3 context types in demo UI
