import { cn } from "@/lib/utils";

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
};

export function Icon({ name, className, filled, size = 18 }: IconProps) {
  return (
    <span
      className={cn(
        "material-symbols-outlined",
        filled && "material-filled",
        className
      )}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}
