import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** One shared popup style: dark teal card, teal accent bar and icons; type shown by icon + title. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      theme="dark"
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-popup-accent" aria-hidden="true" />,
        info: <Info className="h-5 w-5 text-popup-accent" aria-hidden="true" />,
        warning: <AlertTriangle className="h-5 w-5 text-popup-strong" aria-hidden="true" />,
        error: <XCircle className="h-5 w-5 text-popup-strong" aria-hidden="true" />,
        loading: <Loader2 className="h-5 w-5 animate-spin text-popup-accent" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:popup group-[.toaster]:shadow-none group-[.toaster]:text-base group-[.toaster]:items-start",
          title: "group-[.toast]:text-[15px]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground group-[.toast]:min-h-9 group-[.toast]:focus-visible:outline-ring",
          cancelButton: "group-[.toast]:!bg-transparent group-[.toast]:!text-foreground group-[.toast]:border group-[.toast]:border-border group-[.toast]:min-h-9",
          closeButton: "group-[.toast]:!bg-card group-[.toast]:!border-border group-[.toast]:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
