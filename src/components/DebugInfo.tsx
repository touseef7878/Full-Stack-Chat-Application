import React from 'react';
import { useSession } from '@/components/SessionContextProvider';

const DebugInfo: React.FC = () => {
  const { session, isGuest } = useSession();
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs z-50">
      <div>Session: {session ? 'Yes' : 'No'}</div>
      <div>User ID: {session?.user?.id?.slice(0, 8) || 'None'}</div>
      <div>Email: {session?.user?.email || 'None'}</div>
      <div>Guest: {isGuest ? 'Yes' : 'No'}</div>
    </div>
  );
};

export default DebugInfo;