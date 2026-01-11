module.exports = {
  expo: {
    name: "Cancer QA Chatbot",
    slug: "cancer-qa-chatbot",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#FFFFFF"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.cancerqa.chatbot"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      },
      package: "com.cancerqa.chatbot",
      permissions: [
        "INTERNET"
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    platforms: ["android", "web"],
    extra: {
      apiUrl: "http://10.0.2.2:5001",
      eas: {
        projectId: "b2f6d0be-a921-4bf9-a816-426a079df90f"
      }
    },
    plugins: [
      "./plugins/withKotlinVersionFix",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0",
            kotlinVersion: "1.9.25"
          }
        }
      ]
    ]
  }
};
