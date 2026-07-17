"use client";

export function SuggestedQuestions({
  questions,
  onPick,
  disabled,
}: {
  questions: string[];
  onPick: (question: string) => void;
  disabled?: boolean;
}) {
  if (!questions.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onPick(question)}
          disabled={disabled}
          className="rounded-full border border-surface-4 bg-surface-2 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-brand-gold hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
