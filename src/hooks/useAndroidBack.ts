import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Intercepts Android hardware back button (popstate).
 * - If a chat is open: calls onBackFromChat (goes back to sidebar)
 * - If on a non-root page (login/register): navigates back in router
 * - If on root with no chat open: re-pushes sentinel (OS handles minimize)
 */
export const useAndroidBack = (onBackFromChat?: () => void, isChatOpen?: boolean) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Always keep a sentinel entry so back never leaves the app
    window.history.pushState({ sentinel: true }, '');

    const handlePopState = () => {
      // Immediately re-push so we always have a buffer entry
      window.history.pushState({ sentinel: true }, '');

      const rootRoutes = ['/', '/chat', '/chat/guest'];
      const isRoot = rootRoutes.includes(location.pathname);

      if (isRoot) {
        if (isChatOpen && onBackFromChat) {
          // Chat is open → go back to sidebar
          onBackFromChat();
        }
        // else: on root with no chat → do nothing, OS minimizes app
        return;
      }

      // Non-root page (login, register, etc.) → go back in router
      navigate(-1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate, location.pathname, isChatOpen, onBackFromChat]);
};
