type SophcodeLogoProps = {
  className?: string;
};

export default function SophcodeLogo({ className = 'w-5 h-5' }: SophcodeLogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Sophcode">
      <rect width="24" height="24" rx="5" fill="#6C5CE7" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
        So
      </text>
    </svg>
  );
}
