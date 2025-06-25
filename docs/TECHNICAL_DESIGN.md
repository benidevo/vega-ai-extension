# Technical Design Document

## Vega AI Browser Extension

### Overview

The Vega AI Browser Extension is a Chrome extension built with TypeScript and Manifest V3 that captures job listings from various job sites and posts them to the Vega AI backend service. The extension follows a modular architecture with clear separation of concerns.

## 🏗️ Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                Chrome Browser Environment                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────────────┐        ┌─────────────────────────────────────────┐        │
│  │     Web Pages        │        │        Background Service Worker        │        │
│  │  ┌────────────────┐  │        │                                         │        │
│  │  │  LinkedIn Job  │  │        │  ┌─────────────────────────────────┐    │        │
│  │  │     Page       │  │        │  │      Service Manager            │    │        │
│  │  │                │  │        │  │   ┌──────────┬──────────────┐   │    │        │
│  │  └───────┬────────┘  │        │  │   │   Auth   │  API Service │   │    │        │
│  │          │           │        │  │   │ Service  │              │   │    │        │
│  │  ┌───────▼────────┐  │        │  │   ├──────────┼──────────────┤   │    │        │
│  │  │ Content Script │  │◄──────►│  │   │ Message  │   Storage    │   │    │        │
│  │  │                │  │Messages│  │   │ Service  │   Service    │   │    │        │
│  │  │ ┌────────────┐ │  │        │  │   ├──────────┼──────────────┤   │    │        │
│  │  │ │ Job        │ │  │        │  │   │  Badge   │ Connection   │   │    │        │
│  │  │ │ Extractor  │ │  │        │  │   │ Service  │  Manager     │   │    │        │
│  │  │ └────────────┘ │  │        │  │   ├──────────┼──────────────┤   │    │        │
│  │  │                │  │        │  │   │KeepAlive │   Logger     │   │    │        │
│  │  │ ┌────────────┐ │  │        │  │   │ Service  │              │   │    │        │
│  │  │ │  Overlay   │ │  │        │  │   └──────────┴──────────────┘   │    │        │
│  │  │ │   (UI)     │ │  │        │  └─────────────────────────────────┘    │        │
│  │  │ └────────────┘ │  │        │                                         │        │
│  │  └────────────────┘  │        │         Chrome Extension APIs           │        │
│  └──────────────────────┘        │  ┌────────────────────────────────┐     │        │
│                                  │  │ • Runtime Messaging            │     │        │
│  ┌──────────────────────┐        │  │ • Storage (Local/Sync)         │     │        │
│  │    Popup UI          │        │  │ • Identity (OAuth)             │     │        │
│  │  ┌────────────────┐  │        │  │ • Alarms (Keep-alive)          │     │        │
│  │  │ Authentication │  │◄──────►│  │ • Tabs & Windows               │     │        │
│  │  │    Screen      │  │        │  └────────────────────────────────┘     │        │
│  │  └────────────────┘  │        └─────────────────────────────────────────┘        │
│  │  ┌────────────────┐  │                              │                            │
│  │  │   Settings     │  │                              │ HTTPS/REST                 │
│  │  │    Screen      │  │                              │                            │
│  │  └────────────────┘  │                              │                            │
│  └──────────────────────┘                              │                            │
│                                                        │                            │
└────────────────────────────────────────────────────────┼─────────────────────────── ┘
                                                         │
                                                         │
                                              ┌──────────▼──────────────┐
                                              │   Vega AI Backend API   │
                                              │                         │
                                              │  ┌─────────────────┐    │
                                              │  │ Authentication  │    │
                                              │  │   Endpoints     │    │
                                              │  │ • /auth/login   │    │
                                              │  │ • /auth/refresh │    │
                                              │  └─────────────────┘    │
                                              │                         │
                                              │  ┌─────────────────┐    │
                                              │  │  Job Management │    │
                                              │  │   Endpoints     │    │
                                              │  │ • POST /jobs    │    │
                                              │  └─────────────────┘    │
                                              │                         │
                                              └─────────────────────────┘

