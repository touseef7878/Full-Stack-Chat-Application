import { useAndroidBack } from '@/hooks/useAndroidBack';

interface AndroidBackHandlerProps {
  onBackFromChat?: () => void;
  isChatOpen?: boolean;
}

const AndroidBackHandler = ({ onBackFromChat, isChatOpen }: AndroidBackHandlerProps) => {
  useAndroidBack(onBackFromChat, isChatOpen);
  return null;
};

export default AndroidBackHandler;
