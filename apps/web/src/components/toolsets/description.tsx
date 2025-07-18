import { useState } from "react";

export function ExpandableDescription({
  description,
}: {
  description: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative max-w-full">
      <p
        className={`text-xs text-muted-foreground break-all ${
          !isExpanded ? "line-clamp-1" : ""
        }`}
      >
        {description}
      </p>
      {description.length > 60 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="inline-flex items-center gap-0.5 text-xs text-foreground hover:underline mt-0.5 cursor-pointer"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
