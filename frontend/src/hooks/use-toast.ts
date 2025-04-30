import { useToast as useToastFromUI } from '@/components/ui/toast';

export { useToast };

// This is just a re-export of the toast hook from the UI components
// Doing it this way allows us to potentially add functionality later
// without changing import statements throughout the app
const useToast = useToastFromUI;