Message Flow Legend:
─────► Async Chrome Runtime Messages
═════► HTTP/HTTPS API Calls
·····► Event-driven Updates
```

### Directory Structure

```plaintext
src/
├── background/          # Service worker and background services
│   ├── services/       # Modular service implementations
│   │   ├── auth/      # Multi-provider authentication
│   │   │   ├── IAuthProvider.ts           # Provider interface
│   │   │   ├── IAuthService.ts            # Service interface
│   │   │   ├── GoogleAuthProvider.ts      # Google OAuth implementation
│   │   │   ├── PasswordAuthService.ts     # Username/password auth
│   │   │   ├── MultiProviderAuthService.ts # Main auth service
│   │   │   └── AuthProviderFactory.ts     # Provider factory
│   │   ├── api/       # Backend API communication
│   │   ├── message/   # Chrome extension messaging
│   │   ├── storage/   # Chrome storage wrapper
│   │   └── badge/     # Extension badge management
│   └── ServiceManager.ts # Coordinates all services
│
├── content/            # Content scripts injected into web pages
│   ├── extractors/    # Job data extraction modules
│   │   ├── IJobExtractor.ts    # Common interface
│   │   └── linkedin.ts         # LinkedIn-specific extractor
│   ├── overlay.ts     # Floating UI component
│   └── index.ts       # Content script entry point
│
├── popup/             # Extension popup UI
├── styles/            # Global styles (Tailwind CSS)
├── types/             # TypeScript type definitions
├── config/            # Configuration management
└── utils/             # Shared utilities (logger, etc.)
```

## 🔧 Core Components

### Background Services

#### Authentication Service (`MultiProviderAuthService`)

- **Purpose**: Manages authentication across multiple providers
- **Providers**: Google OAuth, Username/Password
- **Features**:
  - Provider abstraction via factory pattern
  - Token management and refresh
  - Configurable provider enablement
  - Secure storage of auth tokens

```typescript
interface IAuthService {
  login(): Promise<void>;
  loginWithProvider(provider: AuthProviderType, credentials?: unknown): Promise<void>;
  logout(): Promise<void>;
  getAuthToken(): Promise<string | null>;
  refreshTokens(): Promise<void>;
  isAuthenticated(): Promise<boolean>;
}
```

#### API Service

- **Purpose**: Backend communication with automatic token management
- **Features**:
  - Automatic token refresh on 401 responses
  - Request/response logging
  - Error handling and retries
  - Circuit breaker pattern for resilience

#### Message Service

- **Purpose**: Type-safe communication between extension components
- **Features**:
  - Centralized message routing
  - Type definitions for all message types
  - Error handling and response management

#### Storage Service

- **Purpose**: Abstraction over Chrome storage APIs
- **Features**:
  - Consistent API across local/sync storage
  - Automatic serialization/deserialization
  - Error handling

#### Badge Service

- **Purpose**: Visual feedback through extension icon
- **Features**:
  - Success/error state indicators
  - Temporary notifications
  - Color coding for different states

### Content Scripts

#### Job Extractors

Site-specific modules that implement the `IJobExtractor` interface:

```typescript
interface IJobExtractor {
  canExtract(url: string): boolean;
  extract(): JobListing | null;
  isJobPage(url: string): boolean;
  watchForChanges(callback: (job: JobListing | null) => void): void;
}
```

**Current Extractors**:

- **LinkedIn**: Extracts job data from LinkedIn job view pages
- **Extensible**: Easy to add new job sites

#### Overlay Manager

- **Purpose**: Manages the floating capture UI on job pages
- **Features**:
  - Auto-positioning to avoid page conflicts
  - Dynamic show/hide based on job detection
  - Responsive design
  - Accessibility support

### Popup UI

- **Purpose**: Extension popup interface
- **Features**:
  - Multi-provider authentication UI
  - Job capture status and controls
  - Settings and configuration
  - Responsive design with Tailwind CSS

## 🛠️ Technology Stack

### Core Technologies

- **TypeScript**: Type-safe development with strict compilation
- **Chrome Extension Manifest V3**: Latest extension platform with service workers
- **Webpack 5**: Module bundling with optimization and code splitting
- **Tailwind CSS**: Utility-first styling framework

### Development Tools

- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Jest**: Testing framework with TypeScript support
- **Husky**: Git hooks for quality gates
- **lint-staged**: Staged file processing

### Build & Deployment

- **GitHub Actions**: CI/CD pipeline
- **Automated releases**: Tag-based release creation
- **Quality gates**: Lint, test, and typecheck on every commit

## 🔒 Security Considerations

### Authentication

- **Token-based**: Secure token storage in Chrome storage
- **Automatic refresh**: Handles token expiration gracefully
- **Provider isolation**: Clean separation between auth methods
- **Configurable providers**: Disable unused auth methods

### Data Handling

- **No local storage**: Jobs sent directly to backend
- **Secure transmission**: HTTPS-only API communication
- **Input validation**: Sanitization of extracted job data
- **Error boundaries**: Graceful handling of failures

### Permissions

- **Minimal permissions**: Only requests necessary Chrome permissions
- **Content script isolation**: Limited access to page content
- **Host permissions**: Restricted to supported job sites

## 📊 Data Flow

### Job Capture Flow

1. **Detection**: Content script detects job listing on page
2. **Extraction**: Site-specific extractor pulls job data
3. **Validation**: Data validation and sanitization
4. **UI Display**: Overlay shows capture option
5. **User Action**: User clicks capture button
6. **Authentication**: Service worker checks auth status
7. **API Call**: Job data sent to Vega AI backend
8. **Feedback**: Success/error feedback to user

### Authentication Flow

1. **Provider Selection**: User chooses auth method
2. **Credential Input**: Username/password or OAuth flow
3. **Token Exchange**: Backend returns access/refresh tokens
4. **Storage**: Secure token storage in Chrome storage
5. **API Integration**: Tokens attached to all API requests
6. **Refresh**: Automatic token refresh on expiration

## 🧪 Testing Strategy

### Unit Tests

- **Service classes**: Isolated testing with mocks
- **Extractors**: Job data extraction validation
- **Utilities**: Helper function testing

### Integration Tests

- **Message passing**: Component communication
- **Auth flows**: End-to-end authentication testing
- **API integration**: Backend communication testing

### Manual Testing

- **Cross-browser**: Chrome and Edge testing
- **Job sites**: Verification on supported platforms
- **User flows**: Complete capture workflows

## 🚀 Deployment

### Build Process

1. **Quality checks**: Lint, test, typecheck
2. **Webpack build**: Bundle optimization and minification
3. **Manifest generation**: Dynamic manifest.json creation
4. **Asset processing**: CSS/image optimization

### Release Process

1. **Tag creation**: Semantic versioning with git tags
2. **Automated build**: GitHub Actions triggers build
3. **Release creation**: Automatic GitHub release with artifacts
4. **Distribution**: Downloadable extension packages

### Environment Management

- **Development**: Local development with hot reload
- **Staging**: Manual build triggers for testing
- **Production**: Tag-based releases for users

## 🔄 Configuration Management

### Feature Flags

```typescript
interface FeatureFlags {
  enableGoogleAuth: boolean;      // Google OAuth availability
  enableAnalytics: boolean;       // Usage tracking
  maxJobsPerSession: number;      // Rate limiting
}
```

### Environment Configuration

- **Development**: Local API endpoints, debug logging
- **Production**: Production APIs, optimized builds
- **Configurable**: Easy environment switching

## 📈 Performance Considerations

### Bundle Optimization

- **Code splitting**: Separate bundles for different contexts
- **Tree shaking**: Unused code elimination
- **Minification**: Optimized production builds

### Runtime Performance

- **Lazy loading**: On-demand component loading
- **Memory management**: Proper cleanup and garbage collection
- **Event debouncing**: Optimized user interaction handling

### Monitoring

- **Error tracking**: Comprehensive error logging
- **Performance metrics**: Load time and response monitoring
- **Usage analytics**: Feature usage tracking (when enabled)

## 🔮 Future Enhancements

### Planned Features

- **Additional job sites**: Indeed, Glassdoor, Monster support
- **Advanced filtering**: Custom job matching criteria
- **Bulk operations**: Multi-job capture and management
- **Offline support**: Local caching and sync capabilities

### Technical Improvements

- **Web Workers**: Heavy processing offloading
- **IndexedDB**: Enhanced local storage capabilities
- **PWA features**: Service worker enhancements
- **Accessibility**: Enhanced ARIA support and keyboard navigation

### Integration Opportunities

- **Calendar integration**: Interview scheduling
- **CRM integration**: Contact management
- **Analytics dashboard**: Job search insights
- **Mobile companion**: React Native app integration
