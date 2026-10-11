// Submit button that asks first, in the app-styled popup (see components/Feedback.tsx).
// danger: red "Yes" button for deletes.
export default function ConfirmButton({ message, className, danger, children }: { message: string; className?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button className={className} data-confirm={message} {...(danger ? { "data-danger": "" } : {})}>
      {children}
    </button>
  );
}
