# TV Time Giver App - CV Edition Implementation Plan

## Goal
Build a premium web application that uses **Computer Vision (webcam)** to automatically count exercises and award TV time.

## User Review Required
- **Webcam Usage**: The app will require camera access. All processing is done locally in your browser (privacy focused).
- **Complexity**: This is a more complex app. I will split it into 3 files (`index.html`, `script.js`, `style.css`) in the artifacts folder, which you can keep together in a folder on your desktop.
-   **Reporting**: `finishAndReport()` constructs **Gmail Web** link (User Request).
-   **Approval**: State machine for `Waiting` -> `Success` / `Fail`.
-   **Jumping Jacks**: Detect Arms Up/Legs Out vs Arms Down/Legs In.
-   **Body Saw Plank**: 
    -   Track relative horizontal distance between shoulder and elbow landmarks.
    -   Count rep when body shifts backward and returns to starting plank position.
    -   Threshold: ~50% of upper arm length displacement.
-   **Form Correction**: 
    -   Calculate angles real-time.
-   **All Day Mode**: New feature for continuous monitoring.
-   **Approval Screen**:
    -   Apps enters "Waiting" state.
    -   Shows "Approve" (Green) and "Decline" (Red) buttons (Simulating Parent).
    -   **Approved**: Shows "Watch TV" screen.
    -   **Declined**: Shows "No TV" screen.

## Automated Approval (Gmail API)
-   **Integration**: Add Google API Client Library (GAPI).
-   **Authentication**: Implement OAuth 2.0 flow.
-   **Polling**: Background task that checks Gmail every 30 seconds for messages:
    -   **Criteria**: `from:venky24aug@gmail.com "ok"` or `"no"`.
    -   **Thread Check**: Link to the current workout session ID for accuracy.
-   **User Setup**: User will need to provide a `CLIENT_ID` from Google Cloud Console.

## Phase 6: Google Sheets Data Persistence
-   **Objective**: Save workout history to a permanent Google Sheet.
-   **Authentication**: Expand `SCOPES` to include `spreadsheets` and `userinfo.profile`.
-   **Feature: Google Login**:
    -   New Login screen on first load.
    -   "Register" button (same as Login) to initialize the user's TV Time Sheet.
-   **Sync Logic**:
    -   Check if a sheet named "TV_Time_Data" exists.
    -   If not, create it with headers: `Date`, `User`, `Exercise`, `Value`, `Total_Earned`.
    -   `syncToSheets()`: Append a new row every time an exercise session is finished or a milestone is reached.
-   **User Setup**: User must enable **"Google Sheets API"** in the Cloud Console.

### 4. File Structure
Same 3-file structure (`index.html`, `script.js`, `style.css`), but significant logic rewrite.

### Phase 7: Voice Assistant ("Hey Buddy") [NEW]
- **Goal**: Add hands-free control via voice commands.
- **Wake Word**: "Hey buddy".
- **Tech**: Web Speech API (`SpeechRecognition`).
- **Privacy**: The browser only "listens" for keywords; no audio is recorded or sent to servers after the session.
- **Commands**:
    - "Start [Exercise]" (e.g., "Start Pushups")
    - "Stop" or "Back" (returns to menu)
    - "Total Time" (AI tells earned time)
    - "Finish Day" (Triggers report)
    - "Reset" (Triggers Start New Day)
### Phase 8: Offline Voice Assistant (Vosk) [NEW]
- **Goal**: Replace cloud-dependent Web Speech API with a local, offline model to eliminate "Network Errors".
- **Tech**: **Vosk-browser** (WebAssembly).
- **Inference**: Processing happens 100% on your device using a small (~40MB) English model.
- **Workflow**:
    1.  Load Vosk-browser library via CDN.
    2.  Download/Initialize the WASM model (first load only, then cached).### Phase 9: Voice Sensitivity Tuning [NEW]
- **Goal**: Improve responsiveness for slow, quiet, or accented speech.
- **Tuning Strategy**:
    - **Buffer Size**: Reduce `ScriptProcessor` buffer from 4096 to 2048 for faster feedback.
    - **Grammar Optimization**: Restrict Vosk's search vocabulary to only the wake word and exercise commands to increase accuracy.
    - **Matching Logic**: Implement "Any Word" matching for the wake word (listening for just "buddy" or "hey buddy").
    - **Audio Gain**: Ensure `autoGainControl` is explicitly true.
    - **Responsive Commands**: Process commands in `handlePartialResult` (not just `handleResult`) for immediate response.
    - **Buffer Reset**: Call `recognizer.reset()` after wake-word detection to clear "buddy" from the buffer.

