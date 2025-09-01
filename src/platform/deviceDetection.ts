// src/platform/deviceDetection.ts - Detecção granular de dispositivos iOS

export interface DeviceInfo {
  platform: 'iOS' | 'Android' | 'Desktop';
  device: 'iPhone' | 'iPad' | 'Android' | 'Desktop';
  isStandalone: boolean;
  userAgent: string;
  screenSize: {
    width: number;
    height: number;
  };
}

export class DeviceDetection {
  private static instance: DeviceDetection;
  private deviceInfo: DeviceInfo;

  private constructor() {
    this.deviceInfo = this.detectDevice();
  }

  public static getInstance(): DeviceDetection {
    if (!DeviceDetection.instance) {
      DeviceDetection.instance = new DeviceDetection();
    }
    return DeviceDetection.instance;
  }

  private detectDevice(): DeviceInfo {
    const userAgent = navigator.userAgent;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        Boolean((window.navigator as { standalone?: boolean }).standalone);
    
    let platform: DeviceInfo['platform'] = 'Desktop';
    let device: DeviceInfo['device'] = 'Desktop';

    // Verificar características específicas de tela
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // Detecção específica iOS com fallbacks RIGOROSOS
    if (/iPad/.test(userAgent)) {
      platform = 'iOS';
      device = 'iPad';
    } else if (/iPhone|iPod/.test(userAgent)) {
      platform = 'iOS';
      device = 'iPhone';
    } else if (/Android/.test(userAgent)) {
      platform = 'Android';
      device = 'Android';
    }
    
    // NÃO fazer fallbacks para PWA sem user agent explícito iOS
    // Isso evita detectar desktop como iPhone PWA

    return {
      platform,
      device,
      isStandalone,
      userAgent,
      screenSize: {
        width: screenWidth,
        height: screenHeight
      }
    };
  }

  public getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  public isIPhone(): boolean {
    return this.deviceInfo.device === 'iPhone';
  }

  public isIPad(): boolean {
    return this.deviceInfo.device === 'iPad';
  }

  public isIOS(): boolean {
    return this.deviceInfo.platform === 'iOS';
  }

  public isPWA(): boolean {
    return this.deviceInfo.isStandalone;
  }

  public isIPhonePWA(): boolean {
    return this.isIPhone() && this.isPWA();
  }

  public isIPadPWA(): boolean {
    return this.isIPad() && this.isPWA();
  }

  public getDebugInfo(): string {
    const info = this.getDeviceInfo();
    const hasIOSFeatures = 'standalone' in navigator;
    const hasDeviceMotion = window.DeviceMotionEvent !== undefined;
    const maxDimension = Math.max(info.screenSize.width, info.screenSize.height);
    
    return `
📱 Device Detection:
- Platform: ${info.platform}
- Device: ${info.device}
- PWA Mode: ${info.isStandalone ? 'YES' : 'NO'}
- Screen: ${info.screenSize.width}x${info.screenSize.height} (max: ${maxDimension})
- User Agent: ${info.userAgent}

🔍 Detection Features:
- navigator.standalone: ${hasIOSFeatures ? 'YES' : 'NO'}
- DeviceMotionEvent: ${hasDeviceMotion ? 'YES' : 'NO'}
- Display mode standalone: ${window.matchMedia('(display-mode: standalone)').matches ? 'YES' : 'NO'}

🎯 Classification Logic:
- iPad criteria: UA contains 'iPad' OR (iOS features + screen ≥1024)
- iPhone criteria: UA contains 'iPhone' OR (iOS features + screen <1024)
- Fallback: PWA + iOS features = ${info.isStandalone && hasIOSFeatures ? 'iOS device' : 'Not iOS'}
    `.trim();
  }
}
