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
