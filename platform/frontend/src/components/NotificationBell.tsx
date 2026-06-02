/**
 * NotificationBell — lightweight badge only.
 * The full panel is handled by NotificationsPanel.tsx.
 * Polls /notifications/count every 20s for the unread badge.
 */
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const token = tokenStorage.get();

  async function poll() {
    if (!token) return;
    try {
      const data = await apiRequest<{ unread: number }>('/notifications/count', {}, token);
      setUnread(data.unread ?? 0);
    } catch {
      // silent — NotificationsPanel handles the full UI
    }
  }

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 20_000);
    return () => clearInterval(iv);
  }, []);

  // If unread > 0, the badge is visible on the NotificationsPanel button
  // This component is kept for backwards-compat in layouts that import it directly
  if (unread === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 10px', borderRadius: 99,
      background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
      fontSize: '.74rem', fontWeight: 700, color: '#fca5a5',
    }}>
      <Bell size={12} />
      {unread} non lue{unread > 1 ? 's' : ''}
    </div>
  );
}
