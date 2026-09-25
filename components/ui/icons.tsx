import type { SVGProps } from "react";

// Original, minimal stroke icons (rounded to match the type). Decorative by default (aria-hidden);
// the surrounding button supplies the accessible label.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11.5 21 4l-5.5 17-3.8-7.2L3 11.5Z" />
    <path d="m11.7 13.8 4.6-5" />
  </Svg>
);
export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 5.5h17v13h-17z" />
    <path d="m4 17 5-5.5 3.5 3.5 2.5-2.5 5 5" />
    <path d="M15.5 9.2h.01" strokeWidth={3} />
  </Svg>
);
export const ReplyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 5 3.5 11l6 6" />
    <path d="M4 11h9.5c4 0 7 2.5 7 7.5" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
  </Svg>
);
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8Z" />
    <path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
  </Svg>
);
export const ChatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 5h17l-1.5 11h-9l-4.5 4v-4H4.5L3.5 5Z" />
  </Svg>
);
export const BondIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4.5 13 12l-5 7.5L3 12l5-7.5Z" />
    <path d="M16 4.5 21 12l-5 7.5L11 12l5-7.5Z" />
  </Svg>
);
export const MemoriesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4.5 6.5 12-2.5 3 14.5-12 2.5z" />
    <path d="m6.8 15.5 3.2-4 2.4 2.4 2.2-2.9 2.3 3.4" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />
  </Svg>
);
export const DoubleCheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m1.5 12.5 4.5 4.5L16 7" />
    <path d="m11 16.8.3.2L22.5 7" />
  </Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 22 20H2L12 3Z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </Svg>
);
export const ArrowDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v15M5.5 13l6.5 6.5 6.5-6.5" />
  </Svg>
);
export const ArrowUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20V5M5.5 11 12 4.5l6.5 6.5" />
  </Svg>
);
export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11.5" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5v15M4.5 12h15" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14" />
  </Svg>
);
export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" />
    <path d="M10 20.5h4" />
  </Svg>
);
export const RetryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4h-4" />
  </Svg>
);
export const EditIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19.5 8.5l-4-4L4 16v4Z" />
  </Svg>
);
export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5H5v15h9" />
    <path d="M10 12h10.5M17 8l4 4-4 4" />
  </Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6.5h16v13.5H4z" />
    <path d="M4 10.5h16M8.5 4v4M15.5 4v4" />
  </Svg>
);
export const MapPinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
    <path d="M12 7.3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
  </Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
  </Svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Svg>
);
export const LocateIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </Svg>
);

/** A peeling sticker: square with a folded corner and a smile. */
export const StickerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12.5V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h4.5Z" />
    <path d="M20 12.5 12.5 20v-3.5a4 4 0 0 1 4-4Z" />
    <path d="M9 13.5a3.5 3.5 0 0 0 3 1.5" />
    <path d="M9.5 9.5h.01M14.5 9.5h.01" />
  </Svg>
);

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3} />
  </Svg>
);

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
    <path d="M12 14v6" />
  </Svg>
);

/** Outline star; pass fill="currentColor" for a starred one. */
export const HeartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20s-7-4.4-8.9-8.8C1.8 8 3.8 4.8 7 4.8c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.2 3.2 3.9 6.4C19 15.6 12 20 12 20Z" />
  </Svg>
);

export const StarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z" />
  </Svg>
);

export const SmileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14a4.5 4.5 0 0 0 7 0" />
    <path d="M9.2 9.8h.01M14.8 9.8h.01" strokeWidth={2.6} />
  </Svg>
);

export const KeyboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01M7 13.5h.01M17 13.5h.01" strokeWidth={2.4} />
    <path d="M10 14h4" />
  </Svg>
);

/** "Aa": text style. */
export const TextStyleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 18 5-12 5 12M4.8 14h6.4" />
    <path d="M20.5 12.5v5.5M20.5 15a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0Z" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);

