import { getSupabaseBrowserClient } from '../lib/supabaseClient';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const pushService = {
  /**
   * Requests user permission for notifications.
   */
  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!isPushSupported()) return 'unsupported';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return 'denied';
    }
  },

  /**
   * Retrieves the active browser PushSubscription, if any.
   */
  async getBrowserSubscription(): Promise<PushSubscription | null> {
    if (!isPushSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch {
      return null;
    }
  },

  /**
   * Subscribes the current device/browser to Web Push using the VAPID public key
   * and saves the subscription record in Supabase.
   */
  async subscribe(
    userId: string,
    vapidPublicKey: string
  ): Promise<{ success: boolean; error: string | null }> {
    if (!isPushSupported()) {
      return { success: false, error: 'Web Push is not supported in this browser' };
    }

    if (!vapidPublicKey) {
      return { success: false, error: 'VAPID public key is missing' };
    }

    try {
      // 1. Request permission if not already granted
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission was denied' };
      }

      // 2. Wait for service worker and subscribe to PushManager
      const reg = await navigator.serviceWorker.ready;
      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        });
      }

      // 3. Extract keys
      const p256dhKey = arrayBufferToBase64(subscription.getKey('p256dh'));
      const authKey = arrayBufferToBase64(subscription.getKey('auth'));

      if (!p256dhKey || !authKey) {
        return { success: false, error: 'Failed to extract push encryption keys' };
      }

      // 4. Save subscription in Supabase
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error: dbError } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh_key: p256dhKey,
            auth_key: authKey,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          },
          { onConflict: 'user_id, endpoint' }
        );

        if (dbError) {
          return { success: false, error: dbError.message };
        }
      }

      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to subscribe to push notifications',
      };
    }
  },

  /**
   * Unsubscribes the current device and removes the subscription from Supabase.
   */
  async unsubscribe(userId: string): Promise<{ success: boolean; error: string | null }> {
    if (!isPushSupported()) return { success: true, error: null };

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)
            .eq('user_id', userId);
        }
      }

      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications',
      };
    }
  },

  /**
   * Checks subscription status across local browser and database.
   */
  async checkSubscriptionStatus(userId: string): Promise<{
    supported: boolean;
    permission: NotificationPermission | 'unsupported';
    isSubscribed: boolean;
  }> {
    if (!isPushSupported()) {
      return { supported: false, permission: 'unsupported', isSubscribed: false };
    }

    const permission = Notification.permission;
    if (permission !== 'granted') {
      return { supported: true, permission, isSubscribed: false };
    }

    const sub = await this.getBrowserSubscription();
    return {
      supported: true,
      permission,
      isSubscribed: Boolean(sub),
    };
  },

  /**
   * Triggers a test push notification via Edge Function.
   */
  async sendTestNotification(): Promise<{ success: boolean; message: string; error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        success: false,
        message: '',
        error: 'Supabase client is not configured',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('dispatch-task-reminders', {
        body: { test: true },
      });

      if (error) {
        return {
          success: false,
          message: '',
          error: error.message || 'Failed to dispatch test notification',
        };
      }

      return {
        success: Boolean(data?.success),
        message: data?.message || 'Test notification dispatched',
        error: data?.error || null,
      };
    } catch (err) {
      return {
        success: false,
        message: '',
        error: err instanceof Error ? err.message : 'Unexpected error invoking test push',
      };
    }
  },
};
