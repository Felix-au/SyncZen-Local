import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Hotel Check-In',
  slug: 'hotel-checkin-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  scheme: 'hotelcheckin',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0f',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0f',
    },
    package: 'com.hotelcheckin.mobile',
    versionCode: 1,
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
  },
  ios: {
    bundleIdentifier: 'com.hotelcheckin.mobile',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription:
        'Camera is required to capture guest portraits and ID documents during check-in.',
      NSPhotoLibraryUsageDescription:
        'Photo library access is needed to attach guest photos.',
      NSMicrophoneUsageDescription:
        'Microphone permission is required by the camera module.',
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Hotel Check-In to access your camera for guest photos and ID scanning.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Allow Hotel Check-In to access photos.',
        savePhotosPermission: 'Allow Hotel Check-In to save photos.',
        isAccessMediaLocationEnabled: true,
      },
    ],
    [
      'react-native-vision-camera',
      {
        cameraPermissionText: 'Allow Hotel Check-In to use the camera for guest photos and ID scanning.',
        enableMicrophonePermission: false,
      },
    ],
  ],
  // extra: {
  //   eas: {
  //     projectId: 'YOUR-EAS-PROJECT-ID',  // Replace after running: eas init
  //   },
  // },
})
