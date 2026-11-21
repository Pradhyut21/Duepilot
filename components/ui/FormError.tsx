export interface FormErrorProps {
  message?: string;
}

/** Form-level error banner. Renders nothing when there is no message. */
export function FormError({ message }: FormErrorProps) {
  if (!message) {
    return null;
  }
  return (
    <div
      role="alert"
      className="rounded-lg border border-negative/30 bg-red-50 px-4 py-3 text-sm text-negative"
    >
      {message}
    </div>
  );
}

