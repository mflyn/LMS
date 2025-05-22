# Mobile Frontend Code Review Notes (frontend/mobile/)

This document summarizes the findings and recommendations from the code review of the `frontend/mobile` directory.

## High Priority Issues

1.  **`api.js`: Token Key Mismatch (Critical for Auth)**
    *   **Status: RESOLVED**
    *   **Resolution**: Unified `AsyncStorage` key to `'userToken'` in `api.js`.

2.  **`api.js`: Missing Navigation to Login on 401 (Critical for UX)**
    *   **Status: RESOLVED**
    *   **Resolution**: Implemented `NavigationService.js` and integrated it into `App.js` and `api.js` to navigate to 'Login' screen on 401 errors.

## Medium Priority Issues

1.  **`networkManager.js` & `NetworkContext.js`: Overlapping Network State Logic**
    *   **Status: RESOLVED**
    *   **Resolution**: Removed the redundant `useNetworkStatus` hook and related logic from `networkManager.js`. `NetworkProvider` in `NetworkContext.js` is now the single source of truth for global network state, utilizing helper functions from `networkManager.js`.

2.  **`contexts/AuthContext.js`: Redundant `AuthProvider` Component**
    *   **Status: RESOLVED**
    *   **Resolution**: Removed the unused `AuthProvider` component from `AuthContext.js`.

3.  **File Organization: Screen Components in `src/components/`**
    *   **Status: PARTIALLY RESOLVED (Guidance Provided)**
    *   **Resolution**: Updated import paths in `AppNavigator.js` to point to `../screens/`. 
    *   **Action Required**: Developer needs to manually move the screen component files from `src/components/` to `src/screens/`.

## Low Priority Issues & Enhancement Points

1.  **`analyticsService.js`: Potential Event Redundancy (`SESSION_START` vs. `app_start`)**
    *   **Status: RESOLVED**
    *   **Resolution**: Removed the explicit `app_start` event tracking in `App.js`, relying on `SESSION_START` within `analyticsService.init()`.

2.  **`analyticsService.js`: `setInterval` Management**
    *   **Status: RESOLVED**
    *   **Resolution**: Added `stopAutoSync()` method to `analyticsService.js` to clear the interval, and called this method in `App.js` when `MainApp` unmounts.

3.  **`App.js`: Loading State in `MainApp`**
    *   **Status: RESOLVED**
    *   **Resolution**: Modified `MainApp` to display a centered `ActivityIndicator` while `isLoading` is true.

4.  **`App.js`: `authContext` Object Optimization**
    *   **Status: RESOLVED**
    *   **Resolution**: Used `React.useMemo` to memoize the `authContext` object in `MainApp`.

5.  **`enhancedApi.js`: Limited Offline Queue for Write Operations**
    *   **Status: NOTED (Feature Enhancement)**
    *   **Recommendation**: This is a feature enhancement. Evaluate which other critical write operations (e.g., profile updates, marking notifications) should support offline queueing based on product requirements. This requires further design and implementation beyond simple bug fixing.

6.  **`enhancedApi.js`: Offline Queue Sync Failure Handling**
    *   **Status: NOTED (Feature Enhancement)**
    *   **Recommendation**: Current behavior (log error, keep item in queue) is basic. Implementing robust retry strategies (with backoff, max attempts) or a way to mark items as "permanently failed" is a significant feature enhancement requiring careful design.

7.  **`enhancedApi.js`: Cache Key Generation for GET Requests**
    *   **Status: PARTIALLY RESOLVED (Guidance & Example Applied)**
    *   **Resolution**: Introduced `getStableObjectString` helper in `enhancedApi.js` and applied it to `homework.getAll`. 
    *   **Action Required**: Developer should review other API calls in `enhancedApi.js` that use object filters for cache keys (e.g., for resources, recommendations if applicable) and apply `getStableObjectString`comedy_ hypnotist_ hypnotized_ audiences_ to_ comedy_ gold_ for_ consistent_ cache_ key_ generation.

## Configuration & Build Related

1.  **`api.js`: Hardcoded `baseURL`**
    *   **Status: IMPROVED (Foundation Laid)**
    *   **Resolution**: Modified `api.js` to select `baseURL` from a simple config object based on `__DEV__`. 
    *   **Action Required**: For a robust solution, this should be integrated with a proper environment variable system (e.g., using `react-native-config` or build-time replacements) for different build targets (dev, staging, prod).

## Items for Verification

1.  **`package.json`: Navigation Library Redundancy**
    *   **Status: VERIFICATION PENDING**
    *   **Observation**: `AppNavigator.js` uses `createNativeStackNavigator` from `@react-navigation/native-stack`.
    *   **Action Required**: Developer to perform a global codebase search for any usage of `createStackNavigator` from `@react-navigation/stack`. If none are found, `@react-navigation/stack` can be safely removed from `package.json` and dependencies reinstalled.

This review provides a snapshot of the mobile frontend's current state. Addressing these points, particularly the high-priority ones, will significantly improve the application's stability, maintainability, and user experience. 