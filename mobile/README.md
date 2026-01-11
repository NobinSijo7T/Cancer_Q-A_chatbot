# Cancer Q&A Chatbot - Mobile App

An Android mobile application for the Cancer Q&A Chatbot built with Expo and React Native.

## Quick Start (Automatic - Recommended)

The app now automatically starts the Flask backend when you run it:

```bash
cd mobile
npm install
npm start
```

This will:
1. ✅ Start the Flask backend automatically
2. ✅ Start the Expo development server
3. ✅ Open the app (press 'w' for web, 'a' for Android)

To stop both services, press `Ctrl+C` once.

## Manual Start (Alternative)

If you prefer to run the backend separately:

**Terminal 1 - Backend:**
```bash
cd Cancer_chatbot
python app.py
```

**Terminal 2 - Mobile App Only:**
```bash
cd mobile
npm run start-mobile-only
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android Emulator) or physical Android device
- Flask backend running (see main project README)

## Installation

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

## Running the App

### Option 1: Android Emulator

1. Make sure Android Studio is installed and an emulator is set up
2. Start the Flask backend (from the main project directory):
```bash
cd Cancer_chatbot
python app.py
```

3. Start the Expo development server:
```bash
npm start
```

4. Press `a` to open the app in Android emulator

### Option 2: Physical Android Device

1. Install the Expo Go app from Google Play Store
2. Make sure your phone and computer are on the same network
3. Update the `apiUrl` in `app.json`:
   - Find your computer's local IP address (e.g., `192.168.1.100`)
   - Change `"apiUrl": "http://10.0.2.2:5000"` to `"apiUrl": "http://YOUR_IP:5000"`
   
4. Start the Flask backend:
```bash
cd Cancer_chatbot
python app.py
```

5. Start the Expo development server:
```bash
npm start
```

6. Scan the QR code with Expo Go app

## Building APK

To build a standalone APK for distribution:

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Configure EAS:
```bash
eas build:configure
```

3. Build for Android:
```bash
eas build --platform android --profile preview
```

## Configuration

### Backend URL

The app connects to the Flask backend API. The default configuration in `app.json`:

- **Android Emulator**: `http://10.0.2.2:5000` (emulator's localhost)
- **Physical Device**: Update to your computer's local IP address

To change the backend URL, edit the `extra.apiUrl` field in `app.json`.

## Features

- 💬 Real-time chat interface
- 🎨 Modern light UI optimized for readability  
- 🎬 Smooth animated splash screen with ease-out effect
- 🎗️ Custom Cancer QA branding and icons
- 👍👎 Feedback system for responses
- 📱 Native Android experience
- 🔄 Automatic conversation tracking
- ⚡ Fast and responsive
- 🔗 Clickable source links from web search
- **Bold** and *italic* text formatting in responses

## Project Structure

```
mobile/
├── App.js              # Main application component
├── SplashScreen.js     # Animated splash screen component
├── api.js              # API service for backend communication
├── app.json            # Expo configuration
├── package.json        # Dependencies
├── babel.config.js     # Babel configuration
└── assets/             # Icons and images
    ├── icon-generator.html  # Tool to generate app icons
    └── README.md            # Icon creation instructions
```

## Customizing Icons

The app includes a built-in icon generator. To create custom icons:

1. Open `assets/icon-generator.html` in your browser
2. Preview the generated icons
3. Click download buttons to save each icon
4. Place the downloaded files in the `assets/` folder
5. Restart the app to see the new icons

Alternatively, follow instructions in `assets/README.md` to create icons using design tools.

## Troubleshooting

### Cannot connect to Flask backend

1. Make sure the Flask backend is running on port 5000
2. Check that CORS is enabled in the Flask app
3. Verify the `apiUrl` in `app.json` is correct
4. For physical devices, ensure phone and computer are on the same network
5. Try disabling firewall temporarily to test connectivity

### App crashes on startup

1. Clear cache: `expo start -c`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check that all required dependencies are installed

## Backend Setup

Make sure the Flask backend is configured for mobile access:

1. Install flask-cors:
```bash
pip install flask-cors
```

2. The backend should already have CORS enabled in `Cancer_chatbot/app.py`

3. Run the backend:
```bash
cd Cancer_chatbot
python app.py
```

The backend should be accessible at `http://localhost:5000`

## Development

### Adding new features

- Edit `App.js` for UI changes
- Edit `api.js` for API communication changes
- Update `app.json` for configuration changes

### Testing

Test the app thoroughly:
- Different Android versions
- Different screen sizes
- Network conditions (slow/fast)
- Backend connectivity issues

## License

This project is part of the Cancer Q&A Chatbot application. See the main project LICENSE file.