### Phase 10: Automatic Gmail + Instant Buttons [FINAL]
- **Goal**: Auto-send email (Gmail API) but use Web App links for "No Reply" approval.
- **Workflow**:
    1.  **Apps Script**: Deployed as Web App (handles `doGet`).
    2.  **Child App**: Sends email (Gmail API) containing `<a href="WEB_APP_URL?action=APPROVE">`.
    3.  **Parent**: Clicks link -> Apps Script updates Sheet -> Child Polls Sheet.
- **Changes**:
    - Keep Gmail `send` scope.
    - Add UI/Prompt to save `WEB_APP_URL`.
    - Update `sendEmail` to use Web App links.
    - Switch polling back to `pollSheetStatus` (faster/cleaner than Gmail polling).
    3.  Stream microphone data to the Vosk engine.
    4.  Process "Hey Buddy" and exercise names locally.
- **Privacy**: No audio data leaves the laptop.
### Anti-Cheat System (New)
#### [MODIFY] [script.js](file:///C:/Users/hi coder/.gemini/antigravity/brain/cb0f6429-b178-4e8f-9b39-4dffcef35e2d/script.js)
-   **Face Visibility**: Add `checkFaceVisibility()` using Landmark 0 (Nose).
    -   If confidence < 0.8, pause and warn "Face Not Visible".
-   **Liveness Check**: Add `checkLiveness()`.
    -   Track Nose Position history (last 30 frames).
    -   Calculate Variance.
    -   If Variance < Threshold (Too static) -> Warn "Don't use a photo!".
-   **Strict ROM**: Add visual feedback for "Go Lower" or "Go Higher" to encourage full reps.

## Phase 12: Premium Dashboard UI [NEW]
- **Goal**: Transform the app into a modern, professional dashboard similar to the reference image.
- **Design System**:
    -   **Layout**: Sidebar Navigation (Left) + Main Content Area (Right).
    -   **Theme**: Vibrant colors, glassmorphism, clean typography (Inter).
-   **Components**:
    -   **Sidebar**: Tabs for "Dashboard", "Workout" (Camera), "History", "Settings".
    -   **Stat Cards**: Colorful cards displaying "Total Earned", "Total Reps", "Daily Goal", "Calories (Est)".
    -   **Charts**: CSS-based Bar Chart for "Weekly Activity".
    -   **Recent Activity**: List of completed sets.
-   **Refactoring**:
    -   Move existing Camera/Vision logic to the "Workout" view.
    -   Ensure "Dashboard" is the default view on login.

## Verification Plan
### Automated Tests
- Unit tests for the "Angle Calculation" functions.

### Manual Verification
- I will launch the app and perform a walkthrough of the new AI features.
- Test Voice Feedback (needs browser audio).
- Test Chatbot responses.

## Phase 13: Enhanced UX & Insights [NEW]
- **Actionable Insights**:
    - Add `updateInsights()` function in `script.js`.
    - Logic: 
        - If `earned < 2` -> "Try 20 Jumping Jacks for a quick start!"
        - If `time > 7am` -> "Squats are 50%. Focus on Pushups!"
- **Fine Body Tracking**:
    - Modify `onResults` in `script.js`.
    - Use `drawConnectors` with specific colors (Cyan for Right, Magenta for Left).
    - Draw `LANDMARKS` with radius 4px.
- **Personalization**:
    - Use `gapi.client.oauth2.userinfo` data to welcome user by name.

## Phase 14: Layout Editor (Wix-Style) [NEW]
- **Goal**: Allow user to customize the dashboard layout and text without coding.
- **Features**:
    - **"Edit Mode" Toggle**: A floating button that enables editing.
    - **Draggable Sections**: Use HTML5 Drag & Drop API to reorder `dashboardSection`, `workoutSection`, `historySection`.
    - **Editable Text**: Set `contenteditable="true"` on `h1`, `h2`, `h3`, `p` tags when in edit mode.
    - **Persistence**:
        - `saveLayout()`: Iterate through parent containers, capture child IDs in order, save to LocalStorage.
        - `loadLayout()`: Re-append children in saved order on startup.
