interface ArrowProps {
  length?: number;
  vertical?: boolean;
}

export function Arrow({ length = 72, vertical = false }: ArrowProps) {
  const width = vertical ? 10 : length;
  const height = vertical ? length : 10;
  const line = vertical ? `M5 8 V${length - 8}` : `M8 5 H${length - 8}`;
  const headA = vertical ? "M5 1 L2 7 L8 7 Z" : "M1 5 L7 2 L7 8 Z";
  const headB = vertical
    ? `M5 ${length - 1} L2 ${length - 7} L8 ${length - 7} Z`
    : `M${length - 1} 5 L${length - 7} 2 L${length - 7} 8 Z`;

  return (
    <svg
      aria-hidden="true"
      className="block shrink-0"
      fill="none"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <path
        d={line}
        stroke="currentColor"
        strokeDasharray="2 4"
        strokeWidth="1"
      />
      <path d={headA} fill="currentColor" />
      <path d={headB} fill="currentColor" />
    </svg>
  );
}
