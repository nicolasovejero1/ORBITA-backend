/**
 * `expo-server-sdk` es ESM puro — el
 * runtime de Jest sobre Node 22 no soporta `require(esm)` síncrono. Los unit
 * tests lo mockean por spec con `jest.mock(...)`; acá se mapea una vez para
 * todo el arbol de e2e (que bootstrapea AppModule completo, arrastrándolo
 * transitivamente vía PushService) con `moduleNameMapper` en jest-e2e.json.
 */
export class Expo {
  static isExpoPushToken(): boolean {
    return true;
  }

  chunkPushNotifications<T>(messages: T[]): T[][] {
    return [messages];
  }

  sendPushNotificationsAsync(): Promise<
    { status: string; message?: string; details?: { error?: string } }[]
  > {
    return Promise.resolve([]);
  }
}
