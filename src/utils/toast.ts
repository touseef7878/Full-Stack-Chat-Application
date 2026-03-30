import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showInfo = (message: string, description?: string, onClick?: () => void) => {
  toast.info(message, {
    description: description,
    action: onClick ? { label: "View", onClick: onClick } : undefined,
    duration: 5000, // Show for 5 seconds
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};